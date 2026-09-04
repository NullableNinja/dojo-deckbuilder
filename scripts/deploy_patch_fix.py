from pathlib import Path

patch = Path(__file__).with_name("deploy_patch.py")
text = patch.read_text(encoding="utf-8")

# Repair the one malformed generated HTML literal in the queued patch.
lines = text.splitlines()
repaired = False
for i, line in enumerate(lines):
    if "Once per turn, you may discard <strong>1 Bad Habit</strong>" in line and '"</div>",' in line:
        indent = line[: len(line) - len(line.lstrip())]
        lines[i:i + 1] = [
            indent + '"<div>Once per turn, you may discard <strong>1 Bad Habit</strong> from your hand to gain <strong>1 Focus</strong>. This does not count as playing the card, resolving its text, or gaining XP.</div>\\n"',
            indent + '"</div>",',
        ]
        repaired = True
        break

if repaired:
    text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
    patch.write_text(text, encoding="utf-8")

# Fail clearly if the queued patch is still not valid Python.
compile(text, str(patch), "exec")

# Execute the complete queued implementation. It owns all source/rules/test edits.
exec(compile(text, str(patch), "exec"), {"__file__": str(patch), "__name__": "__main__"})

# The workflow already removes deploy_patch.py after validation. Remove this helper
# so the validated commit cannot retrigger maintenance instead of deployment.
Path(__file__).unlink()
print("Repaired and executed queued Dojo economy/rules patch.")
