from pathlib import Path

patch = Path(__file__).with_name("deploy_patch.py")
text = patch.read_text(encoding="utf-8")
text = text.replace('rules = load_json("app/data/rules.json")n\n', 'rules = load_json("app/data/rules.json")\n')
patch.write_text(text, encoding="utf-8")
exec(compile(text, str(patch), "exec"), {"__file__": str(patch), "__name__": "__main__"})
Path(__file__).unlink()
