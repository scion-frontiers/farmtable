import { LitElement, html, svg, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Shared minimap component for SVG-based pan/zoom canvas views (Tree, Dependency).
 *
 * Shows a scaled-down overview of all graph nodes with a draggable viewport
 * frame indicator. Dispatches `minimap-pan` events when the frame is dragged,
 * allowing the parent view to update its panX/panY accordingly.
 *
 * Usage:
 *   <ft-minimap
 *     .nodes=${this.layoutNodes}
 *     .edges=${this.layoutEdges}
 *     .panX=${this.panX}
 *     .panY=${this.panY}
 *     .scale=${this.scale}
 *     .containerWidth=${this.containerWidth}
 *     .containerHeight=${this.containerHeight}
 *     .edgePathFn=${this.minimapEdgePath}
 *     @minimap-pan=${this.onMinimapPan}
 *   ></ft-minimap>
 */

/** Minimal node info needed for minimap rendering. */
export interface MinimapNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimal edge info — the minimap just needs endpoint IDs. */
export interface MinimapEdge {
  from: string;
  to: string;
}

/** Default edge path builder: straight line between node centers. */
function defaultEdgePath(
  src: MinimapNode,
  tgt: MinimapNode,
): string {
  return `M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`;
}

/** Size of the minimap container in CSS pixels. */
const MINIMAP_SIZE = 180;
/** Padding inside the minimap around the graph content. */
const MINIMAP_PAD = 8;

@customElement('ft-minimap')
export class FtMinimap extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      bottom: 12px;
      left: 12px;
      z-index: 10;
      pointer-events: auto;
    }
    .minimap {
      width: ${MINIMAP_SIZE}px;
      height: ${MINIMAP_SIZE}px;
      background: var(--sl-color-neutral-50, #f8fafc);
      border: 1px solid var(--sl-color-neutral-300, #cbd5e1);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      cursor: pointer;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .minimap-node {
      fill: var(--sl-color-neutral-300, #cbd5e1);
      stroke: var(--sl-color-neutral-400, #94a3b8);
      stroke-width: 0.5;
      rx: 3;
    }
    .minimap-edge {
      stroke: var(--sl-color-neutral-300, #cbd5e1);
      stroke-width: 0.5;
      fill: none;
    }
    .viewport-frame {
      fill: rgba(99, 102, 241, 0.08);
      stroke: var(--sl-color-primary-500, #6366f1);
      stroke-width: 1.5;
      cursor: grab;
    }
    .viewport-frame.dragging {
      cursor: grabbing;
      fill: rgba(99, 102, 241, 0.15);
    }
  `;

  /** Layout nodes from the parent view. */
  @property({ attribute: false })
  nodes: MinimapNode[] = [];

  /** Layout edges from the parent view. */
  @property({ attribute: false })
  edges: MinimapEdge[] = [];

  /** Current pan X offset in graph coordinates. */
  @property({ type: Number })
  panX = 0;

  /** Current pan Y offset in graph coordinates. */
  @property({ type: Number })
  panY = 0;

  /** Current zoom scale. */
  @property({ type: Number })
  scale = 1;

  /** Container width of the main viewport in CSS pixels. */
  @property({ type: Number })
  containerWidth = 800;

  /** Container height of the main viewport in CSS pixels. */
  @property({ type: Number })
  containerHeight = 600;

  /**
   * Optional custom edge path function. Receives source and target
   * MinimapNode and returns an SVG path string.
   */
  @property({ attribute: false })
  edgePathFn?: (src: MinimapNode, tgt: MinimapNode) => string;

  @state() private isDragging = false;

  /** Set true on mouseup after a drag; cleared in the next click handler. */
  private wasDragging = false;

  /** Graph-coordinate offsets captured at drag start. */
  private dragStartGraphX = 0;
  private dragStartGraphY = 0;
  /** panX/panY captured at drag start. */
  private dragStartPanX = 0;
  private dragStartPanY = 0;

  /** Cached node lookup map; rebuilt only when `nodes` changes. */
  private cachedNodeMap = new Map<string, MinimapNode>();
  /** Reference to the nodes array last used to build cachedNodeMap. */
  private lastNodesRef: MinimapNode[] = [];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);
    if (this.nodes !== this.lastNodesRef) {
      this.lastNodesRef = this.nodes;
      this.cachedNodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    }
  }

  // ── Bounding box ──

  private getGraphBounds() {
    if (this.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const n of this.nodes) {
      const l = n.x - n.width / 2;
      const r = n.x + n.width / 2;
      const t = n.y - n.height / 2;
      const b = n.y + n.height / 2;
      if (l < minX) minX = l;
      if (r > maxX) maxX = r;
      if (t < minY) minY = t;
      if (b > maxY) maxY = b;
    }
    return { minX, minY, maxX, maxY };
  }

  // ── Coordinate mapping ──

  /**
   * Convert a mouse event (CSS pixel position) to graph coordinates
   * within the minimap's coordinate system.
   */
  private mouseToGraph(e: MouseEvent): { gx: number; gy: number } | null {
    const svgEl = this.renderRoot.querySelector('svg');
    if (!svgEl) return null;

    const rect = svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Get the viewBox of the minimap SVG
    const vb = svgEl.viewBox.baseVal;
    if (!vb || vb.width === 0 || vb.height === 0) return null;

    const gx = vb.x + (mx / rect.width) * vb.width;
    const gy = vb.y + (my / rect.height) * vb.height;
    return { gx, gy };
  }

  // ── Drag interaction ──

  private onFrameMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const graphCoords = this.mouseToGraph(e);
    if (!graphCoords) return;

    this.isDragging = true;
    this.dragStartGraphX = graphCoords.gx;
    this.dragStartGraphY = graphCoords.gy;
    this.dragStartPanX = this.panX;
    this.dragStartPanY = this.panY;
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    e.preventDefault();

    const graphCoords = this.mouseToGraph(e);
    if (!graphCoords) return;

    const dgx = graphCoords.gx - this.dragStartGraphX;
    const dgy = graphCoords.gy - this.dragStartGraphY;

    const newPanX = this.dragStartPanX + dgx;
    const newPanY = this.dragStartPanY + dgy;

    this.dispatchEvent(
      new CustomEvent('minimap-pan', {
        detail: { panX: newPanX, panY: newPanY },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private onMouseUp = () => {
    if (this.isDragging) {
      this.wasDragging = true;
    }
    this.isDragging = false;
  };

  /**
   * Forward wheel events to the parent view so zooming works even when
   * the cursor is over the minimap overlay.
   */
  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('minimap-wheel', {
        detail: {
          deltaY: e.deltaY,
          clientX: e.clientX,
          clientY: e.clientY,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Click anywhere on the minimap (outside the frame) to jump the viewport
   * so that the clicked point is centered.
   */
  private onMinimapClick(e: MouseEvent) {
    // Don't process if we just finished dragging — mouseup clears isDragging
    // before click fires, so we use the wasDragging flag instead.
    if (this.wasDragging) {
      this.wasDragging = false;
      return;
    }
    // Don't process if click was on the frame itself
    const tgt = e.target as Element;
    if (tgt.classList?.contains('viewport-frame')) return;

    e.preventDefault();
    e.stopPropagation();

    const graphCoords = this.mouseToGraph(e);
    if (!graphCoords) return;

    // Center the viewport on the clicked point
    const vbW = this.containerWidth / this.scale;
    const vbH = this.containerHeight / this.scale;
    const newPanX = graphCoords.gx - vbW / 2;
    const newPanY = graphCoords.gy - vbH / 2;

    this.dispatchEvent(
      new CustomEvent('minimap-pan', {
        detail: { panX: newPanX, panY: newPanY },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Render ──

  render() {
    if (this.nodes.length === 0) {
      return html``;
    }

    const bounds = this.getGraphBounds();
    const graphPad = 40; // padding in graph units

    // Current viewport in graph coordinates
    const vpX = this.panX;
    const vpY = this.panY;
    const vpW = this.containerWidth / this.scale;
    const vpH = this.containerHeight / this.scale;

    // Expand bounds to include the viewport frame so it's never clipped
    // when the user pans the main canvas far from the graph.
    const gMinX = Math.min(bounds.minX - graphPad, vpX);
    const gMinY = Math.min(bounds.minY - graphPad, vpY);
    const gMaxX = Math.max(bounds.maxX + graphPad, vpX + vpW);
    const gMaxY = Math.max(bounds.maxY + graphPad, vpY + vpH);
    const gWidth = gMaxX - gMinX;
    const gHeight = gMaxY - gMinY;

    // Fit the content (graph + viewport frame) into the minimap
    const availSize = MINIMAP_SIZE - 2 * MINIMAP_PAD;
    const fitScale = Math.min(availSize / gWidth, availSize / gHeight);

    // Compute SVG viewBox to center the content
    const svgW = MINIMAP_SIZE / fitScale;
    const svgH = MINIMAP_SIZE / fitScale;
    const svgX = gMinX + gWidth / 2 - svgW / 2;
    const svgY = gMinY + gHeight / 2 - svgH / 2;

    // Use cached node map for edge rendering
    const nodeMap = this.cachedNodeMap;
    const pathFn = this.edgePathFn ?? defaultEdgePath;

    return html`
      <div class="minimap" @click=${this.onMinimapClick} @wheel=${this.onWheel}>
        <svg viewBox="${svgX} ${svgY} ${svgW} ${svgH}">
          <!-- Edges -->
          <g class="minimap-edges">
            ${this.edges.map((e) => {
              const src = nodeMap.get(e.from);
              const tgt = nodeMap.get(e.to);
              if (!src || !tgt) return null;
              return svg`<path d="${pathFn(src, tgt)}" class="minimap-edge" />`;
            })}
          </g>
          <!-- Nodes -->
          <g class="minimap-nodes">
            ${this.nodes.map(
              (n) =>
                svg`<rect
                  class="minimap-node"
                  x="${n.x - n.width / 2}"
                  y="${n.y - n.height / 2}"
                  width="${n.width}"
                  height="${n.height}"
                  rx="3"
                />`,
            )}
          </g>
          <!-- Viewport frame -->
          <rect
            class="viewport-frame ${this.isDragging ? 'dragging' : ''}"
            x="${vpX}"
            y="${vpY}"
            width="${vpW}"
            height="${vpH}"
            rx="2"
            @mousedown=${this.onFrameMouseDown}
          />
        </svg>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-minimap': FtMinimap;
  }
}
