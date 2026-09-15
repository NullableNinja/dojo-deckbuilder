from pathlib import Path
p = Path('.github/temp-patch-attack-declared.py')
text = p.read_text()
old = "end = text.index('\\n\\n  const resolveDefense =', start)"
new = "end = text.index('\\n\\n  const ', start + len('  const resolveReversal = () => setMatch((current) => {'))"
assert old in text
p.write_text(text.replace(old, new, 1))
