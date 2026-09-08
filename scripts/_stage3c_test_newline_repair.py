from pathlib import Path

for name in [
    "tests/stage3c-defense-consumable-runtime.test.mjs",
    "tests/playtest-effect-integration.test.mjs",
    "tests/stage3c-consumable-play-window.test.mjs",
]:
    path = Path(name)
    text = path.read_text()
    # The prior batch inserted literal backslash-n sequences in only the newly-added test blocks/file.
    # Converting them here is safe because these JS test files do not intentionally store escaped newlines in strings.
    path.write_text(text.replace("\\n", "\n"))
