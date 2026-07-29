# Predictions recorded BEFORE measuring (audit-195-r7)

P1. `unsafeHTML(` call sites in web/src excluding *.test.*: exactly 2.
P2. Files walked under web/src by collectSourceFiles: 50 (51 total incl. index.html).
P3. BANNED_SINKS does NOT match `document.writeln(` — the pattern is
    /document\.write\s*\(/ and `ln` intervenes before `(`.
P4. BANNED_SINKS does NOT match `ownerDocument.write(` / `contentDocument.write(`
    — the regex is case-sensitive and those spell `Document.write`.
P5. web/vite.config.ts exists, ships behaviour into the built app, is NOT under
    src/ and is NOT in EXTRA_SCANNED_FILES => unscanned.
P6. web/public/ exists and its contents are copied into the build unscanned.
P7. innerHTML appears in web/src/util/markdown.test.ts (the `parse()` helper) and
    is invisible to the guard because *.test.* is excluded. Count in non-test
    src files: 0.
P8. The Go server serves the dashboard from embedded assets; if any Go template
    interpolates task text into HTML that is a second sink surface entirely
    outside this guard. Unknown — must measure.
P9. `npm test` currently passes (74+1=75 checks, 122 assertions).
