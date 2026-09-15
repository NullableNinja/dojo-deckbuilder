from pathlib import Path
import json

# Canonical Character source: add the missing Green-belt linked XP effect.
p = Path('content/card-effects/characters.json')
data = json.loads(p.read_text())
ronin = data['cards']['DDB-CHR-CORE-029']
effects = ronin['effects']
assert any(e.get('resolver') == 'character.revealReplacementOnceGame' for e in effects)
if not any(e.get('resolver') == 'character.green.linkedLocationReplacementXp' for e in effects):
    effects.append({
        'id': 'character-ronin-green-location-xp',
        'effect': 'core.gainXP',
        'trigger': 'passive',
        'target': 'self',
        'amount': 1,
        'duration': 'immediate',
        'resolver': 'character.green.linkedLocationReplacementXp',
    })
p.write_text(json.dumps(data, separators=(',', ':')) + '\n')

# Runtime event contract + resolver ownership.
p = Path('app/character-runtime.ts')
text = p.read_text()
text = text.replace(
    '| "kataPlayed" | "comboReveal" | "purchaseAttempt" | "promotion" | "sceneChange" | "reboot" | "hide";',
    '| "kataPlayed" | "comboReveal" | "purchaseAttempt" | "promotion" | "sceneChange" | "reveal" | "reboot" | "hide";'
)
text = text.replace(
    '  replacementId?: string | null;\n',
    '  replacementId?: string | null;\n  revealSource?: "market" | "location";\n  replacementAvailable?: boolean;\n  replacementRequested?: boolean;\n  replacementResolved?: boolean;\n'
)
text = text.replace(
    '  "character.revealReplacementOnceGame": ["sceneChange", "purchaseAttempt"],',
    '  "character.revealReplacementOnceGame": ["reveal"],\n  "character.green.linkedLocationReplacementXp": ["reveal"],'
)
old = '''      case "character.revealReplacementOnceGame": {\n        if (!event.replacementId) break;\n        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);\n        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted"));\n        else if (accept) { event.selectedId = event.replacementId; activated = true; }\n        break;\n      }'''
new = '''      case "character.revealReplacementOnceGame": {\n        if (!event.card || !event.revealSource || !event.replacementAvailable || event.replacementResolved) break;\n        const accept = event.optionalAccepted ?? (actor === "ai" ? true : undefined);\n        if (accept === undefined) choices.push(makeChoice(effect, "Discard this reveal and replace it from the same deck?", ["accept", "skip"], true, "optionalAccepted"));\n        else if (accept) { event.replacementRequested = true; activated = true; }\n        break;\n      }\n      case "character.green.linkedLocationReplacementXp":\n        if (event.replacementResolved && event.revealSource === "location") { self = { ...self, xp: self.xp + amount }; activated = true; }\n        break;'''
assert old in text, 'Ronin resolver block not found'
text = text.replace(old, new, 1)
p.write_text(text)
