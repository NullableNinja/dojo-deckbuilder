from pathlib import Path

path = Path('app/quick-duel-transition-host.ts')
text = path.read_text()

import_anchor = 'import { publishQuickDuelCharacterEvent } from "./quick-duel-structured-host.ts";\n'
import_line = 'import { structuredCardHasNoPrintedNumericEffect } from "./structured-card-facts.ts";\n'
assert import_anchor in text, 'transition host import anchor not found'
assert import_line not in text, 'structured card fact import already present'
text = text.replace(import_anchor, import_anchor + import_line, 1)

event_anchor = '''        thirdDifferentCardTypeThisTurn: played.thirdDifferentCardTypeThisTurn,\n        completedBeltExam: played.completedBeltExam,\n'''
event_replacement = '''        thirdDifferentCardTypeThisTurn: played.thirdDifferentCardTypeThisTurn,\n        completedBeltExam: played.completedBeltExam,\n        noPrintedNumericEffect: structuredCardHasNoPrintedNumericEffect(played.card) === true,\n'''
assert event_anchor in text, 'cardPlayed Character event anchor not found'
text = text.replace(event_anchor, event_replacement, 1)

path.write_text(text)
