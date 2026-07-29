#!/usr/bin/env python3
import json, re, sys
P = "/home/scion/.claude/projects/-workspace/c02ed59e-ae02-47ad-bc12-54efe2c7b531.jsonl"

cmds = []
for line in open(P, encoding="utf-8", errors="replace"):
    try: o = json.loads(line)
    except Exception: continue
    def walk(x):
        if isinstance(x, dict):
            if x.get("type") == "tool_use" and isinstance(x.get("input"), dict) and "command" in x["input"]:
                cmds.append(x["input"]["command"])
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(o)

def strip_heredocs(c):
    """Remove heredoc BODIES. Their content is data I wrote, not shell I ran."""
    out, i, lines = [], 0, c.split("\n")
    while i < len(lines):
        L = lines[i]
        m = re.search(r"<<-?\s*'?\"?([A-Za-z_][A-Za-z0-9_]*)'?\"?", L)
        out.append(re.sub(r"<<-?\s*'?\"?[A-Za-z_][A-Za-z0-9_]*'?\"?", "<<HEREDOC", L))
        i += 1
        if m:
            term = m.group(1)
            while i < len(lines) and lines[i].strip() != term:
                i += 1
            i += 1   # skip terminator
    return "\n".join(out)

stripped = [strip_heredocs(c) for c in cmds]

def feeds_pipe(seg):
    """True if this redirection is followed by a pipe later in the same command line."""
    return "|" in seg

c1 = c2 = c3 = c4 = 0
h1, h2, h3 = [], [], []
for c in stripped:
    for line in c.split("\n"):
        # 1. 2>&1 > feeding a pipe
        for m in re.finditer(r"2>&1\s*>", line):
            if feeds_pipe(line[m.end():]): c1 += 1; h1.append(line.strip()[:150])
        # 2. >/dev/null on STDOUT feeding a pipe  (the tee - includes >/dev/null 2>&1)
        for m in re.finditer(r"(?<![0-9&])>\s*/dev/null", line):
            if feeds_pipe(line[m.end():]): c2 += 1; h2.append(line.strip()[:150])
        # 3. 2>/dev/null feeding a COUNTING stage (the silent zero)
        for m in re.finditer(r"2>\s*/dev/null", line):
            rest = line[m.end():]
            if re.search(r"\|\s*(wc\b|grep\s+-[a-z]*c|sort|uniq\s+-c|awk|head|tail)", rest):
                c3 += 1; h3.append(line.strip()[:150])

# 5. stderr sent to /dev/null on ANY exploratory command (standing-rule violation count)
c5 = sum(len(re.findall(r"2>\s*/dev/null", c)) for c in stripped)

print("1. `2>&1 >` feeding a pipe .......................... %d" % c1)
for x in h1: print("     ", x)
print("2. `>/dev/null` (stdout) feeding a pipe [THE TEE] ... %d" % c2)
for x in h2: print("     ", x)
print("3. `2>/dev/null` feeding a counting stage [SILENT 0]  %d" % c3)
for x in h3[:40]: print("     ", x)
print("4. of 1-3, how many fed a PUBLISHED figure .......... (see report)")
print()
print("5. stderr -> /dev/null on an exploratory command ..... %d occurrences" % c5)
print("   commands audited (heredocs stripped): %d" % len(cmds))
