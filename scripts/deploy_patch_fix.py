from pathlib import Path

patch = Path('scripts/deploy_patch.py')
text = patch.read_text()

helper_anchor = '''def append_once(path, marker, addition):\n'''
if 'def replace_first(path, old, new):' not in text:
    helper = '''def replace_first(path, old, new):\n    text = read(path)\n    if old not in text:\n        raise SystemExit(f"Expected first patch anchor missing in {path}: {old[:140]!r}")\n    write(path, text.replace(old, new, 1))\n\n\n'''
    text = text.replace(helper_anchor, helper + helper_anchor, 1)

needle = '''replace_once(\n    play_path,\n    'damageDealt: current.player.damageDealt + damage }, card, "player");','''
replacement = '''replace_first(\n    play_path,\n    'damageDealt: current.player.damageDealt + damage }, card, "player");','''
if needle not in text:
    raise SystemExit('Could not locate the ambiguous normal-Attack patch call.')
text = text.replace(needle, replacement, 1)
patch.write_text(text)

# Execute the corrected maintenance patch in this process.
namespace = {'__name__': '__main__', '__file__': str(patch)}
exec(compile(text, str(patch), 'exec'), namespace, namespace)

# Successful patch: do not leave the temporary disambiguation helper in main.
Path(__file__).unlink(missing_ok=True)
