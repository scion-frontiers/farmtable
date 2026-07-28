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
 * has zero occurrences in this tree, and the only other `*.test.ts` under
 * `web/` is `src/utils/task-ready.test.ts`. So this rule ships as its own
 * self-contained file, which also means it lands independently of that branch.
 * Folding the two scanners together is merge-time cleanup.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
   * If set, the interpolated identifier on THIS line must be assigned from
   * `safeHref(...)` inside the same enclosing block.
   *
   * This used to be a file-scoped check -- "the file imports safeHref
   * somewhere" -- which is satisfied by a file that guards one binding and not
   * the next one someone adds beside it. That is precisely the shape of the
   * defect this scanner exists to catch, so it is now scoped to the binding.
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * The nearest enclosing top-level construct around a 1-based line number:
 * from the last preceding line that starts at column 0 and opens a block, to
 * the first following line that is a closing brace at column 0.
 *
 * Deliberately crude. For a module-level `function foo() {` this is exactly the
 * function; for a line inside a class it widens to the whole class. Widening is
 * the safe direction -- it can only make the check more permissive than
 * intended, never wrongly fail a guarded binding -- and it still cuts the scope
 * down from "anywhere in the file", which was the actual hole.
 */
function enclosingBlock(lines: readonly string[], lineNo: number): readonly string[] {
  const idx = lineNo - 1;
  let start = 0;
  for (let i = idx; i >= 0; i--) {
    if (/^\S/.test(lines[i]!) && lines[i]!.includes('{')) {
      start = i;
      break;
    }
  }
  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^\}/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end + 1);
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

    const block = enclosingBlock(lines, finding.lineNo);
    const assignment = new RegExp(`\\b${id}\\s*=\\s*safeHref\\s*\\(`);
    assert(
      block.some((l) => assignment.test(l)),
      `${a.file}:${finding.lineNo} is allow-listed as "href comes from safeHref()", but ` +
        `nothing in the enclosing block assigns ${id} from safeHref(). The file importing ` +
        'safeHref is not enough -- a file can guard one binding and leave the next one bare, ' +
        `which is the defect this scanner exists to catch.\n  binding: ${a.line}`,
    );
  }
}

function run(): void {
  testPositiveFixtures();
  testNoUnapprovedBindings();
  console.log('url-binding-scan: ok');
}

run();
