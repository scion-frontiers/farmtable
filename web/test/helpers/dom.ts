import { afterEach } from 'vitest';

interface LitLike extends HTMLElement {
  updateComplete: Promise<boolean>;
}

const mounted: HTMLElement[] = [];

/**
 * Create an element, assign properties, attach it to the document and wait for
 * the first render to settle.
 *
 * Properties are assigned *before* connection because several Farm Table
 * components read `this.store` inside `connectedCallback()`.
 */
export async function mount<T extends HTMLElement>(
  tag: string,
  props: Record<string, unknown> = {},
): Promise<T> {
  const element = document.createElement(tag) as T;
  Object.assign(element, props);
  document.body.append(element);
  mounted.push(element);
  await settle(element);
  return element;
}

/**
 * Await a Lit element's render cycle, plus any nested element renders.
 *
 * Runs twice: several components assign derived state inside `updated()`
 * (e.g. `ft-kanban-column._sortedTasks`), which schedules a follow-up render.
 */
export async function settle(element: HTMLElement): Promise<void> {
  for (let pass = 0; pass < 2; pass++) {
    const lit = element as Partial<LitLike>;
    if (lit.updateComplete) await lit.updateComplete;
    // Nested elements render in their own microtask batch.
    await Promise.resolve();
    for (const child of queryAllDeep<LitLike>(element, '*')) {
      if (child.updateComplete) await child.updateComplete;
    }
  }
}

/** Update properties on a mounted element and wait for the re-render. */
export async function update<T extends HTMLElement>(element: T, props: Record<string, unknown>): Promise<T> {
  Object.assign(element, props);
  await settle(element);
  return element;
}

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
  document.body.innerHTML = '';
});

// ── Shadow-DOM aware queries ──────────────────────────────────────────────

function roots(node: Element | ShadowRoot): (Element | ShadowRoot)[] {
  const found: (Element | ShadowRoot)[] = [node];
  const walk = (current: Element | ShadowRoot) => {
    if (current instanceof Element && current.shadowRoot && !found.includes(current.shadowRoot)) {
      found.push(current.shadowRoot);
      walk(current.shadowRoot);
    }
    for (const child of Array.from(current.querySelectorAll('*'))) {
      if (child.shadowRoot && !found.includes(child.shadowRoot)) {
        found.push(child.shadowRoot);
        walk(child.shadowRoot);
      }
    }
  };
  walk(node);
  return found;
}

/** querySelectorAll that descends through every open shadow root. */
export function queryAllDeep<T extends Element>(node: Element | ShadowRoot, selector: string): T[] {
  const results: T[] = [];
  for (const root of roots(node)) {
    for (const match of Array.from(root.querySelectorAll<T>(selector))) {
      if (!results.includes(match)) results.push(match);
    }
  }
  return results;
}

/** querySelector that descends through every open shadow root. */
export function queryDeep<T extends Element>(node: Element | ShadowRoot, selector: string): T | null {
  return queryAllDeep<T>(node, selector)[0] ?? null;
}

/**
 * All *user-visible* text of an element, including every open shadow root.
 *
 * `<style>` content is excluded: Lit puts component CSS in the shadow root, and
 * `textContent` would otherwise return several kilobytes of stylesheet that no
 * user can read and that makes text assertions meaningless.
 */
export function textDeep(node: Element | ShadowRoot): string {
  const parts: string[] = [];
  for (const root of roots(node)) {
    for (const child of Array.from(root.childNodes)) collectText(child, parts);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const NON_VISIBLE_TAGS = new Set(['STYLE', 'SCRIPT', 'TEMPLATE']);

function collectText(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text.trim()) parts.push(text);
    return;
  }
  if (!(node instanceof Element) || NON_VISIBLE_TAGS.has(node.tagName)) return;
  for (const child of Array.from(node.childNodes)) collectText(child, parts);
}

/** Serialized markup of an element and every open shadow root beneath it. */
export function htmlDeep(node: Element | ShadowRoot): string {
  return roots(node)
    .map((root) => (root instanceof ShadowRoot ? root.innerHTML : root.outerHTML))
    .join('\n');
}

// ── Interaction helpers ───────────────────────────────────────────────────

/** Set a Shoelace control's value and emit the `sl-change` it emits for real. */
export async function selectValue(element: Element, value: string): Promise<void> {
  (element as HTMLElement & { value: string }).value = value;
  element.dispatchEvent(new CustomEvent('sl-change', { bubbles: true, composed: true }));
  await Promise.resolve();
}

/** Emit the `sl-remove` event a removable `<sl-tag>` fires when cleared. */
export async function removeTag(element: Element): Promise<void> {
  element.dispatchEvent(new CustomEvent('sl-remove', { bubbles: true, composed: true }));
  await Promise.resolve();
}

/**
 * Simulate an HTML5 drop carrying a task id.
 *
 * jsdom implements neither `DragEvent` nor `DataTransfer`, so this builds a
 * plain bubbling `drop` event with the minimal `dataTransfer` surface the
 * column's handler reads.
 */
export function dropTaskOn(element: Element, taskId: string): Event {
  const event = new Event('drop', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: 'move',
      effectAllowed: 'move',
      getData: (format: string) => (format === 'text/plain' ? taskId : ''),
      setData: () => undefined,
    },
  });
  element.dispatchEvent(event);
  return event;
}

/**
 * Simulate an HTML5 `dragover`.
 *
 * `dataTransfer.dropEffect` starts at `'none'` — the value a handler that does
 * nothing would leave behind — so a test can tell an explicit `'move'` from an
 * untouched default.
 */
export function dragOverOn(element: Element): Event {
  const event = new Event('dragover', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { dropEffect: 'none', effectAllowed: 'move' },
  });
  element.dispatchEvent(event);
  return event;
}

/**
 * Simulate a complete drag gesture, honouring the browser rule that `drop` only
 * fires on an element whose `dragover` handler called `preventDefault()`.
 *
 * `dropTaskOn` deliberately bypasses that rule so refusal handling can be tested
 * in isolation. Use this helper when the question is whether a real user's drop
 * would reach the application at all: it returns `false` when the gesture was
 * swallowed at `dragover`, which is exactly the silent no-op that a `return`
 * before `preventDefault()` reintroduces.
 */
export function dragTaskOnto(element: Element, taskId: string): boolean {
  if (!dragOverOn(element).defaultPrevented) return false;
  dropTaskOn(element, taskId);
  return true;
}

/** Wait for pending promise jobs (optimistic update + awaited client call). */
export async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
