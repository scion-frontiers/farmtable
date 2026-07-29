import subprocess, sys, shutil, os
REPO="/workspace"; TARGET=REPO+"/web/src/util/markdown.ts"; BACKUP="/tmp/audit195/markdown.ts.backup"

def sh(c, cwd=REPO):
    return subprocess.run(c, shell=True, cwd=cwd, capture_output=True, text=True)

assert sh("git status --porcelain").stdout.strip()=="" , "tree dirty at start"
shutil.copy(TARGET, BACKUP)

ANCHOR = '''DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
  })'''

def run(label, repl):
    s = open(TARGET).read()
    n = s.count(ANCHOR)
    if n != 1:
        print(f"[{label}] ABORT: anchor occurs {n} times"); return
    open(TARGET,"w").write(s.replace(ANCHOR, repl))
    if sh("git diff --quiet -- web/src/util/markdown.ts").returncode == 0:
        print(f"[{label}] ABORT: no-op mutation"); shutil.copy(BACKUP,TARGET); return
    r = subprocess.run("npm test", shell=True, cwd=REPO+"/web", capture_output=True, text=True)
    print(f"[{label}] {'SUITE GREEN <-- NOT caught' if r.returncode==0 else f'suite red (exit {r.returncode}) - caught'}")
    shutil.copy(BACKUP, TARGET)
    st = sh("git status --porcelain").stdout.strip()
    assert st=="", f"restore failed: {st}"

# self-check that the driver can go red
run("SELFCHECK bypass sanitize", 'parser.parse(md) as string')

run("ADD_TAGS script + ADD_ATTR onerror", '''DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_TAGS: ["script"],
    ADD_ATTR: ["onerror"],
  })''')
run("ADD_ATTR style (re-permit forbidden attr)", '''DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: ["style"],
  })''')
run("WHOLE_DOCUMENT true", '''DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
    WHOLE_DOCUMENT: true,
  })''')
run("ALLOW_UNKNOWN_PROTOCOLS true", '''DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_UNKNOWN_PROTOCOLS: true,
  })''')
run("SAFE_FOR_TEMPLATES off + ADD_ATTR srcdoc/iframe", '''DOMPurify.sanitize(parser.parse(md) as string, {
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["srcdoc"],
  })''')

print("final git status:", repr(sh("git status --porcelain").stdout.strip()), "HEAD:", sh("git rev-parse --short HEAD").stdout.strip())
