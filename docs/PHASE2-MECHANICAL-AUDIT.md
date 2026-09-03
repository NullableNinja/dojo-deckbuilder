# Phase 2 · Prioritized Mechanical Audit

## 1. Starting Focus economy — major

The 392-card Market averages 4.40 Focus; only 15 cards cost 2. A random seven-card row has a 75.9% chance of containing no cost-2 card and an 11.9% chance of containing nothing costing 3 or less. Before a fix, an opening hand generated about 2.00 reliably playable Focus (2.35 under a favorable Footwork assumption), producing only a 33.7%–45.6% raw first-turn purchase chance.

Root cause: five Bad Habits occupy one-third of the starter deck, Defenses could not productively convert into buying power on the active turn, and Market prices begin above the typical usable hand.

Approved fix: Defense Practice, once per Yell. Reveal one Defense for its printed Focus only; it is not played, supplies no Guard or text, awards no XP, and satisfies no requirement. Exact opening-hand analysis estimated a 74.4% raw purchase chance before interaction. The rules-engine simulation is harsher because Defenses spent in Reaction Windows are unavailable for Practice: it observes 28.1% round-one purchasing versus 8.9% with Practice disabled. This is a major improvement, not a complete cure.

## 2. Random Market agency — major friction

A seven-card row can omit entire tactical categories: no Defense 38.2%, no Gear 64.0%, and no Reaction Item 80.3%. Pure random single-card refill compounds dead or irrelevant rows.

Approved fix: keep a mixed seven-card row, but after a purchase reveal two cards, choose one for the slot, and discard the other. The full row still refreshes randomly at the end of the round. This improves agency without turning setup into a curated tableau.

## 3. Quick Duel promotion vitality — major

Normal Belt Max-HP/heal rewards undermine a knockout-only short mode and can reverse more damage than early decks can reliably deal.

Superseded by v2.3-r3: Quick Duel now uses every printed Belt reward, including +10 Max HP and promotion healing.

## Other resolved contradictions

- Tempo is +1 Attack Power, not +1 post-defense Damage.
- Boss Guard protects the Boss against the next matching player Attack; it does not increase the Boss's Attack.
- Current Speed determines comparisons; Honor locks turn order for the round.
- Ten live Boss Profiles replace the obsolete count of eight.

## Secondary risks retained for testing

- Long-duration defensive effects such as Emergency Turtling.
- Learned-Combo replacement at the two-Combo cap.
- Cardboard Cutout versus X-Ray Paper role overlap.
- Individual outliers including Snap Front Kick and Overtime Open-Palm.
- The large special-effect surface: raw stat simulations understate deck acceleration and finishing power until the effect DSL expands.

## What works

The H.I.Y.A.H. phase mnemonic gives the game a memorable table rhythm. Zones make combat legible without a board. Belt tasks turn advancement into behavior rather than passive points. Separate Combos create visible build goals, and the bureaucratic martial-arts premise naturally supports rules reminders, card jokes, and modular scenario escalation.
