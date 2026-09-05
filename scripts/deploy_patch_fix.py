from pathlib import Path

patch = Path(__file__).with_name("deploy_patch.py")
root = patch.resolve().parents[1]
text = patch.read_text(encoding="utf-8")

# Repair generation artifacts in the queued patch before executing it.
text = text.replace('rules = load_json("app/data/rules.json")n\n', 'rules = load_json("app/data/rules.json")\n')

lines = text.splitlines()
for i, line in enumerate(lines):
    if "Once per turn, you may discard <strong>1 Bad Habit</strong>" in line and '"</div>",' in line:
        indent = line[: len(line) - len(line.lstrip())]
        lines[i:i + 1] = [
            indent + '"<div>Once per turn, you may discard <strong>1 Bad Habit</strong> from your hand to gain <strong>1 Focus</strong>. This does not count as playing the card, resolving its text, or gaining XP.</div>\\n"',
            indent + '"</div>",',
        ]
        break

text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
patch.write_text(text, encoding="utf-8")

# Validate Python syntax before touching project files.
compiled = compile(text, str(patch), "exec")

# Execute the complete queued implementation. It owns all source/rules/test edits.
exec(compiled, {"__file__": str(patch), "__name__": "__main__"})

# The queued patch accidentally reverses the r5 hand-size expectation in the
# fixed-HP regression test. Normalize any stale 5-card assertion to the new
# 7-card base hand after the patch has generated/edited its tests.
fixed_hp_path = root / "tests" / "quick-duel-fixed-hp.test.mjs"
fixed_hp = fixed_hp_path.read_text(encoding="utf-8")
fixed_hp = fixed_hp.replace(
    'assert.equal(gameDefinition.turn.handSize, 5);',
    'assert.equal(gameDefinition.turn.handSize, 7);',
)
fixed_hp_path.write_text(fixed_hp, encoding="utf-8")

# The saved-match type is deliberately schema 8 after this rules change; update
# the load guard too so TypeScript does not compare the new literal type to 7.
play_path = root / "app" / "playtest.tsx"
play = play_path.read_text(encoding="utf-8")
old = 'return saved?.schema === 7 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;'
new = 'return saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;'
if old not in play:
    raise RuntimeError("Expected saved-match schema guard was not found")
play_path.write_text(play.replace(old, new), encoding="utf-8")

Path(__file__).unlink()
print("Repaired and executed queued Dojo economy/rules patch.")
