from pathlib import Path

p = Path('app/quick-duel-playtest-host.ts')
text = p.read_text()
old = '''  const event: CharacterRuntimeEvent = {\n    type: "reveal",\n    card: cardLookup(facts.cardId) ?? { id: facts.cardId },\n    revealSource: facts.revealSource,'''
new = '''  const revealedCard = cardLookup(facts.cardId);\n  const event: CharacterRuntimeEvent = {\n    type: "reveal",\n    card: revealedCard ? { id: revealedCard.id, subtype: revealedCard.subtype ?? undefined } : { id: facts.cardId },\n    revealSource: facts.revealSource,'''
if old in text:
    text = text.replace(old, new, 1)
else:
    assert 'const revealedCard = cardLookup(facts.cardId);' in text
p.write_text(text)
