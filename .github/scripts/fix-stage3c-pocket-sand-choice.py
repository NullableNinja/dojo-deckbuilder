from pathlib import Path

p = Path("app/consumable-effect-resolvers.ts")
text = p.read_text()
old = '''    "consumable.chooseOpponentNextAttackPenalty",
    "consumable.chooseFriendlyHealTarget",'''
new = '''    "consumable.chooseOpponentNextAttackPenalty",
    "consumable.chooseOpponentNextDefenseGuardPenalty",
    "consumable.chooseFriendlyHealTarget",'''
if old not in text:
    raise SystemExit("choice resolver anchor missing")
p.write_text(text.replace(old, new, 1))
