from pathlib import Path
p = Path("app/playtest.tsx")
s = p.read_text()
old = '  let next = { ...board, stage3cStatuses: resolved.statuses };\n  if (resolved.focus) next = gainFocus(next, resolved.focus);'
new = '  let next: Board = { ...board, stage3cStatuses: resolved.statuses };\n  if (resolved.focus) next = gainFocus(next, resolved.focus);'
if old not in s:
    raise SystemExit("prevention Board typing anchor missing")
p.write_text(s.replace(old, new, 1))
