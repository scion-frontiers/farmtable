// Does the surviving `slot` attribute give an attacker a UI-redressing primitive
// in the ft-inspector-comments sink, where sanitized markdown lands inside
// <sl-details> (a shadow host with a named "summary" slot)?
//
// This is a NEGATIVE claim across more than one step ("slot survives sanitization
// BUT is not assignable at the depth it lands at"), so bar 3 applies: the harness
// must first PROVE it can express a successful slot assignment. If the positive
// control does not assign, the harness cannot express the state change and any
// negative is worthless -> abort.
import { JSDOM } from '/workspace/web/node_modules/jsdom/lib/api.js';

const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;

// A stand-in for <sl-details>: a shadow host exposing a named "summary" slot,
// mirroring Shoelace's structure.
class FakeDetails extends window.HTMLElement {
  constructor() {
    super();
    const sr = this.attachShadow({ mode: 'open' });
    sr.innerHTML = `<div part="header"><slot name="summary">default summary</slot></div><div part="body"><slot></slot></div>`;
  }
}
window.customElements.define('sl-details-stub', FakeDetails);

const assignedToSummary = (host) => {
  const slot = host.shadowRoot.querySelector('slot[name="summary"]');
  return slot.assignedNodes({ flatten: false }).map((n) => n.outerHTML ?? n.textContent);
};

console.log('=== SELF-CHECK: can this harness express a SUCCESSFUL slot assignment? ===');
const host1 = document.createElement('sl-details-stub');
document.body.appendChild(host1);
// direct child carrying slot="summary" -> MUST be assigned
host1.innerHTML = `<span slot="summary">HIJACKED-HEADER</span>`;
const control = assignedToSummary(host1);
console.log('  direct child with slot="summary" assigned nodes:', JSON.stringify(control));
if (control.length === 0 || !String(control[0]).includes('HIJACKED-HEADER')) {
  console.log('  ABORT: harness cannot express slot assignment at all. Negative result would be a false negative.');
  process.exit(2);
}
console.log('  harness CAN express slot assignment.\n');

console.log('=== ACTUAL SINK SHAPE (ft-inspector-comments.ts:194-222) ===');
console.log('  <sl-details> > div.comment > div.comment-body > [sanitized markdown]');
const host2 = document.createElement('sl-details-stub');
document.body.appendChild(host2);
// Reproduce the real nesting depth. Attacker controls only the innermost markup.
const attackerMarkup = `<span slot="summary">HIJACKED-HEADER</span><p slot="summary" id="x">also tries</p>`;
host2.innerHTML = `<div class="comment"><div class="comment-body">${attackerMarkup}</div></div>`;
const nested = assignedToSummary(host2);
console.log('  attacker markup at real depth, assigned to summary slot:', JSON.stringify(nested));
const hijacked = nested.some((n) => String(n).includes('HIJACKED-HEADER'));
console.log(`  RESULT: summary slot hijacked from real depth? ${hijacked ? 'YES - FINDING' : 'NO'}`);

console.log('\n=== COUNTERFACTUAL: what if markdown were ever a DIRECT child of sl-details? ===');
const host3 = document.createElement('sl-details-stub');
document.body.appendChild(host3);
host3.innerHTML = attackerMarkup; // markdown rendered directly into the slot host
const direct = assignedToSummary(host3);
const directHijack = direct.some((n) => String(n).includes('HIJACKED-HEADER'));
console.log('  assigned:', JSON.stringify(direct));
console.log(`  RESULT: hijacked if rendered as direct child? ${directHijack ? 'YES' : 'NO'}`);

console.log('\n=== CONCLUSION ===');
console.log(`  slot survives the sanitizer (see poc.mjs G15).`);
console.log(`  Exploitable at the CURRENT nesting depth : ${hijacked}`);
console.log(`  Exploitable if nesting depth ever changes: ${directHijack}`);
process.exit(0);
