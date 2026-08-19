#!/usr/bin/env python3
"""Give the plain modules an open(), and route their clicks through the address.

§13q. Written as a script rather than typed seven times because a mechanical
change made by hand is a mechanical change made seven slightly different ways,
and because it can be run again if a module is added. Idempotent: a module that
already has open() is left alone.
"""
import re, sys, pathlib

# module -> (store address prefix, db store name)
PLAIN = {
    'substances': 'substances',
    'techniques': 'techniques',
    'materials':  'materials',
}

OPEN_TMPL = """  // The address decides what is on screen (§13q). Called on every route
  // change, with nothing when the address names no record, which is how the
  // list comes back.
  //
  //   #/{m}          the list
  //   #/{m}/new      a new record
  //   #/{m}/<id>     the record
  open(first) {{
    draft = null;
    openId = first || null;
  }},

"""

def convert(name, addr):
    p = pathlib.Path('modules') / f'{name}.js'
    s = p.read_text()
    if re.search(r'^\s{2}open\(', s, re.M):
        print(f'  {name}: already has open(), left alone')
        return
    # 1. import navigate
    m = re.search(r"^import \{([^}]*)\} from '\.\./ui\.js';$", s, re.M)
    if 'navigate' not in m.group(1):
        s = s[:m.start(1)] + m.group(1).rstrip() + ', navigate' + s[m.end(1):]
    # 2. insert open() above reset(), with or without a comment over it. The
    #    first version of this pattern required the comment, silently skipped
    #    the one module that has none, and still reported success — so the
    #    result is asserted below rather than trusted.
    anchor = re.search(r'^(  (?://[^\n]*\n  )*)reset\(\) \{', s, re.M)
    s = s[:anchor.start()] + OPEN_TMPL.format(m=addr) + s[anchor.start():]
    # 3. clicks become navigation
    s = s.replace("{ draft = null; openId = 'new'; return this.render(root); }",
                  f"return navigate('#/{addr}/new');")
    s = s.replace("{ draft = null; openId = row.dataset.open; return this.render(root); }",
                  f"return navigate(`#/{addr}/${{row.dataset.open}}`);")
    s = s.replace("{ openId = null; draft = null; return this.render(root); }",
                  f"return navigate('#/{addr}');")
    s = s.replace("        openId = null; draft = null;\n        return this.render(root);",
                  f"        return navigate('#/{addr}');")
    # A script that reports what it intended rather than what it did is worse
    #    than no script: the fault it introduces arrives wearing a success line.
    if not re.search(r'^\s{2}open\(', s, re.M) or 'navigate(' not in s:
        sys.exit(f'{name}: the conversion did not take — nothing written')
    p.write_text(s)
    print(f'  {name}: converted')

for name, addr in PLAIN.items():
    convert(name, addr)
