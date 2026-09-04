import json
from pathlib import Path

cards = json.loads(Path('app/data/cards.json').read_text())['cards']
print('=== STARTER DEFENSES ===')
for name in ['High Guard', 'Center Guard', 'Low Guard', 'Cover Up']:
    card = next(card for card in cards if card.get('name') == name)
    print(json.dumps({
        'name': card['name'],
        'zone': card.get('zone'),
        'guard': card.get('stats', {}).get('Guard'),
        'focusValue': card.get('focusValue'),
        'rulesText': card.get('rulesText'),
        'catalogId': card.get('catalogId'),
    }, sort_keys=True))

print('=== EXHAUST RULES ===')
for card in cards:
    text = str(card.get('rulesText') or '')
    if 'Exhaust' in text or 'exhaust' in text or 'ready one Equipment' in text or 'ready an Equipment' in text:
        print(json.dumps({
            'name': card.get('name'),
            'catalogId': card.get('catalogId'),
            'subtype': card.get('subtype'),
            'rulesText': text,
        }, sort_keys=True))
raise SystemExit('Inspection-only run: no source changes applied.')
