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
  // Lit template binding: <a href=${expr}> / <img src=${expr}>
  { name: 'dynamic href/src attribute binding', pattern: /\b(?:href|src)\s*=\s*\$\{/ },
  // Imperative DOM assignment: el.href = expr
  { name: 'dynamic href/src property assignment', pattern: /\.(?:href|src)\s*=\s*(?!=)/ },
];

// ── the allow-list ───────────────────────────────────────────────────────────

interface Allowed {
  /** Path relative to web/src. */
  readonly file: string;
  /** Exact trimmed source line that is permitted. */
  readonly line: string;
  /** Why this binding cannot carry an attacker-controlled scheme. */
  readonly reason: string;
  /** If set, the file must import safeHref, so the entry cannot be a rubber stamp. */
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
  // rot into permanent exemptions after the code they describe has moved.
  for (const a of ALLOWED) {
    assert(
      findings.some((f) => f.file === a.file && f.line === a.line),
      `stale ALLOWED entry, no longer present in the tree: ${a.file} :: ${a.line}`,
    );
  }

  // An allow-list entry claiming to go through safeHref must actually import it.
  for (const a of ALLOWED.filter((x) => x.viaSafeHref)) {
    const text = readFileSync(join(SRC, a.file), 'utf8');
    assert(
      text.includes("from '../../util/safe-url.js'") || text.includes("from '../util/safe-url.js'"),
      `${a.file} is allow-listed as using safeHref but does not import it`,
    );
  }
}

function run(): void {
  testPositiveFixtures();
  testNoUnapprovedBindings();
  console.log('url-binding-scan: ok');
}

run();
