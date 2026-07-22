import { LitElement, html, svg, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import dagre from '@dagrejs/dagre';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import type { Task } from '../../gen/types.js';
import type { FarmTableServiceClient, UpdateTaskFields } from '../../gen/service.js';
import type { CollectionCapabilities } from '../../capabilities.js';
import '../minimap/ft-minimap.js';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

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
  type: 'hierarchy';
}

function edgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

function getDescendantIds(taskId: string, store: TaskStore): Set<string> {
  const ids = new Set<string>();
  const queue = [taskId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const child of store.getChildren(id)) {
      queue.push(child.id);
    }
  }
  return ids;
}

@customElement('ft-tree-view')
export class FtTreeView extends LitElement {
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
    .edge-hierarchy {
      stroke: var(--sl-color-neutral-400, #64748b);
      stroke-width: 2;
      fill: none;
    }
    .drop-target {
      filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.6));
    }
    .drag-invalid {
      opacity: 0.3;
    }
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @property({ type: Boolean })
  readOnly = false;

  @property({ attribute: false })
  capabilities?: CollectionCapabilities;

  private storeCtrl!: TaskStoreController;

  @state() private focusRootId: string | null = null;
  @state() private maxDepth = -1;
  @state() private panX = 0;
  @state() private panY = 0;
  @state() private scale = 1;
  @state() private draggedTaskId: string | null = null;
  @state() private dropTargetId: string | null = null;
  @state() private isPanning = false;
  @state() private expandedNodes = new Set<string>();
  private expandedInitialized = false;

  private _dragDescendants: Set<string> | null = null;
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

  private cancelPanAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private resizeObserver?: ResizeObserver;

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
    // When selectedTaskId changes, center the viewport on the selected node
    // instead of centering the entire graph.
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

  /**
   * Pan the viewport so that the given node is centered, keeping the
   * current zoom level.  Animates smoothly over 750 ms with ease-in-out.
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

  // ── Pan Animation ──

  private static readonly PAN_DURATION_MS = 750;

  private static easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /**
   * Smoothly animate panX/panY from their current values to the target
   * over 750 ms with ease-in-out easing.
   *
   * If called while an animation is already running the current animation
   * is cancelled and a fresh 750 ms animation starts from the current
   * (interpolated) position — no jumping, no queueing.
   */
  private animatePanTo(targetPanX: number, targetPanY: number) {
    // Cancel any in-progress animation and snapshot current position.
    this.cancelPanAnimation();

    const startPanX = this.panX;
    const startPanY = this.panY;
    const duration = FtTreeView.PAN_DURATION_MS;
    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = FtTreeView.easeInOut(t);

      // NOTE: Setting @state() props triggers Lit update cycles (~45 during
      // the animation). Lit batches these to at most one render per frame,
      // which is efficient for attribute-only viewBox changes. If perf
      // becomes an issue with large trees, consider direct setAttribute().
      this.panX = startPanX + (targetPanX - startPanX) * easedT;
      this.panY = startPanY + (targetPanY - startPanY) * easedT;

      if (t < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        // Guard against floating-point drift — explicitly set exact targets.
        this.panX = targetPanX;
        this.panY = targetPanY;
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  // ── Layout ──

  private getVisibleTasks(): Task[] {
    this.initExpandedNodes();

    let tasks: Task[];
    if (this.focusRootId) {
      const ids = getDescendantIds(this.focusRootId, this.store);
      tasks = this.store.allTasks.filter((t) => ids.has(t.id));
    } else {
      tasks = this.store.allTasks;
    }

    if (this.maxDepth >= 0) {
      const depths = new Map<string, number>();
      const walk = (id: string, d: number) => {
        depths.set(id, d);
        for (const child of this.store.getChildren(id)) walk(child.id, d + 1);
      };
      const roots = this.focusRootId
        ? ([this.store.getTask(this.focusRootId)].filter(Boolean) as Task[])
        : this.store.roots;
      for (const r of roots) walk(r.id, 0);
      tasks = tasks.filter((t) => (depths.get(t.id) ?? 0) <= this.maxDepth);
    }

    tasks = tasks.filter((t) => !this.hasCollapsedAncestor(t));

    return tasks;
  }

  private structureKey(tasks: Task[]): string {
    const expanded = [...this.expandedNodes].sort().join(',');
    return tasks
      .map((t) => `${t.id}:${t.parentTaskId ?? ''}`)
      .sort()
      .join('|') + '||' + expanded;
  }

  private runLayout() {
    const tasks = this.getVisibleTasks();
    const key = this.structureKey(tasks);

    if (key === this.lastStructureKey && this.layoutNodes.length > 0) {
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      for (const node of this.layoutNodes) {
        const updated = taskMap.get(node.id);
        if (updated) node.task = updated;
      }
      return;
    }

    this.lastStructureKey = key;
    this.needsCenter = true;

    const g = new dagre.graphlib.Graph({ directed: true, multigraph: true });
    g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    const taskSet = new Set(tasks.map((t) => t.id));
    for (const task of tasks) {
      g.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT, task });
    }

    for (const task of tasks) {
      if (task.parentTaskId && taskSet.has(task.parentTaskId)) {
        g.setEdge(task.parentTaskId, task.id, { type: 'hierarchy' }, 'h');
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
        type: 'hierarchy' as const,
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

  private onNodeDblClick(taskId: string) {
    this.focusRootId = taskId;
    this.lastStructureKey = '';
  }

  private onFocusChange(e: CustomEvent) {
    this.focusRootId = e.detail.focusRootId;
    this.lastStructureKey = '';
  }

  private onLevelChange(e: CustomEvent) {
    this.maxDepth = e.detail.maxDepth;
    this.lastStructureKey = '';
  }

  // ── Collapse / Expand ──

  private initExpandedNodes() {
    if (this.expandedInitialized) return;
    this.expandedInitialized = true;
    for (const task of this.store.allTasks) {
      this.expandedNodes.add(task.id);
    }
  }

  private toggleExpand(taskId: string) {
    const next = new Set(this.expandedNodes);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    this.expandedNodes = next;
    this.lastStructureKey = '';
  }

  private onToggleExpand(e: CustomEvent) {
    this.toggleExpand(e.detail.taskId);
  }

  private hasCollapsedAncestor(task: Task): boolean {
    let current = task.parentTaskId ? this.store.getTask(task.parentTaskId) : undefined;
    while (current) {
      if (!this.expandedNodes.has(current.id)) return true;
      current = current.parentTaskId ? this.store.getTask(current.parentTaskId) : undefined;
    }
    return false;
  }

  // ── Drag-and-drop ──

  private get isReparentDisabled(): boolean {
    return this.readOnly || this.capabilities?.canChangeParent === false;
  }

  private onDragStartCapture(e: DragEvent) {
    if (this.isReparentDisabled) return;
    const taskId = e.dataTransfer?.getData('application/ft-task-id');
    if (!taskId) {
      const node = (e.target as Element).closest?.('ft-tree-node') as
        | (HTMLElement & { task?: Task })
        | null;
      if (node?.task) {
        this.draggedTaskId = node.task.id;
        this._dragDescendants = getDescendantIds(node.task.id, this.store);
      }
    }
  }

  private onForeignDragStart(e: DragEvent, taskId: string) {
    if (this.isReparentDisabled) return;
    this.draggedTaskId = taskId;
    this._dragDescendants = getDescendantIds(taskId, this.store);
    e.dataTransfer!.setData('application/ft-task-id', taskId);
    e.dataTransfer!.effectAllowed = 'move';
  }

  private onNodeDragOver(e: DragEvent, taskId: string) {
    if (!this.draggedTaskId || this.draggedTaskId === taskId) return;
    if (this._dragDescendants?.has(taskId)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    this.dropTargetId = taskId;
  }

  private onNodeDragLeave() {
    this.dropTargetId = null;
  }

  private async onNodeDrop(e: DragEvent, targetId: string) {
    if (this.isReparentDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    const taskId =
      this.draggedTaskId ||
      e.dataTransfer!.getData('application/ft-task-id');
    if (!taskId || taskId === targetId) return;

    const descendants = getDescendantIds(taskId, this.store);
    if (descendants.has(targetId)) return;

    await this.reparentTask(taskId, targetId);
    this.draggedTaskId = null;
    this.dropTargetId = null;
    this._dragDescendants = null;
  }

  private onCanvasDragOver(e: DragEvent) {
    if (!this.draggedTaskId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  }

  private async onCanvasDrop(e: DragEvent) {
    if (this.isReparentDisabled) return;
    const taskId =
      this.draggedTaskId ||
      e.dataTransfer!.getData('application/ft-task-id');
    if (!taskId) return;
    e.preventDefault();
    await this.reparentTask(taskId, null);
    this.draggedTaskId = null;
    this.dropTargetId = null;
    this._dragDescendants = null;
  }

  private onDragEnd() {
    this.draggedTaskId = null;
    this.dropTargetId = null;
    this._dragDescendants = null;
  }

  private async reparentTask(
    taskId: string,
    newParentId: string | null,
  ) {
    if (this.isReparentDisabled) return;
    const task = this.store.getTask(taskId);
    if (!task) return;

    const oldParentId = task.parentTaskId;
    this.store.upsert({ ...task, parentTaskId: newParentId ?? undefined });
    this.lastStructureKey = '';

    try {
      if (this.client) {
        const fields: UpdateTaskFields = newParentId !== null
          ? { parentTaskId: newParentId }
          : { parentTaskId: null };
        await this.client.updateTask(taskId, fields);
      }
    } catch (error) {
      this.store.upsert({ ...task, parentTaskId: oldParentId });
      this.lastStructureKey = '';
      this.dispatchEvent(
        new CustomEvent('write-error', {
          detail: { error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  // ── Minimap ──

  private onMinimapPan(e: CustomEvent<{ panX: number; panY: number }>) {
    this.cancelPanAnimation();
    this.panX = e.detail.panX;
    this.panY = e.detail.panY;
  }

  /**
   * Build edge data for the minimap. The minimap just needs {from, to}
   * pairs — it uses a simple straight-line path by default.
   */
  private get minimapEdges() {
    return this.layoutEdges.map((e) => ({ from: e.from, to: e.to }));
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

    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;

    const dragDescendants = this._dragDescendants ?? new Set<string>();

    return html`
      <ft-hierarchy-nav
        .store=${this.store}
        .focusRootId=${this.focusRootId}
        @focus-change=${this.onFocusChange}
        @level-change=${this.onLevelChange}
      ></ft-hierarchy-nav>

      <div class="canvas-container">
        <svg
          class=${this.isPanning ? 'panning' : ''}
          viewBox="${this.panX} ${this.panY} ${vbW} ${vbH}"
          @mousedown=${this.onMouseDown}
          @wheel=${this.onWheel}
          @dragover=${this.onCanvasDragOver}
          @drop=${this.onCanvasDrop}
          @dragend=${this.onDragEnd}
          @dragstart=${this.onDragStartCapture}
        >
          <g class="edges">
            ${this.layoutEdges.map(
              (e) =>
                svg`<path
                  d="${edgePath(e.points)}"
                  class="edge-hierarchy"
                />`,
            )}
          </g>
          <g class="nodes">
            ${this.layoutNodes.map((n) => {
              const isDropTarget = this.dropTargetId === n.id;
              const isInvalid =
                this.draggedTaskId !== null && dragDescendants.has(n.id);
              let cls = '';
              if (isDropTarget) cls = 'drop-target';
              if (isInvalid) cls = 'drag-invalid';

              return svg`
                <foreignObject
                  x="${n.x - n.width / 2}"
                  y="${n.y - n.height / 2}"
                  width="${n.width}"
                  height="${n.height}"
                  class="${cls}"
                  @click=${() => this.onNodeClick(n.id)}
                  @dblclick=${() => this.onNodeDblClick(n.id)}
                  @dragstart=${(ev: DragEvent) => this.onForeignDragStart(ev, n.id)}
                  @dragover=${(ev: DragEvent) => this.onNodeDragOver(ev, n.id)}
                  @dragleave=${() => this.onNodeDragLeave()}
                  @drop=${(ev: DragEvent) => this.onNodeDrop(ev, n.id)}
                >
                  <ft-tree-node
                    .task=${n.task}
                    ?selected=${this.selectedTaskId === n.id}
                    ?readOnly=${this.readOnly}
                    .childCount=${this.store.getChildren(n.id).length}
                    ?expanded=${this.expandedNodes.has(n.id)}
                    @toggle-expand=${this.onToggleExpand}
                  ></ft-tree-node>
                </foreignObject>
              `;
            })}
          </g>
        </svg>
        <ft-minimap
          .nodes=${this.layoutNodes}
          .edges=${this.minimapEdges}
          .panX=${this.panX}
          .panY=${this.panY}
          .scale=${this.scale}
          .containerWidth=${this.containerWidth}
          .containerHeight=${this.containerHeight}
          @minimap-pan=${this.onMinimapPan}
        ></ft-minimap>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-tree-view': FtTreeView;
  }
}
