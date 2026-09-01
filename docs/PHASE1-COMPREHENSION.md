# Phase 1 · Source Comprehension Record

## Canonical source

The live companion and repository were treated as authoritative. The uploaded v2.0 Full Rules, v2.0 Quick Start, v2.2 workbook, and Character archive were cross-checked, not silently merged.

The live catalog contained 597 records: 183 Techniques, 209 Items, 55 Combos, 53 Locations, 41 Characters, 32 Boss Arsenal cards, 10 Boss Profiles, 11 Starter records, and 3 Boss Stages. The main purchasable design pool is the 500 Technique, Item, Combo, and Location cards; the seven-card Market itself uses the 392 Technique and Item cards.

## Rules model

- Modes: Tag Team, Standard Clash, Quick Duel, and Boss Blitz.
- Round: Honor once, then each player completes Initiate, Yell, Ascend, and Hide.
- Combat: printed Attack Power + Character ATK + modifiers against Character DEF + matching Guard/Armor + modifiers; the remainder is Damage.
- Economy: cards legally played or Equipped generate printed Focus; Focus is spent in Ascend and expires at the player's next Hide.
- Progression: XP plus promotion tasks drive Belts; Quick Duel wins by knockout rather than Black Belt.
- Deckbuilding: seven-card mixed Technique/Item Market, separate Combo learning, separate Locations, and Boss-specific decks.

## Cross-source discrepancies

- The uploaded workbook had 598 rows while the live catalog had 597, with 578 field differences. Character IDs had shifted and were unsafe to map by ID alone. `app/data/catalog-migrations.json` records the migration.
- The uploaded v2.0 documents predated the live Golden Rule, current mode table, H.I.Y.A.H. summary, companion-hosted glossary/house rules, and several Boss/timing rulings.
- Full Rules, Quick Start, and the playtest disagreed on Tempo (+1 Damage versus +1 Attack Power), Quick Duel promotion HP, and Boss Guard application.
- The original glossary had 33 entries while cards used many undefined rules terms. The v2.3 glossary has 59 defined terms; descriptive tags remain metadata rather than automatically becoming keywords.
- House rules mostly exposed pressure points—Market accessibility and pacing—rather than merely adding novelty.

## Phase 1 outputs carried forward

The normalized current sources are `app/data/rules.json` and `app/data/cards.json`. Exact Phase 3 changes are separately reviewable in the two JSON ledgers, and the generated spreadsheet supplies the complete card index and filtered subcatalogs.
