from pathlib import Path

patch = Path("scripts/deploy_patch.py")
text = patch.read_text()
old = '''def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected patch anchor missing in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"Patch anchor not unique in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))
'''
new = '''def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected patch anchor missing in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))
'''
if old not in text:
    raise SystemExit("Could not find strict replace_once helper in queued Exhaust patch")
patch.write_text(text.replace(old, new, 1))

# Execute the corrected queued patch in this same checkout.
code = compile(patch.read_text(), str(patch), "exec")
exec(code, {"__name__": "__main__", "__file__": str(patch)})

# The validated maintenance commit should contain source changes, not patch helpers.
Path("scripts/deploy_patch_fix.py").unlink(missing_ok=True)
