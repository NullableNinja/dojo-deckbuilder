from pathlib import Path

p = Path("app/kata-effect-resolvers.ts")
s = p.read_text()
old = '  "firstCardPlayedThisTurn",\n]);'
new = '  "firstCardPlayedThisTurn",\n  "firstAttackThisTurn",\n]);'
if old not in s:
    raise SystemExit("Kata predicate anchor missing")
p.write_text(s.replace(old, new, 1))
