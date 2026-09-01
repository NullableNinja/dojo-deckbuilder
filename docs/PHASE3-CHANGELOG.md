# Phase 3 Before/After Change Ledger

This document summarizes the v2.3 uniformity pass. The exact field-level card ledger contains 404 entries in `PHASE3-CARD-CHANGES.json`; the exact rules ledger contains 157 entries in `PHASE3-RULE-CHANGES.json`.

## Published review artifacts

- `Dojo_Deckbuilder_v2.3_Full_Rules.docx` — the complete 45-page rules record, including all eight filed rulings.
- `Dojo_Deckbuilder_v2.3_Quick_Start.docx` — the seven-page table guide.
- `Dojo_Deckbuilder_v2.3_Glossary.docx` — the 59-term reference.
- `Dojo_Deckbuilder_v2.3_Card_Catalog.xlsx` — 597 cards, the exact 500-card main pool, diagnostics, and the 404-entry before/after ledger.

## Approved mechanical changes

| Area | Before | After |
|---|---|---|
| Starting economy | Defenses normally generated no usable printed Focus | Once per Yell, one Defense may be revealed for Defense Practice: printed Focus only, no play/effect/XP/requirement credit |
| Market purchase refill | Draw one random replacement | Reveal two; buyer chooses one for the slot and discards the other |
| Full Market refresh | Seven random cards at setup/end of round | Unchanged; Controlled Refill applies only after purchases |
| Quick Duel vitality | Promotions granted +10 Max HP and healed 5 | Promotions never change Max HP or heal; all non-HP Belt perks remain |
| Tempo | Full rules said +1 Damage; Quick Start/playtest said +1 Attack Power | +1 Attack Power everywhere |
| Boss Guard | Live rule added Guard to the Boss's Attack | Face-up Boss Guard adds Guard to the next matching player Attack against the Boss, then discards |
| Boss Profiles | Rules listed eight | Rules list the ten live Profiles |

## Quick Start changes

- Restored the opening mulligan.
- Added Defense Practice and its non-trigger restrictions.
- Added Controlled Refill.
- Replaced card Damage terminology with printed Attack Power.
- Added the fixed-HP Quick Duel exception.
- Kept the useful information before each joke and aligned the H.I.Y.A.H. phase summaries with the Full Guide.

## Glossary changes

- Expanded from 33 to 59 terms.
- Added Armor, Attack, Attack Power, Blocked, Controlled Refill, Damage, Defense, Defense Practice, Discard, Draw, Equip, Equipment, Exhaust, Focus Value, Guard, Hand Size, Hit, Junk, Kata, Max HP, On Reveal, Printed, Slot, Status Effect, Tag, and Zone.
- Updated Focus, Market, and Tempo Advantage to match v2.3.
- Updated Market Mercy so it composes with Controlled Refill.

## Card changes

- Filled all 101 missing flavor fields.
- Rewrote 58 generic quoted Weapon flavor lines into original Paper-Fu voice.
- Removed three explicit outside-person/property references: Bruce Lee's Nunchaku → Museum-Gift Nunchaku; Miyagi-Do Karate Stick → Parking-Lot Patience Stick; Staff of Master Shifu → Staff of Questionable Lineage.
- Renamed the Consumable Yoyo to Pocket Yoyo so it no longer collides with the Yo-Yo Weapon.
- Standardized the printed combat stat and offensive modifiers as Attack Power. Damage now means HP actually lost after Defense.
- Moved embedded jokes out of 18 rules-text fields and into flavor, without changing their mechanical effect.
- Clarified Advanced Snack Accounting as an explicit post-resolution Focus gain.
- Preserved every Catalog ID. The separate migration ledger prevents the attached v2.2 workbook's shifted Character IDs from silently resolving as the wrong fighter.

## Deferred mechanical candidates

The Phase 2 audit identified these issues, but no unapproved functional change was made: Emergency Turtling's "until your next turn" duration, learned-Combo replacement at the two-Combo cap, Cardboard Cutout versus X-Ray Paper role overlap, and individual power outliers such as Snap Front Kick and Overtime Open-Palm. They remain simulation targets for Phase 4.
