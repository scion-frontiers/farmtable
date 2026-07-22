import { LitElement, html, svg, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import dagre from '@dagrejs/dagre';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import { RelationshipType, TaskPhase } from '../../gen/types.js';
import type { Task } from '../../gen/types.js';
import '../tree/ft-tree-node.js';

/**
 * Dependency Tree View — left-to-right layered DAG of blocking relationships.
 *
 * Shows ONLY blocking/blocked-by relationships (no parent-child hierarchy).
 * Layer 0 (leftmost) = unblocked tasks matching the Ready Queue definition.
 * Layer N = 1 + max(layer of each direct blocker).
 *
 * **Completed-task handling**: CLOSED tasks do not appear in this view.
 * The `isReady()` check already ignores closed blockers, so completed tasks
 * are neither "unblocked/open" (Layer 0) nor active blockers. This keeps
 * the view focused on work that still matters.
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
  points: Array<{ x: number; y: number }>;
}

function edgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

/**
 * Determine if a task is "ready" (unblocked) — same logic as the Ready Queue.
 * Phase is OPEN or IN_PROGRESS, and no BLOCKED_BY relationship targeting a
 * non-CLOSED task.
 */
function isReady(task: Task, store: TaskStore): boolean {
  if (task.phase !== TaskPhase.OPEN && task.phase !== TaskPhase.IN_PROGRESS) {
    return false;
  }
  for (const rel of task.relationships) {
    if (rel.type !== RelationshipType.BLOCKED_BY) continue;
    const blocker = store.getTask(rel.targetTaskId);
    // Unknown/deleted blockers don't block.
    if (blocker && blocker.phase !== TaskPhase.CLOSED) {
      return false;
    }
  }
  return true;
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
): Map<string, number> {
  const layers = new Map<string, number>();
  const taskSet = new Set(tasks.map((t) => t.id));
  const computing = new Set<string>(); // cycle detection

  function getLayer(taskId: string): number {
    if (layers.has(taskId)) return layers.get(taskId)!;

    if (computing.has(taskId)) {
      console.warn(
        `[ft-dependency-view] Cycle detected involving task ${taskId}; capping at layer ${MAX_LAYER_DEPTH}`,
      );
      return MAX_LAYER_DEPTH;
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
      if (!blocker || blocker.phase === TaskPhase.CLOSED) continue;
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
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  private storeCtrl!: TaskStoreController;

  @state() private panX = 0;
  @state() private panY = 0;
  @state() private scale = 1;
  @state() private isPanning = false;

  private containerWidth = 800;
  private containerHeight = 600;
  private panStartX = 0;
  private panStartY = 0;
  private panStartViewX = 0;
  private panStartViewY = 0;

  private layoutNodes: LayoutNode[] = [];
  private layoutEdges: LayoutEdge[] = [];
  private lastStructureKey = '';
  private needsCenter = true;

  /** Active animation frame ID for pan animation, null when idle. */
  private animationFrameId: number | null = null;

  private resizeObserver?: ResizeObserver;

  // ── Lifecycle ──

  connectedCallback() {
    super.connectedCallback();
    this.storeCtrl = new TaskStoreController(this, this.store);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.resizeObserver?.disconnect();
    this.cancelPanAnimation();
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

  updated(changedProps: PropertyValues<this>) {
    if (changedProps.has('selectedTaskId') && this.selectedTaskId) {
      this.centerOnNode(this.selectedTaskId);
      this.needsCenter = false;
    } else if (this.needsCenter && this.layoutNodes.length > 0) {
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

  /**
   * Pan the viewport so that the given node is centered, keeping the
   * current zoom level. Animates smoothly over 750 ms with ease-in-out.
   */
  private centerOnNode(taskId: string) {
    const node = this.layoutNodes.find((n) => n.id === taskId);
    if (!node) return;

    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;
    const targetPanX = node.x - vbW / 2;
    const targetPanY = node.y - vbH / 2;
    this.animatePanTo(targetPanX, targetPanY);
  }

  /**
   * Smoothly animate panX/panY from their current values to the target
   * over 750 ms with ease-in-out easing.
   */
  private animatePanTo(targetPanX: number, targetPanY: number) {
    this.cancelPanAnimation();

    const startPanX = this.panX;
    const startPanY = this.panY;
    const duration = FtDependencyView.PAN_DURATION_MS;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = FtDependencyView.easeInOut(t);

      this.panX = startPanX + (targetPanX - startPanX) * easedT;
      this.panY = startPanY + (targetPanY - startPanY) * easedT;

      if (t < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
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
   * CLOSED tasks are excluded entirely.
   */
  private getVisibleTasks(): Task[] {
    // Start by finding all non-closed tasks (includes ON_HOLD / blocked)
    const nonClosedTasks = this.store.allTasks.filter(
      (t) => t.phase !== TaskPhase.CLOSED,
    );

    // Collect IDs of tasks involved in active blocking relationships
    const involvedIds = new Set<string>();

    for (const task of nonClosedTasks) {
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
    }

    // Layer 0 = all unblocked tasks (same as Ready Queue: OPEN/IN_PROGRESS only)
    for (const task of nonClosedTasks) {
      if (isReady(task, this.store)) {
        involvedIds.add(task.id);
      }
    }

    return this.store.allTasks.filter(
      (t) => involvedIds.has(t.id) && t.phase !== TaskPhase.CLOSED,
    );
  }

  private structureKey(tasks: Task[]): string {
    return tasks
      .map(
        (t) =>
          `${t.id}:${t.relationships.map((r) => `${r.type}-${r.targetTaskId}`).join(',')}`,
      )
      .sort()
      .join('|');
  }

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
    this.needsCenter = true;

    // Compute layers for rank assignment
    const layers = computeLayers(tasks, this.store);

    const g = new dagre.graphlib.Graph({ directed: true, multigraph: true });
    g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
    g.setDefaultEdgeLabel(() => ({}));

    const taskSet = new Set(tasks.map((t) => t.id));

    for (const task of tasks) {
      const layer = layers.get(task.id) ?? 0;
      g.setNode(task.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        task,
        rank: layer,
      });
    }

    // Edges: draw from blocker → blocked task (left → right)
    for (const task of tasks) {
      for (const rel of task.relationships) {
        if (rel.type === RelationshipType.BLOCKED_BY && taskSet.has(rel.targetTaskId)) {
          const blocker = this.store.getTask(rel.targetTaskId);
          if (blocker && blocker.phase !== TaskPhase.CLOSED) {
            // Edge from blocker to this task (LR: blocker is to the left)
            g.setEdge(rel.targetTaskId, task.id, { type: 'dependency' }, 'd');
          }
        }
      }
    }

    dagre.layout(g);

    this.layoutNodes = g.nodes().map((id) => {
      const n = g.node(id) as Record<string, unknown>;
      return {
        id,
        x: n.x as number,
        y: n.y as number,
        width: n.width as number,
        height: n.height as number,
        task: n.task as Task,
      };
    });

    this.layoutEdges = [];
    for (const edgeObj of g.edges()) {
      const e = g.edge(edgeObj) as Record<string, unknown>;
      const pts = (e.points as Array<{ x: number; y: number }>) || [];
      this.layoutEdges.push({
        from: edgeObj.v,
        to: edgeObj.w,
        points: pts,
      });
    }
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

  // ── Render ──

  render() {
    if (this.store.allTasks.length === 0) {
      return html`<ft-empty-state
        icon="diagram-3"
        heading="No tasks to display"
        subtitle="Tasks will appear here when added to this collection"
      ></ft-empty-state>`;
    }

    this.runLayout();

    if (this.layoutNodes.length === 0) {
      return html`<ft-empty-state
        icon="diagram-3"
        heading="No dependency relationships"
        subtitle="Tasks with blocking relationships will appear here"
      ></ft-empty-state>`;
    }

    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;

    return html`
      <div class="canvas-container">
        <svg
          class=${this.isPanning ? 'panning' : ''}
          viewBox="${this.panX} ${this.panY} ${vbW} ${vbH}"
          @mousedown=${this.onMouseDown}
          @wheel=${this.onWheel}
        >
          <g class="edges">
            ${this.layoutEdges.map(
              (e) =>
                svg`<path
                  d="${edgePath(e.points)}"
                  class="edge-dependency"
                />`,
            )}
          </g>
          <g class="nodes">
            ${this.layoutNodes.map((n) => {
              return svg`
                <foreignObject
                  x="${n.x - n.width / 2}"
                  y="${n.y - n.height / 2}"
                  width="${n.width}"
                  height="${n.height}"
                  @click=${() => this.onNodeClick(n.id)}
                >
                  <ft-tree-node
                    .task=${n.task}
                    ?selected=${this.selectedTaskId === n.id}
                    readOnly
                    .childCount=${0}
                  ></ft-tree-node>
                </foreignObject>
              `;
            })}
          </g>
        </svg>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-dependency-view': FtDependencyView;
  }
}
