# Quick Duel Production Mat

Status: approved implementation contract
Branch: `feature/playtest-production-mat`
Rules authority: current canonical `content/*` sources on the branch base

## Product thesis

Quick Duel should feel like a Paper-Fu match assembled on a designed tabletop: clear paper objects, live fighter cards, one obvious combat stage, and a small amount of physical imperfection. Interaction remains quick and deterministic; tactile presentation never obscures a rule or delays a choice.

## Approved experience

- Use a designed tabletop rather than a literal craft-table simulation.
- Build the player as a large living fighter card from the supplied transparent character art; use a compressed inward-facing version for the opponent.
- Keep HP, Belt/XP, ATK, DEF, Speed, statuses, and Equipment on or immediately attached to each fighter card. Do not duplicate those values in a separate dossier HUD.
- Present playable cards as hybrid objects: existing card art when available, canonical metadata and live state in HTML, and an honest Paper-Fu fallback where finished art is unavailable.
- Make click/tap the primary interaction, hover an enhancement, and drag-to-stage an optional equivalent. Every action must remain keyboard accessible.
- Stage meaningful combat as a short visual sentence: declare, meet in the center, resolve, return or file. Routine bookkeeping is condensed and never blocks input.
- Attach Equipment to visible slot bands around its fighter. Collapse overflow without hiding ownership, slot, or exhausted state.
- Keep the seven-card shared Market visible as a compact board-edge rail and unfold it during Ascend. Combo and Belt review remain neighboring tabletop objects in the required Market → Combo → Belt → Hide order.
- Let Locations subtly alter the mat palette, doodles, and edge props while keeping the active rule readable.
- Pin one compact last-exchange receipt. Group older events in a collapsible timeline. Coaching is contextual, starts enabled for new players, and remembers when the player disables it.

## Non-negotiable play constraints

- Preserve current Quick Duel mechanics, canonical card text, action legality, explicit player choices, AI behavior, save compatibility, and rules-revision checks.
- Preserve the stationary center mat, independently scrolling fighter rails, single-row played-card ledgers, inward-facing opponent layout, and block-flow separation between arena and hand.
- Preserve one primary action surface. Secondary utilities cannot compete with the current legal action.
- Desktop is the complete public field-test surface. Compact desktop and tablet layouts must remain usable; the existing phone notice remains until a separate mobile-play scope is approved.
- Full, reduced, and off motion modes remain available. Reduced motion must preserve event order and meaning without travel or shake.

## Implementation boundaries

1. Add a presentation adapter that converts live match state into stable fighter, card, stage, Market, progression, and event view models.
2. Replace the dossier-style fighter panels with living fighter-card components using the supplied transparent artwork.
3. Recompose the arena around fighter anchors, a central clash stage, attached loadouts, Location skinning, a persistent acquisition rail, and the last-exchange receipt.
4. Upgrade hand and Market cards with live state badges, inspect affordances, keyboard focus, and optional drag intent without changing click behavior.
5. Move combat feedback onto the participating cards and center stage. Stop deriving presentation-critical facts from prose logs where typed state exists.
6. Consolidate the live-mat layout rules into one production stylesheet instead of extending the historical override chain.
7. Add regression coverage for semantics, accessibility hooks, responsive ownership, event ordering, and the approved visual structure.

## Baseline issues kept separate

- The branch base already has generated `content/card-effects.json` drift from its effect-family sources. Regeneration is maintenance, not a gameplay change, and will be committed separately if required for a green gate.
- The supplied workbook lists Wild Swing at 1 Focus while canonical `main` lists 2. The implementation preserves canonical 2 Focus and does not alter card content.
- The supplied DOCX files are obsolete and are not design or rules authorities.
