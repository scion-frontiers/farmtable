import { LitElement, html, svg, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import { RelationshipType, TaskPhase } from '../../gen/types.js';
import type { Task } from '../../gen/types.js';
import { isReady } from '../../utils/task-ready.js';
import '../tree/ft-tree-node.js';
import '../ft-empty-state.js';
import '../minimap/ft-minimap.js';

/**
 * Dependency Tree View — left-to-right layered DAG of blocking relationships.
 *
 * Shows ONLY blocking/blocked-by relationships (no parent-child hierarchy).
 * Layer 0 (leftmost) = unblocked tasks matching the Ready Queue definition.
 * Layer N = 1 + max(layer of each direct blocker).
 *
 * **Completed-task handling**: CLOSED tasks are generally excluded from
 * this view to keep the graph focused on active work.  The one exception
 * is **Solo mode on a CLOSED task** — when the user explicitly selects
 * and solos a completed task, that task and its non-closed connections
 * are shown so the user can inspect its dependency relationships.
 *
 * **Solo mode**: When active, shows only the connected component of the
 * selected task — all nodes reachable by traversing BLOCKS/BLOCKED_BY edges
 * in EITHER direction (upstream blockers AND downstream blocked-by chains,
 * transitively).
 */

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

/** Maximum layer depth to prevent infinite loops from cycles. */
const MAX_LAYER_DEPTH = 50;

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  task: Task;
}

interface LayoutEdge {
  from: string;
  to: string;
}

/** Duration of the FLIP node-movement animation after a DnD drop (ms). */
const DND_NODE_ANIM_MS = 500;
/** Duration of the edge draw-in animation that plays after nodes settle (ms). */
const DND_EDGE_ANIM_MS = 300;

/** Snapshot captured in onNodeDrop before the optimistic store update. */
interface DndAnimContext {
  /** The dragged task — becomes the blocked node. */
  sourceId: string;
  /** The drop target — becomes the blocking node (stays visually fixed). */
  targetId: string;
  /** Node positions at the moment of the drop. */
  beforePositions: Map<string, { x: number; y: number }>;
}

/**
 * Build an SVG cubic-bezier path from the right-center of a source node
 * to the left-center of a target node. Control points are placed at ~40%
 * of the horizontal gap for a smooth S-curve.
 */
function edgePath(
  src: { x: number; y: number; width: number },
  tgt: { x: number; y: number; width: number },
): string {
  const startX = src.x + src.width / 2;
  const startY = src.y;
  const endX = tgt.x - tgt.width / 2;
  const endY = tgt.y;
  const dx = endX - startX;
  const cx1 = startX + dx * 0.4;
  const cx2 = endX - dx * 0.4;
  return `M ${startX} ${startY} C ${cx1} ${startY}, ${cx2} ${endY}, ${endX} ${endY}`;
}

/**
 * Compute the set of tasks on a directed path to or from the given task.
 *
 * Unlike the previous bidirectional BFS ("connected component"), this
 * performs TWO separate directed traversals:
 *   1. **Upstream**: follow BLOCKED_BY edges from the selected task to
 *      find everything that (transitively) blocks it.
 *   2. **Downstream**: follow BLOCKS edges from the selected task to
 *      find everything that is (transitively) blocked by it.
 *
 * The result is the union of both sets plus the task itself.  This
 * excludes "sibling" nodes that happen to share a common blocker or
 * blocked-by target but are not on an actual directed path through the
 * selected node — fixing the extraneous-node bug reported in the
 * undirected connected-component approach.
 */
function getDirectedReachableIds(
  taskId: string,
  store: TaskStore,
  taskSet: Set<string>,
): Set<string> {
  const ids = new Set<string>();

  // Helper: directed BFS following only one relationship type.
  // Each call uses its own `visited` set so that the second BFS
  // (downstream) re-processes the start node even though the first
  // BFS (upstream) already added it to `ids`.  Without per-call
  // visited tracking the shared `ids` set causes the second BFS to
  // skip the start node and miss the entire downstream chain.
  const bfs = (startId: string, relType: RelationshipType) => {
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      if (!taskSet.has(id)) continue;
      const task = store.getTask(id);
      // Allow the explicitly-selected task to start the BFS even when
      // CLOSED — this fixes Solo mode on completed tasks.  All OTHER
      // nodes encountered during traversal still respect the CLOSED
      // filter so the graph doesn't pull in unrelated closed tasks.
      if (!task || (task.phase === TaskPhase.CLOSED && id !== taskId)) continue;
      visited.add(id);
      ids.add(id);
      for (const rel of task.relationships) {
        if (rel.type === relType && !visited.has(rel.targetTaskId)) {
          queue.push(rel.targetTaskId);
        }
      }
    }
  };

  // 1. Upstream: everything that blocks the selected task (transitively).
  bfs(taskId, RelationshipType.BLOCKED_BY);
  // 2. Downstream: everything blocked by the selected task (transitively).
  bfs(taskId, RelationshipType.BLOCKS);

  return ids;
}

/**
 * Compute the dependency layer for each task using longest-path DAG layering.
 *
 * Layer 0 = tasks with no non-closed blockers (unblocked / ready).
 * Layer N = 1 + max(layer(blocker)) for each direct non-closed blocker.
 *
 * Cycle detection: if we revisit a node currently being computed (on the
 * recursion stack), we cap at MAX_LAYER_DEPTH and log a warning.
 */
function computeLayers(
  tasks: Task[],
  store: TaskStore,
  exemptClosedIds?: Set<string>,
): Map<string, number> {
  const layers = new Map<string, number>();
  const taskSet = new Set(tasks.map((t) => t.id));
  const computing = new Set<string>(); // cycle detection

  function getLayer(taskId: string): number {
    if (layers.has(taskId)) return layers.get(taskId)!;

    if (computing.has(taskId)) {
      console.warn(
        `[ft-dependency-view] Cycle detected involving task ${taskId}; placing at layer 0`,
      );
      layers.set(taskId, 0);
      return 0;
    }

    const task = store.getTask(taskId);
    if (!task || !taskSet.has(taskId)) {
      layers.set(taskId, 0);
      return 0;
    }

    computing.add(taskId);

    let maxBlockerLayer = -1;
    for (const rel of task.relationships) {
      if (rel.type !== RelationshipType.BLOCKED_BY) continue;
      const blocker = store.getTask(rel.targetTaskId);
      if (
        !blocker ||
        (blocker.phase === TaskPhase.CLOSED &&
          !exemptClosedIds?.has(rel.targetTaskId))
      )
        continue;
      if (!taskSet.has(rel.targetTaskId)) continue;
      const blockerLayer = getLayer(rel.targetTaskId);
      if (blockerLayer > maxBlockerLayer) maxBlockerLayer = blockerLayer;
    }

    computing.delete(taskId);

    const layer = maxBlockerLayer >= 0 ? maxBlockerLayer + 1 : 0;
    const cappedLayer = Math.min(layer, MAX_LAYER_DEPTH);
    layers.set(taskId, cappedLayer);
    return cappedLayer;
  }

  for (const task of tasks) {
    getLayer(task.id);
  }

  return layers;
}

@customElement('ft-dependency-view')
export class FtDependencyView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .canvas-container {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    svg.panning {
      cursor: grabbing;
    }
    .edge-dependency {
      stroke: var(--sl-color-primary-500, #6366f1);
      stroke-width: 1.5;
      fill: none;
      stroke-dasharray: 6 3;
    }
    /* Colorblind-accessible edge colors when a node is selected.
       "blocking" = edge TO a node that blocks the selection (upstream).
       "blocked"  = edge TO a node that is blocked by the selection
       (downstream).
       #D55E00 (vermillion) is from the Okabe-Ito palette.
       #7B3FF2 (blue-purple) is a custom colorblind-accessible color,
       NOT from the Okabe-Ito palette. */
    .edge-blocking {
      stroke: #D55E00;
      stroke-width: 2.5;
      stroke-dasharray: none;
    }
    .edge-blocked {
      stroke: #7B3FF2;
      stroke-width: 2.5;
      stroke-dasharray: none;
    }
    .edge-dependency-drawing {
      stroke: var(--sl-color-primary-500, #6366f1);
      stroke-width: 2;
      fill: none;
    }
    .drop-highlight {
      pointer-events: none;
    }
    foreignObject {
      transition: opacity 0.15s;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--sl-color-neutral-50, #1e1e2e);
      border-bottom: 1px solid var(--sl-color-neutral-200, #334155);
      font-family: var(--sl-font-sans, sans-serif);
      flex-shrink: 0;
    }
    .isolate-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--sl-color-neutral-300, #475569);
      border-radius: var(--sl-border-radius-medium, 4px);
      background: var(--sl-color-neutral-0, #fff);
      color: var(--sl-color-neutral-700, #cbd5e1);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      font-family: inherit;
      line-height: 1.4;
    }
    .isolate-btn:hover {
      background: var(--sl-color-neutral-100, #334155);
      border-color: var(--sl-color-neutral-400, #64748b);
    }
    .isolate-btn.active {
      background: var(--sl-color-primary-100, #312e81);
      border-color: var(--sl-color-primary-500, #6366f1);
      color: var(--sl-color-primary-700, #a5b4fc);
    }
    .isolate-btn.active:hover {
      background: var(--sl-color-primary-200, #3730a3);
    }
    .isolate-btn sl-icon {
      font-size: 0.9rem;
    }
    .isolate-btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  private storeCtrl!: TaskStoreController;

  @property({ type: Boolean })
  readOnly = false;

  @property({ type: Boolean })
  isolateMode = false;
  @state() private panX = 0;
  @state() private panY = 0;
  @state() private scale = 1;
  @state() private isPanning = false;

  /** Task ID of the node currently being dragged. */
  @state() private draggingNodeId: string | null = null;

  /** Task ID of the node currently hovered during a drag. */
  @state() private dragOverNodeId: string | null = null;

  private containerWidth = 800;
  private containerHeight = 600;
  private panStartX = 0;
  private panStartY = 0;
  private panStartViewX = 0;
  private panStartViewY = 0;

  private layoutNodes: LayoutNode[] = [];
  private layoutEdges: LayoutEdge[] = [];
  private nodeMap = new Map<string, LayoutNode>();
  private lastStructureKey = '';
  private needsCenter = true;

  /** Active animation frame ID for pan animation, null when idle. */
  private animationFrameId: number | null = null;

  private resizeObserver?: ResizeObserver;

  /** Per-node drag-enter counters to avoid flicker from child element events. */
  private _dragEnterCounters = new Map<string, number>();

  // ── DnD FLIP animation state ──

  /** Context captured in onNodeDrop, consumed by the next runLayout call. */
  private dndAnimContext: DndAnimContext | null = null;

  /** Target positions for each node during the FLIP node animation. */
  private nodeAnimTargets: Map<string, { x: number; y: number }> | null = null;

  /** Start positions for each node during the FLIP node animation. */
  private nodeAnimStarts: Map<string, { x: number; y: number }> | null = null;

  /** rAF ID for the node-movement animation. */
  private nodeAnimFrameId: number | null = null;

  /** The new edge being drawn in after node animation completes. */
  private animatingEdge: { from: string; to: string } | null = null;

  /** Progress 0..1 for the edge draw-in animation. */
  private animatingEdgeProgress = 0;

  /** rAF ID for the edge draw-in animation. */
  private edgeAnimFrameId: number | null = null;

  private boundOnWheel = this.onWheel.bind(this);
  private wheelListenerAttached = false;

  // ── Lifecycle ──

  connectedCallback() {
    super.connectedCallback();
    this.storeCtrl = new TaskStoreController(this, this.store);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  disconnectedCallback() {
    const svgEl = this.renderRoot.querySelector('svg');
    svgEl?.removeEventListener('wheel', this.boundOnWheel);
    this.wheelListenerAttached = false;
    super.disconnectedCallback();
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.resizeObserver?.disconnect();
    this.cancelPanAnimation();
    this.cancelAllDndAnimations();
  }

  firstUpdated() {
    const container = this.renderRoot.querySelector('.canvas-container');
    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) this.containerWidth = rect.width;
      if (rect.height > 0) this.containerHeight = rect.height;

      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0) this.containerWidth = w;
          if (h > 0) this.containerHeight = h;
          this.requestUpdate();
        }
      });
      this.resizeObserver.observe(container);
    }

    if (this.layoutNodes.length > 0 && this.needsCenter) {
      this.centerGraph();
      this.needsCenter = false;
    }
  }

  /** Keys that change during pan/zoom but do NOT affect graph structure. */
  private static readonly PAN_ZOOM_KEYS = new Set([
    'panX', 'panY', 'scale', 'isPanning',
    'draggingNodeId', 'dragOverNodeId',
  ]);

  protected willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);
    // Skip expensive layout recomputation when only pan/zoom-related
    // properties changed — the graph structure hasn't changed, so
    // runLayout() + structureKey() would just rebuild the same ~480KB
    // string and compare it for equality.  Viewport culling in render()
    // handles which nodes are visible at the new pan/zoom position.
    //
    // Store-triggered updates (via TaskStoreController.requestUpdate()
    // with no arguments) produce an EMPTY changedProperties map, so
    // isPanZoomOnly will be false and layout WILL run — this is correct
    // because the store data may have changed.
    const isPanZoomOnly = changedProperties.size > 0 &&
      [...changedProperties.keys()].every(
        (k) => FtDependencyView.PAN_ZOOM_KEYS.has(k as string),
      );
    if (!isPanZoomOnly) {
      // Run layout first — it updates lastStructureKey which encodes
      // task IDs, phases and relationships.  We then use that key as
      // part of the edge-classification cache so that edge colors are
      // recomputed whenever the underlying relationship data changes
      // (via SSE or the 15-second poll cycle), not only when
      // selectedTaskId changes.  See Features #55 / #60 for prior
      // instances of this class of stale-cache bug.
      this.runLayout();
      this.computeEdgeSets();
    }
  }

  updated(changedProps: PropertyValues<this>) {
    // Attach wheel listener when SVG first appears (handles the case where
    // initial render shows empty state and SVG appears on a later update).
    if (!this.wheelListenerAttached) {
      const svgEl = this.renderRoot.querySelector('svg');
      if (svgEl) {
        svgEl.addEventListener('wheel', this.boundOnWheel, { passive: false });
        this.wheelListenerAttached = true;
      }
    }

    if (changedProps.has('selectedTaskId') && this.selectedTaskId) {
      this.centerOnNode(this.selectedTaskId);
      this.needsCenter = false;
    } else if (
      this.needsCenter &&
      this.layoutNodes.length > 0 &&
      this.nodeAnimFrameId === null &&
      this.edgeAnimFrameId === null
    ) {
      const container = this.renderRoot.querySelector('.canvas-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0) {
          this.containerWidth = rect.width;
          this.containerHeight = rect.height;
          this.centerGraph();
          this.needsCenter = false;
        }
      }
    }
  }

  // ── Pan Animation ──

  /** Fraction of viewport width the selected node should occupy after zoom. */
  private static readonly TARGET_NODE_VIEWPORT_FRACTION = 0.20;

  private static readonly PAN_DURATION_MS = 750;

  private static easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private cancelPanAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // ── DnD FLIP animation helpers ──

  /** Cancel the node-movement animation and snap to final positions. */
  private cancelNodeAnimation() {
    if (this.nodeAnimFrameId !== null) {
      cancelAnimationFrame(this.nodeAnimFrameId);
      this.nodeAnimFrameId = null;
    }
    if (this.nodeAnimTargets) {
      for (const node of this.layoutNodes) {
        const target = this.nodeAnimTargets.get(node.id);
        if (target) {
          node.x = target.x;
          node.y = target.y;
        }
      }
      this.nodeAnimTargets = null;
      this.nodeAnimStarts = null;
      this.requestUpdate();
    }
  }

  /** Cancel the edge draw-in animation. */
  private cancelEdgeAnimation() {
    if (this.edgeAnimFrameId !== null) {
      cancelAnimationFrame(this.edgeAnimFrameId);
      this.edgeAnimFrameId = null;
    }
    this.animatingEdge = null;
    this.animatingEdgeProgress = 0;
  }

  /** Cancel all DnD-related animations and snap to final state. */
  private cancelAllDndAnimations() {
    this.cancelNodeAnimation();
    this.cancelEdgeAnimation();
    this.dndAnimContext = null;
  }

  /**
   * Pan and zoom the viewport so that the given node is centered and its
   * rendered width ≈ 20% of the viewport width.  Animates smoothly over
   * 750 ms with ease-in-out.
   */
  private centerOnNode(taskId: string) {
    const node = this.layoutNodes.find((n) => n.id === taskId);
    if (!node) return;

    // Compute target scale so that NODE_WIDTH occupies the target fraction of viewport.
    const targetScale = Math.min(3, Math.max(0.3,
      (FtDependencyView.TARGET_NODE_VIEWPORT_FRACTION * this.containerWidth) / NODE_WIDTH));

    // Pan target is computed using the target scale so the node is centered
    // at the final zoom level.
    const targetVbW = this.containerWidth / targetScale;
    const targetVbH = this.containerHeight / targetScale;
    const targetPanX = node.x - targetVbW / 2;
    const targetPanY = node.y - targetVbH / 2;
    this.animatePanZoomTo(targetPanX, targetPanY, targetScale, node.x, node.y);
  }

  /**
   * Smoothly animate panX/panY and scale from their current values to the
   * targets over 750 ms with ease-in-out easing.
   *
   * The viewport center is interpolated from its starting position to the
   * target node position.  At each frame, pan is derived from this
   * interpolated center and the interpolated scale so that the camera
   * moves and zooms smoothly without any frame-0 jump.
   *
   * If called while an animation is already running the current animation
   * is cancelled and a fresh 750 ms animation starts from the current
   * (interpolated) position — no jumping, no queueing.
   */
  private animatePanZoomTo(
    targetPanX: number,
    targetPanY: number,
    targetScale: number,
    nodeX: number,
    nodeY: number,
  ) {
    this.cancelPanAnimation();

    const startPanX = this.panX;
    const startPanY = this.panY;
    const startScale = this.scale;

    // Compute the current viewport center in world-space so we can
    // interpolate it smoothly toward the target node position.
    const startCenterX = startPanX + this.containerWidth / startScale / 2;
    const startCenterY = startPanY + this.containerHeight / startScale / 2;

    const duration = FtDependencyView.PAN_DURATION_MS;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = FtDependencyView.easeInOut(t);

      // Interpolate scale and viewport center, then derive pan so the
      // camera moves and zooms in one coordinated motion.
      const curScale = startScale + (targetScale - startScale) * easedT;
      const curCenterX = startCenterX + (nodeX - startCenterX) * easedT;
      const curCenterY = startCenterY + (nodeY - startCenterY) * easedT;
      const curVbW = this.containerWidth / curScale;
      const curVbH = this.containerHeight / curScale;

      this.scale = curScale;
      this.panX = curCenterX - curVbW / 2;
      this.panY = curCenterY - curVbH / 2;

      if (t < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        // Guard against floating-point drift — explicitly set exact targets.
        this.scale = targetScale;
        this.panX = targetPanX;
        this.panY = targetPanY;
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  // ── Layout ──

  /**
   * Get the set of tasks that should appear in this view:
   * - All OPEN/IN_PROGRESS tasks that are unblocked (Layer 0 = Ready Queue set)
   * - All non-CLOSED tasks that are involved in active blocking relationships
   *   (including ON_HOLD tasks in the "blocked" stage)
   *
   * CLOSED tasks are excluded — except in Solo mode when the user
   * explicitly selects and solos a CLOSED task, which is allowed through
   * along with its non-closed connections.
   */
  private getVisibleTasks(): Task[] {
    // Single pass over non-closed tasks: collect those involved in active
    // blocking relationships and those that are ready (Layer 0).
    const involvedIds = new Set<string>();

    for (const task of this.store.allTasks) {
      if (task.phase === TaskPhase.CLOSED) continue;

      // Check blocking relationships
      for (const rel of task.relationships) {
        if (rel.type === RelationshipType.BLOCKED_BY) {
          const blocker = this.store.getTask(rel.targetTaskId);
          if (blocker && blocker.phase !== TaskPhase.CLOSED) {
            involvedIds.add(task.id);
            involvedIds.add(rel.targetTaskId);
          }
        }
        if (rel.type === RelationshipType.BLOCKS) {
          const target = this.store.getTask(rel.targetTaskId);
          if (target && target.phase !== TaskPhase.CLOSED) {
            involvedIds.add(task.id);
            involvedIds.add(rel.targetTaskId);
          }
        }
      }

      // Layer 0 = unblocked tasks (Ready Queue definition)
      if (isReady(task, this.store)) {
        involvedIds.add(task.id);
      }
    }

    // Solo-mode exception: when the user explicitly selects and solos a
    // CLOSED task, add it and its direct relationship targets to
    // involvedIds so the BFS can start from it and its connections appear
    // in the graph.  Other unrelated CLOSED tasks remain hidden.
    if (this.isolateMode && this.selectedTaskId) {
      const selectedTask = this.store.getTask(this.selectedTaskId);
      if (selectedTask && selectedTask.phase === TaskPhase.CLOSED) {
        involvedIds.add(selectedTask.id);
        for (const rel of selectedTask.relationships) {
          if (
            rel.type === RelationshipType.BLOCKS ||
            rel.type === RelationshipType.BLOCKED_BY
          ) {
            const target = this.store.getTask(rel.targetTaskId);
            if (target) {
              involvedIds.add(rel.targetTaskId);
            }
          }
        }
      }
    }

    // Build the filtered task list.  In solo mode, the explicitly-selected
    // CLOSED task is allowed through the phase filter — all other CLOSED
    // tasks are still excluded.
    const isExemptClosed = (t: Task) =>
      this.isolateMode && this.selectedTaskId === t.id;
    let tasks = this.store.allTasks.filter(
      (t) =>
        involvedIds.has(t.id) &&
        (t.phase !== TaskPhase.CLOSED || isExemptClosed(t)),
    );

    // Solo mode: filter to the directed reachability set of the selected task.
    // Collects all upstream blockers (transitive BLOCKED_BY) and all downstream
    // dependants (transitive BLOCKS) via two directed BFS passes.
    if (this.isolateMode && this.selectedTaskId) {
      const reachableIds = getDirectedReachableIds(
        this.selectedTaskId,
        this.store,
        involvedIds,
      );
      tasks = tasks.filter((t) => reachableIds.has(t.id));
    }

    return tasks;
  }

  private structureKey(tasks: Task[]): string {
    const isolateKey = this.isolateMode
      ? `iso:${this.selectedTaskId ?? ''}`
      : '';
    return (
      tasks
        .map(
          (t) =>
            `${t.id}:${t.phase}:${t.relationships
              .map((r) => `${r.type}-${r.targetTaskId}`)
              .sort()
              .join(',')}`,
        )
        .sort()
        .join('|') +
      '||' +
      isolateKey
    );
  }

  /** Horizontal gap between layer columns. */
  private static readonly LAYER_GAP = 100;
  /** Vertical gap between nodes within the same layer. */
  private static readonly NODE_GAP = 40;
  /** Left margin for the leftmost layer. */
  private static readonly MARGIN_LEFT = 40;
  /** Top margin for the topmost node in each layer. */
  private static readonly MARGIN_TOP = 40;

  private runLayout() {
    const tasks = this.getVisibleTasks();
    const key = this.structureKey(tasks);

    if (key === this.lastStructureKey && this.layoutNodes.length > 0) {
      // Structure unchanged — just update task data on existing nodes
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      for (const node of this.layoutNodes) {
        const updated = taskMap.get(node.id);
        if (updated) node.task = updated;
      }
      return;
    }

    this.lastStructureKey = key;

    // Consume DnD animation context if present.  When a DnD drop caused
    // this structure change, we animate instead of resetting the viewport.
    const animCtx = this.dndAnimContext;
    this.dndAnimContext = null;

    if (!animCtx) {
      // Normal (non-DnD) structure change: centre the graph.
      this.needsCenter = true;
      // If a DnD animation is in progress from a prior drop and a
      // concurrent change arrives, snap to final state.
      if (this.nodeAnimFrameId !== null || this.edgeAnimFrameId !== null) {
        this.cancelAllDndAnimations();
      }
    }

    // Compute layers — layer 0 = unblocked, layer N = 1 + max(blocker layers)
    // In solo mode with a CLOSED selected task, exempt it from the CLOSED
    // blocker filter so that layer computation and edge building treat it
    // as an active node.
    const exemptClosedIds =
      this.isolateMode && this.selectedTaskId
        ? (() => {
            const sel = this.store.getTask(this.selectedTaskId!);
            return sel && sel.phase === TaskPhase.CLOSED
              ? new Set([this.selectedTaskId!])
              : undefined;
          })()
        : undefined;
    const layers = computeLayers(tasks, this.store, exemptClosedIds);
    const taskSet = new Set(tasks.map((t) => t.id));

    // Group tasks by layer
    const layerBuckets = new Map<number, Task[]>();
    for (const task of tasks) {
      const layer = layers.get(task.id) ?? 0;
      let bucket = layerBuckets.get(layer);
      if (!bucket) {
        bucket = [];
        layerBuckets.set(layer, bucket);
      }
      bucket.push(task);
    }

    // Manual layout: X based on layer, Y based on index within layer
    const { LAYER_GAP, NODE_GAP, MARGIN_LEFT, MARGIN_TOP } = FtDependencyView;
    this.layoutNodes = [];

    for (const [layer, bucket] of layerBuckets) {
      const x = MARGIN_LEFT + NODE_WIDTH / 2 + layer * (NODE_WIDTH + LAYER_GAP);
      for (let i = 0; i < bucket.length; i++) {
        const y = MARGIN_TOP + NODE_HEIGHT / 2 + i * (NODE_HEIGHT + NODE_GAP);
        this.layoutNodes.push({
          id: bucket[i].id,
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          task: bucket[i],
        });
      }
    }

    // Build edge list and node lookup map: blocker → blocked (left → right)
    this.nodeMap = new Map(this.layoutNodes.map((n) => [n.id, n]));
    this.layoutEdges = [];
    for (const task of tasks) {
      for (const rel of task.relationships) {
        if (rel.type !== RelationshipType.BLOCKED_BY) continue;
        if (!taskSet.has(rel.targetTaskId)) continue;
        const blocker = this.store.getTask(rel.targetTaskId);
        if (
          !blocker ||
          (blocker.phase === TaskPhase.CLOSED &&
            !exemptClosedIds?.has(rel.targetTaskId))
        )
          continue;
        if (this.nodeMap.has(rel.targetTaskId) && this.nodeMap.has(task.id)) {
          this.layoutEdges.push({
            from: rel.targetTaskId,
            to: task.id,
          });
        }
      }
    }

    // If this layout was triggered by a DnD drop, start FLIP animation
    // instead of the usual centerGraph viewport reset.
    if (animCtx) {
      this.startDndAnimation(animCtx);
    }
  }

  // ── DnD FLIP animation — choreographed node movement + edge draw-in ──

  /**
   * Initiate the FLIP animation after a DnD-triggered layout recompute.
   *
   * 1. Adjusts the viewport so the blocking (drop-target) node stays at
   *    its exact screen position.
   * 2. Sets every node's position to its viewport-adjusted old position
   *    (the "Invert" step).
   * 3. Starts a rAF loop that interpolates each node toward its target
   *    position over DND_NODE_ANIM_MS.
   * 4. After nodes settle, kicks off the edge draw-in animation.
   */
  private startDndAnimation(ctx: DndAnimContext) {
    // A. Identify the new edge (blocker → blocked)
    const newEdge = this.layoutEdges.find(
      (e) => e.from === ctx.targetId && e.to === ctx.sourceId,
    );
    if (newEdge) {
      this.animatingEdge = { from: newEdge.from, to: newEdge.to };
      this.animatingEdgeProgress = 0;
    }

    // B. Viewport adjustment: keep the blocking node visually fixed.
    const blockingNode = this.nodeMap.get(ctx.targetId);
    const blockingOld = ctx.beforePositions.get(ctx.targetId);
    let deltaX = 0;
    let deltaY = 0;
    if (blockingNode && blockingOld) {
      deltaX = blockingNode.x - blockingOld.x;
      deltaY = blockingNode.y - blockingOld.y;
      this.panX += deltaX;
      this.panY += deltaY;
    }

    // C. Invert: set each node to its viewport-adjusted old position and
    //    record target positions for the Play phase.
    const targets = new Map<string, { x: number; y: number }>();
    const starts = new Map<string, { x: number; y: number }>();
    for (const node of this.layoutNodes) {
      targets.set(node.id, { x: node.x, y: node.y });
      const oldPos = ctx.beforePositions.get(node.id);
      if (oldPos) {
        // Shift old position by the viewport delta so it appears at the
        // same screen location as before.
        const startX = oldPos.x + deltaX;
        const startY = oldPos.y + deltaY;
        starts.set(node.id, { x: startX, y: startY });
        node.x = startX;
        node.y = startY;
      }
      // Nodes not in beforePositions (newly visible) stay at their target
      // position — they pop in rather than animate from nowhere.
    }
    this.nodeAnimTargets = targets;
    this.nodeAnimStarts = starts;

    // D. Play: rAF loop.
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / DND_NODE_ANIM_MS, 1);
      const easedT = FtDependencyView.easeInOut(t);

      for (const node of this.layoutNodes) {
        const start = this.nodeAnimStarts?.get(node.id);
        const target = this.nodeAnimTargets?.get(node.id);
        if (start && target) {
          node.x = start.x + (target.x - start.x) * easedT;
          node.y = start.y + (target.y - start.y) * easedT;
        }
      }
      this.requestUpdate();

      if (t < 1) {
        this.nodeAnimFrameId = requestAnimationFrame(step);
      } else {
        // Snap to exact targets to avoid floating-point drift.
        for (const node of this.layoutNodes) {
          const target = this.nodeAnimTargets?.get(node.id);
          if (target) {
            node.x = target.x;
            node.y = target.y;
          }
        }
        this.nodeAnimFrameId = null;
        this.nodeAnimTargets = null;
        this.nodeAnimStarts = null;
        this.requestUpdate();

        // Start edge draw-in if there is a new edge to animate.
        if (this.animatingEdge) {
          this.startEdgeDrawIn();
        }
      }
    };

    this.nodeAnimFrameId = requestAnimationFrame(step);
  }

  /**
   * Animate the new dependency edge drawing in from start to end using
   * a progressive stroke-dashoffset reveal over DND_EDGE_ANIM_MS.
   */
  private startEdgeDrawIn() {
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / DND_EDGE_ANIM_MS, 1);
      this.animatingEdgeProgress = FtDependencyView.easeInOut(t);
      this.requestUpdate();

      if (t < 1) {
        this.edgeAnimFrameId = requestAnimationFrame(step);
      } else {
        // Animation complete — the edge now renders normally.
        this.animatingEdge = null;
        this.animatingEdgeProgress = 0;
        this.edgeAnimFrameId = null;
        this.requestUpdate();
      }
    };

    this.edgeAnimFrameId = requestAnimationFrame(step);
  }

  /**
   * Render the edge currently being drawn in. Returns null if no edge
   * animation is active. Uses stroke-dasharray / stroke-dashoffset for
   * a progressive line-drawing effect.
   */
  private renderAnimatingEdge() {
    if (!this.animatingEdge) return null;
    const src = this.nodeMap.get(this.animatingEdge.from);
    const tgt = this.nodeMap.get(this.animatingEdge.to);
    if (!src || !tgt) return null;

    const pathD = edgePath(src, tgt);

    // Approximate the path length: horizontal distance × 1.2 to account
    // for the cubic-bezier curvature.
    const startX = src.x + src.width / 2;
    const endX = tgt.x - tgt.width / 2;
    const startY = src.y;
    const endY = tgt.y;
    const dx = endX - startX;
    const dy = endY - startY;
    const approxLen = Math.sqrt(dx * dx + dy * dy) * 1.2;

    const visibleLen = approxLen * this.animatingEdgeProgress;
    const offset = approxLen - visibleLen;

    return svg`<path
      d="${pathD}"
      class="edge-dependency-drawing"
      stroke-dasharray="${approxLen}"
      stroke-dashoffset="${offset}"
    />`;
  }

  private centerGraph() {
    this.cancelPanAnimation();
    if (this.layoutNodes.length === 0) return;

    const pad = 40;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of this.layoutNodes) {
      const l = n.x - n.width / 2;
      const r = n.x + n.width / 2;
      const t = n.y - n.height / 2;
      const b = n.y + n.height / 2;
      if (l < minX) minX = l;
      if (r > maxX) maxX = r;
      if (t < minY) minY = t;
      if (b > maxY) maxY = b;
    }

    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

    const graphW = maxX - minX;
    const graphH = maxY - minY;
    const sx = this.containerWidth / graphW;
    const sy = this.containerHeight / graphH;
    this.scale = Math.min(sx, sy, 2);
    this.scale = Math.max(0.3, this.scale);

    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.panX = cx - vbW / 2;
    this.panY = cy - vbH / 2;
  }

  // ── Pan / Zoom ──

  private onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const tgt = e.target as Element;
    if (tgt.closest('ft-tree-node') || tgt.closest('foreignObject')) return;
    this.cancelPanAnimation();
    this.cancelAllDndAnimations();
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panStartViewX = this.panX;
    this.panStartViewY = this.panY;
    e.preventDefault();
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isPanning) return;
    const dx = (e.clientX - this.panStartX) / this.scale;
    const dy = (e.clientY - this.panStartY) / this.scale;
    this.panX = this.panStartViewX - dx;
    this.panY = this.panStartViewY - dy;
  };

  private handleMouseUp = () => {
    this.isPanning = false;
  };

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.cancelPanAnimation();
    this.cancelAllDndAnimations();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, this.scale * factor));

    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const svgX = this.panX + mx / this.scale;
    const svgY = this.panY + my / this.scale;

    this.panX = svgX - mx / newScale;
    this.panY = svgY - my / newScale;
    this.scale = newScale;
  }

  // ── Node interaction ──

  private onNodeClick(taskId: string) {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { taskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onIsolateToggle() {
    this.dispatchEvent(
      new CustomEvent('isolate-toggle', {
        detail: { isolateMode: !this.isolateMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Edge classification for color-coding ──

  /** Cache of upstream (blocking) task IDs relative to the selected task. */
  private _upstreamIds: Set<string> | null = null;
  /** Cache of downstream (blocked-by) task IDs relative to the selected task. */
  private _downstreamIds: Set<string> | null = null;
  /**
   * Composite cache key for edge classification: selectedTaskId +
   * lastStructureKey.  This ensures the edge colors are recomputed
   * when relationships change (structure key encodes relationship
   * data), not only when the selected task changes.
   */
  private _edgeCacheKey: string | null = null;

  /**
   * Compute the set of tasks that transitively BLOCK the selected task
   * (upstream) and the set that are transitively BLOCKED BY the selected
   * task (downstream).  Results are cached and invalidated when either
   * the selectedTaskId or the underlying relationship structure changes.
   */
  private computeEdgeSets() {
    const cacheKey = `${this.selectedTaskId}::${this.lastStructureKey}`;
    if (this._edgeCacheKey === cacheKey) return;
    this._edgeCacheKey = cacheKey;

    if (!this.selectedTaskId) {
      this._upstreamIds = null;
      this._downstreamIds = null;
      return;
    }

    // Upstream: traverse BLOCKED_BY edges from selected task
    const upstream = new Set<string>();
    const uQueue = [this.selectedTaskId];
    while (uQueue.length > 0) {
      const id = uQueue.shift()!;
      if (upstream.has(id)) continue;
      upstream.add(id);
      const task = this.store.getTask(id);
      if (!task) continue;
      for (const rel of task.relationships) {
        if (rel.type === RelationshipType.BLOCKED_BY && !upstream.has(rel.targetTaskId)) {
          uQueue.push(rel.targetTaskId);
        }
      }
    }
    upstream.delete(this.selectedTaskId);

    // Downstream: traverse BLOCKS edges from selected task
    const downstream = new Set<string>();
    const dQueue = [this.selectedTaskId];
    while (dQueue.length > 0) {
      const id = dQueue.shift()!;
      if (downstream.has(id)) continue;
      downstream.add(id);
      const task = this.store.getTask(id);
      if (!task) continue;
      for (const rel of task.relationships) {
        if (rel.type === RelationshipType.BLOCKS && !downstream.has(rel.targetTaskId)) {
          dQueue.push(rel.targetTaskId);
        }
      }
    }
    downstream.delete(this.selectedTaskId);

    this._upstreamIds = upstream;
    this._downstreamIds = downstream;
  }

  /**
   * Classify an edge relative to the selected task.
   * Edge goes from `fromId` (blocker) to `toId` (blocked task).
   *
   * Returns:
   *  - 'blocking': the edge is on the upstream path (connects to nodes
   *    that block the selected task).  Shown in red-orange.
   *  - 'blocked': the edge is on the downstream path (connects to nodes
   *    blocked by the selected task).  Shown in blue-purple.
   *  - null: the edge is unrelated to the selected task, or no task is
   *    selected.  Shown in default style.
   */
  private classifyEdge(fromId: string, toId: string): 'blocking' | 'blocked' | null {
    if (!this.selectedTaskId || !this._upstreamIds || !this._downstreamIds) {
      return null;
    }

    const sel = this.selectedTaskId;

    // Upstream path: edges where BOTH endpoints are either the selected
    // task or in the upstream set.
    const fromIsUpOrSel = fromId === sel || this._upstreamIds.has(fromId);
    const toIsUpOrSel = toId === sel || this._upstreamIds.has(toId);
    if (fromIsUpOrSel && toIsUpOrSel) return 'blocking';

    // Downstream path: edges where BOTH endpoints are either the selected
    // task or in the downstream set.
    const fromIsDownOrSel = fromId === sel || this._downstreamIds.has(fromId);
    const toIsDownOrSel = toId === sel || this._downstreamIds.has(toId);
    if (fromIsDownOrSel && toIsDownOrSel) return 'blocked';

    return null;
  }

  // ── Drag-and-Drop for relationship building ──

  // Note: ft-tree-node also has a dragstart handler that fires first
  // (bubbles up from its inner <div>). We intentionally override
  // effectAllowed and set our own data key ('application/ft-task-id') so the two
  // DnD systems (tree-reparent vs dependency-build) don't conflict.
  private onNodeDragStart(taskId: string, e: DragEvent) {
    if (this.readOnly) return;
    e.dataTransfer!.setData('application/ft-task-id', taskId);
    e.dataTransfer!.effectAllowed = 'link';
    this.draggingNodeId = taskId;
  }

  private onNodeDragEnd() {
    this.draggingNodeId = null;
    this.dragOverNodeId = null;
    this._dragEnterCounters.clear();
  }

  private onNodeDragOver(e: DragEvent) {
    if (this.readOnly) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'link';
  }

  private onNodeDragEnter(taskId: string) {
    if (this.readOnly) return;
    const count = (this._dragEnterCounters.get(taskId) ?? 0) + 1;
    this._dragEnterCounters.set(taskId, count);
    this.dragOverNodeId = taskId;
  }

  private onNodeDragLeave(taskId: string) {
    if (this.readOnly) return;
    const count = (this._dragEnterCounters.get(taskId) ?? 0) - 1;
    this._dragEnterCounters.set(taskId, Math.max(0, count));
    if (count <= 0) {
      this._dragEnterCounters.delete(taskId);
      if (this.dragOverNodeId === taskId) {
        this.dragOverNodeId = null;
      }
    }
  }

  private onNodeDrop(targetTaskId: string, e: DragEvent) {
    if (this.readOnly) return;
    e.preventDefault();
    this._dragEnterCounters.clear();
    this.dragOverNodeId = null;
    this.draggingNodeId = null;

    const sourceTaskId = e.dataTransfer!.getData('application/ft-task-id');
    if (!sourceTaskId) return;

    // Self-drop: no-op
    if (sourceTaskId === targetTaskId) return;

    // Already exists: no-op
    const sourceTask = this.store.getTask(sourceTaskId);
    if (sourceTask) {
      const alreadyExists = sourceTask.relationships.some(
        (r) => r.type === RelationshipType.BLOCKED_BY && r.targetTaskId === targetTaskId,
      );
      if (alreadyExists) return;
    }

    // Cycle detection: check if source transitively blocks target
    if (this.wouldCreateCycle(sourceTaskId, targetTaskId)) {
      this.showCycleWarning();
      return;
    }

    // ── FLIP animation: capture "First" positions before store mutation ──
    this.cancelAllDndAnimations();
    const beforePositions = new Map<string, { x: number; y: number }>();
    for (const node of this.layoutNodes) {
      beforePositions.set(node.id, { x: node.x, y: node.y });
    }
    this.dndAnimContext = {
      sourceId: sourceTaskId,
      targetId: targetTaskId,
      beforePositions,
    };

    // Dispatch event to ft-app — the handler runs synchronously within
    // dispatchEvent, performing optimistic store.upsert() calls that
    // will trigger requestUpdate() → runLayout() on the next microtask.
    this.dispatchEvent(
      new CustomEvent('dependency-drop', {
        detail: { sourceTaskId, targetTaskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Check if adding 'sourceId BLOCKED_BY targetId' would create a cycle.
   *
   * A cycle exists if sourceId already transitively blocks targetId
   * through BLOCKS relationships. Creating sourceId BLOCKED_BY targetId
   * (i.e. targetId BLOCKS sourceId) would then form:
   *   targetId → sourceId → ... → targetId
   */
  private wouldCreateCycle(sourceId: string, targetId: string): boolean {
    const visited = new Set<string>();
    const stack = [sourceId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const task = this.store.getTask(current);
      if (!task) continue;

      for (const rel of task.relationships) {
        if (rel.type === RelationshipType.BLOCKS && !visited.has(rel.targetTaskId)) {
          stack.push(rel.targetTaskId);
        }
      }
    }

    return false;
  }

  /** Show a warning toast when a drop would create a circular dependency. */
  private showCycleWarning() {
    const alert = Object.assign(document.createElement('sl-alert'), {
      variant: 'warning',
      closable: true,
      duration: 5000,
    });
    const icon = document.createElement('sl-icon');
    icon.slot = 'icon';
    icon.setAttribute('name', 'exclamation-triangle');
    alert.append(
      icon,
      document.createTextNode('Cannot add dependency: would create a circular dependency'),
    );
    document.body.appendChild(alert);
    void (alert as HTMLElement & { toast(): Promise<void> }).toast();
  }

  // ── Minimap ──

  private onMinimapPan(e: CustomEvent<{ panX: number; panY: number }>) {
    this.cancelPanAnimation();
    this.cancelAllDndAnimations();
    this.panX = e.detail.panX;
    this.panY = e.detail.panY;
  }

  private onMinimapWheel(e: CustomEvent<{ deltaY: number }>) {
    this.cancelPanAnimation();
    this.cancelAllDndAnimations();
    const factor = e.detail.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, this.scale * factor));

    // Anchor zoom to viewport center — the cursor is over the minimap,
    // not the main canvas, so clientX/Y would give a wrong anchor.
    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;
    const centerX = this.panX + vbW / 2;
    const centerY = this.panY + vbH / 2;

    this.panX = centerX - this.containerWidth / newScale / 2;
    this.panY = centerY - this.containerHeight / newScale / 2;
    this.scale = newScale;
  }

  // ── Render ──

  render() {
    if (this.store.taskCount === 0) {
      return html`<ft-empty-state
        icon="diagram-3"
        heading="No tasks to display"
        subtitle="Tasks will appear here when added to this collection"
      ></ft-empty-state>`;
    }

    if (this.layoutNodes.length === 0) {
      return html`<ft-empty-state
        icon="diagram-3"
        heading="No dependency relationships"
        subtitle="Tasks with blocking relationships will appear here"
      ></ft-empty-state>`;
    }

    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;

    // ── Viewport culling ──
    // Compute layout for ALL visible tasks (positions + edges are
    // unchanged), but only create DOM for nodes whose AABB intersects
    // the current viewBox.  This typically eliminates ~95-99% of DOM
    // creation for large graphs, bringing render time from seconds to
    // sub-second.  A generous margin (half a node size) prevents
    // pop-in when nodes are just entering the viewport.
    const margin = Math.max(NODE_WIDTH, NODE_HEIGHT);
    const vpLeft = this.panX - margin;
    const vpRight = this.panX + vbW + margin;
    const vpTop = this.panY - margin;
    const vpBottom = this.panY + vbH + margin;

    const visibleNodes = this.layoutNodes.filter((n) =>
      n.x + n.width / 2 > vpLeft &&
      n.x - n.width / 2 < vpRight &&
      n.y + n.height / 2 > vpTop &&
      n.y - n.height / 2 < vpBottom,
    );

    // Render edges if at least one endpoint node is in the visible set.
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = this.layoutEdges.filter((e) =>
      visibleNodeIds.has(e.from) || visibleNodeIds.has(e.to),
    );

    return html`
      <div class="toolbar">
        <sl-tooltip content=${this.isolateMode ? 'Show full graph' : 'Solo selected task and its connected dependencies'}>
          <button
            class="isolate-btn ${this.isolateMode ? 'active' : ''}"
            ?disabled=${!this.selectedTaskId}
            @click=${this.onIsolateToggle}
          >
            <sl-icon name=${this.isolateMode ? 'fullscreen-exit' : 'funnel'}></sl-icon>
            Solo
          </button>
        </sl-tooltip>
      </div>

      <div class="canvas-container">
        <svg
          class=${this.isPanning ? 'panning' : ''}
          viewBox="${this.panX} ${this.panY} ${vbW} ${vbH}"
          @mousedown=${this.onMouseDown}
        >
          <g class="edges">
            ${visibleEdges.map((e) => {
              // Skip the edge being animated — it's rendered separately
              // by renderAnimatingEdge() with a draw-in effect.
              if (
                this.animatingEdge &&
                e.from === this.animatingEdge.from &&
                e.to === this.animatingEdge.to
              ) {
                return null;
              }
              const src = this.nodeMap.get(e.from);
              const tgt = this.nodeMap.get(e.to);
              if (!src || !tgt) return null;
              const classification = this.classifyEdge(e.from, e.to);
              // In Solo mode, only render edges on the selected task's
              // directed chain — skip cross-edges between chain members
              // that don't pass through the selected task.
              if (this.isolateMode && classification === null) return null;
              const edgeClass = classification === 'blocking'
                ? 'edge-dependency edge-blocking'
                : classification === 'blocked'
                  ? 'edge-dependency edge-blocked'
                  : 'edge-dependency';
              return svg`<path
                d="${edgePath(src, tgt)}"
                class="${edgeClass}"
              />`;
            })}
            ${this.renderAnimatingEdge()}
          </g>
          <g class="nodes">
            ${visibleNodes.map((n) => {
              const isDropTarget =
                this.dragOverNodeId === n.id && this.draggingNodeId !== n.id;
              const isDragging = this.draggingNodeId === n.id;
              const isSelected = this.selectedTaskId === n.id;
              return svg`
                ${isDropTarget
                  ? svg`<rect
                      x="${n.x - n.width / 2 - 4}"
                      y="${n.y - n.height / 2 - 4}"
                      width="${n.width + 8}"
                      height="${n.height + 8}"
                      rx="10"
                      fill="rgba(59, 130, 246, 0.08)"
                      stroke="var(--sl-color-primary-400, #818cf8)"
                      stroke-width="2"
                      stroke-dasharray="6 3"
                      class="drop-highlight"
                    />`
                  : null}
                <foreignObject
                  x="${n.x - n.width / 2}"
                  y="${n.y - n.height / 2}"
                  width="${n.width}"
                  height="${n.height}"
                  data-task-id="${n.id}"
                  overflow="${isSelected ? 'visible' : 'hidden'}"
                  style="${isDragging ? 'opacity: 0.4' : ''}"
                  @click=${() => this.onNodeClick(n.id)}
                  @dragstart=${(e: DragEvent) => this.onNodeDragStart(n.id, e)}
                  @dragend=${() => this.onNodeDragEnd()}
                  @dragover=${(e: DragEvent) => this.onNodeDragOver(e)}
                  @dragenter=${() => this.onNodeDragEnter(n.id)}
                  @dragleave=${() => this.onNodeDragLeave(n.id)}
                  @drop=${(e: DragEvent) => this.onNodeDrop(n.id, e)}
                >
                  <ft-tree-node
                    .task=${n.task}
                    ?selected=${this.selectedTaskId === n.id}
                    ?readOnly=${this.readOnly}
                    .childCount=${0}
                  ></ft-tree-node>
                </foreignObject>
              `;
            })}
          </g>
        </svg>
        <!-- Minimap receives the FULL layout data (all nodes/edges),
             NOT the viewport-culled subset, so it always shows the
             complete graph overview regardless of pan/zoom position. -->
        <ft-minimap
          .nodes=${this.layoutNodes}
          .edges=${this.layoutEdges}
          .panX=${this.panX}
          .panY=${this.panY}
          .scale=${this.scale}
          .containerWidth=${this.containerWidth}
          .containerHeight=${this.containerHeight}
          .edgePathFn=${edgePath}
          @minimap-pan=${this.onMinimapPan}
          @minimap-wheel=${this.onMinimapWheel}
        ></ft-minimap>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-dependency-view': FtDependencyView;
  }
}
