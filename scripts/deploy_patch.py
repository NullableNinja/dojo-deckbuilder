from pathlib import Path
import json, re
from collections import Counter, defaultdict

root = Path('.')
cards_path = root / 'app/data/cards.json'
report_path = root / 'reports/card-effect-audit.json'
summary_path = root / 'reports/card-effect-audit.md'

data = json.loads(cards_path.read_text())
cards = data.get('cards', [])

NO_EFFECT = re.compile(r'^(?:No (?:additional )?effect|—|-)[.]?$', re.I)

def sentence_timing(sentence):
    if re.search(r'^(?:if (?:this|it|that (?:Attack|Defense)) Blocks?|when (?:this|that) Blocks?)', sentence, re.I): return 'onBlock'
    if re.search(r'^(?:on Hit|if (?:this Attack|it|that Attack) Hits?|when (?:this|that) Hits?)', sentence, re.I): return 'onHit'
    if re.search(r'^after (?:this|it|that (?:card|Attack|Defense)) resolves', sentence, re.I): return 'afterResolve'
    if re.search(r'^(?:Draw|Discard|Gain|Heal|Lose|Your next|The next|Use\s*[:—-])', sentence, re.I): return 'onPlay'
    return None

def operations(sentence):
    found = []
    patterns = [
        ('draw', r'draw (\d+) cards?'),
        ('discard', r'discard (\d+) cards?'),
        ('heal', r'heal (\d+) HP?'),
        ('focus', r'gain \+?(\d+) Focus'),
        ('speed+', r'gain \+?(\d+) Speed'),
        ('speed-', r'lose (\d+) Speed'),
        ('nextAttackPower', r'next (?:unarmed )?Attack[^.]*?(?:gets|gains?) \+(\d+) (?:Attack Power|damage)'),
    ]
    for name, pattern in patterns:
        if re.search(pattern, sentence, re.I): found.append(name)
    return found

def normalize(sentence):
    s = re.sub(r'\b\d+\b', 'N', sentence)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

keyword_groups = {
    'choice_optional': r'\b(?:may|choose|up to|either|one of|optionally|instead)\b',
    'opponent_target': r'\b(?:opponent|target|fighter)\b',
    'attack_power_damage_guard': r'\b(?:Attack Power|Damage|Guard)\b',
    'flow': r'\bFlow\b',
    'piercing': r'\bPiercing\b',
    'equipment': r'\b(?:Equipment|equip|equipped|Weapon|Armor|Gear)\b',
    'deck_discard_hand': r'\b(?:deck|discard pile|discard|hand|top card|bottom)\b',
    'market_combo': r'\b(?:Market|Combo|purchase|buy|cost)\b',
    'tempo_speed': r'\b(?:Tempo|Speed|initiative)\b',
    'zone': r'\b(?:High|Mid|Low|Zone)\b',
    'conditional_state': r'\b(?:if|when|after|before|first|next|this turn|this round|until|while|for each|for every|per)\b',
    'copy_reveal_look': r'\b(?:copy|reveal|look at|inspect|name a card)\b',
    'xp_belt': r'\b(?:XP|Belt|promote|certif)\w*\b',
    'heal_hp': r'\b(?:heal|HP|Max HP)\b',
}

records = []
unsupported_patterns = Counter()
unsupported_examples = defaultdict(list)
keyword_counts = Counter()
status_counts = Counter()

for card in cards:
    text = str(card.get('rulesText') or '').strip()
    if not text or NO_EFFECT.match(text):
        continue
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', re.sub(r'\s+', ' ', text)) if s.strip()]
    parsed_count = 0
    unsupported = []
    parsed = []
    for sentence in sentences:
        timing = sentence_timing(sentence)
        ops = operations(sentence) if timing else []
        if timing and ops:
            parsed_count += 1
            parsed.append({'sentence': sentence, 'timing': timing, 'operations': ops})
        else:
            unsupported.append(sentence)
            pattern = normalize(sentence)
            unsupported_patterns[pattern] += 1
            if len(unsupported_examples[pattern]) < 5:
                unsupported_examples[pattern].append({'id': card.get('catalogId') or card.get('id'), 'name': card.get('name'), 'sentence': sentence})
            for group, regex in keyword_groups.items():
                if re.search(regex, sentence, re.I): keyword_counts[group] += 1
    status = 'full' if parsed_count and not unsupported else 'partial' if parsed_count else 'queued'
    status_counts[status] += 1
    records.append({
        'id': card.get('catalogId') or card.get('id'),
        'name': card.get('name'),
        'type': card.get('cardType'),
        'subtype': card.get('subtype'),
        'status': status,
        'parsed': parsed,
        'unsupported': unsupported,
    })

report = {
    'catalog_cards_with_rules': len(records),
    'coverage': dict(status_counts),
    'unsupported_sentence_count': sum(len(r['unsupported']) for r in records),
    'unsupported_keyword_groups': keyword_counts.most_common(),
    'top_unsupported_patterns': [
        {'pattern': pattern, 'count': count, 'examples': unsupported_examples[pattern]}
        for pattern, count in unsupported_patterns.most_common(120)
    ],
    'cards': records,
}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2) + '\n')

lines = [
    '# Card Effect Automation Audit', '',
    f"Cards with printed rules: **{len(records)}**", '',
    f"- Fully parsed: **{status_counts['full']}**",
    f"- Partially parsed: **{status_counts['partial']}**",
    f"- Dedicated resolver still required: **{status_counts['queued']}**",
    f"- Unsupported sentences: **{report['unsupported_sentence_count']}**", '',
    '## Unsupported wording by mechanic', '',
]
for group, count in keyword_counts.most_common():
    lines.append(f'- {group}: **{count}**')
lines += ['', '## Most common unsupported patterns', '']
for pattern, count in unsupported_patterns.most_common(40):
    example = unsupported_examples[pattern][0]
    lines.append(f"- **{count}×** `{pattern}` — {example['name']} ({example['id']})")
summary_path.write_text('\n'.join(lines) + '\n')

# Add a regression test so the audit remains reproducible and never silently disappears.
test_path = root / 'tests/card-effect-audit.test.mjs'
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\ntest("card effect automation audit is generated from the live catalog", async () => {\n  const report = JSON.parse(await readFile(new URL("../reports/card-effect-audit.json", import.meta.url), "utf8"));\n  assert.ok(report.catalog_cards_with_rules >= 500);\n  assert.ok(report.coverage.full >= 1);\n  assert.ok(report.coverage.queued >= 1);\n  assert.ok(Array.isArray(report.top_unsupported_patterns));\n});\n''')
