from pathlib import Path

patch = Path(__file__).with_name("deploy_patch.py")
text = patch.read_text(encoding="utf-8")
text = text.replace('rules = load_json("app/data/rules.json")n\n', 'rules = load_json("app/data/rules.json")\n')
patch.write_text(text, encoding="utf-8")
exec(compile(text, str(patch), "exec"), {"__file__": str(patch), "__name__": "__main__"})

root = patch.resolve().parents[1]
play_path = root / "app/playtest.tsx"
play = play_path.read_text(encoding="utf-8")
old = 'return saved?.schema === 7 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;'
new = 'return saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;'
if old not in play:
    raise RuntimeError("Saved-match schema guard was not found")
play_path.write_text(play.replace(old, new), encoding="utf-8")

test_path = root / "tests/playtest-regression-guardrails.test.mjs"
test_text = test_path.read_text(encoding="utf-8")
old_test = 'assert.ok(source.includes(\'drawCards(packedBoard, packedBoard.belt >= 5 ? 6 : 5)\'), "Hide draw count must be explicit and should not depend on how many cards were retained.");'
new_test = 'assert.ok(source.includes(\'gameDefinition.turn.handSize + (readyBoard.belt >= 5 ? 1 : 0)\'), "Hide draw count must come from the configured hand size plus the Blue Belt bonus and should not depend on retained cards.");'
if old_test not in test_text:
    raise RuntimeError("Stale Hide draw guard was not found")
test_path.write_text(test_text.replace(old_test, new_test), encoding="utf-8")

Path(__file__).unlink()
