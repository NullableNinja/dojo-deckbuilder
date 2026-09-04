import json
from pathlib import Path

cards = json.loads(Path('app/data/cards.json').read_text())['cards']
cover = next(card for card in cards if card.get('name') == 'Cover Up')
print('=== COVER UP RECORD ===')
print(json.dumps(cover, indent=2))
raise SystemExit('Inspection-only run: no source changes applied.')
