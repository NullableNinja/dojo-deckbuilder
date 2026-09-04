from pathlib import Path

patch = Path(__file__).with_name("deploy_patch.py")
text = patch.read_text(encoding="utf-8")
text = text.replace('rules = load_json("app/data/rules.json")n\n', 'rules = load_json("app/data/rules.json")\n')
patch.write_text(text, encoding="utf-8")
exec(compile(text, str(patch), "exec"), {"__file__": str(patch), "__name__": "__main__"})

play_path = patch.resolve().parents[1] / "app/playtest.tsx"
play = play_path.read_text(encoding="utf-8")
old = 'return saved?.schema === 7 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;'
new = 'return saved?.schema === 8 && saved?.player?.fighterId && saved?.ai?.fighterId && saved.turnOrder?.length === 2 && cardFor(saved.player.fighterId) && cardFor(saved.ai.fighterId) ? saved : null;'
if old not in play:
    raise RuntimeError("Saved-match schema guard was not found")
play_path.write_text(play.replace(old, new), encoding="utf-8")

Path(__file__).unlink()
