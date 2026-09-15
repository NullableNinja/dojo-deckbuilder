from pathlib import Path
p = Path('.github/temp-patch-attack-declared.py')
text = p.read_text()
replacements = [
    (
        "end = text.index('\\n\\n  const resolveDefense =', start)",
        "end = text.index('\\n\\n  const ', start + len('  const resolveReversal = () => setMatch((current) => {'))",
    ),
    (
        "rev_end = text.index('const resolveDefense =', rev_start)",
        "rev_end = text.index('\\n\\n  const resolveReversal =', rev_start)",
    ),
]
for old, new in replacements:
    assert old in text, old
    text = text.replace(old, new, 1)
p.write_text(text)
