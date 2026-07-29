import sys
s=sys.stdin.read()
a="""  check('base tag stripped', () => {
    const out = renderMarkdown('<base href="https://evil.example/">');
    assertNoElement(out, 'base', 'base survived');
    assertNotContains(out, 'evil.example', 'base href survived');
  });

"""
assert s.count(a)==1, "anchor not unique"
sys.stdout.write(s.replace(a,""))
