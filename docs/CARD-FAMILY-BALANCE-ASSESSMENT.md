# Card-Family Balance Assessment

## Executive assessment

The human impression is **partially corroborated**.

- Attacks and Defenses are not an extreme share of the market pool, but they dominate the cards players actually see and play. In the final 20,000-game run, they were 41.1% of tracked family offers, 89.8% of tracked family draws, and 89.5% of tracked family plays.
- The main cause is structural: the fixed 15-card starter deck contains four attacks, four defenses, two katas, and five Bad Habits. Consumables and equipment start at zero copies, so they must first be purchased and then drawn.
- Katas are not being ignored once acquired: they were played 1.49 times/game versus 1.08 for Consumables, with a lower unused-discard proxy (2.4% versus 3.4%). Their weaker presence is primarily acquisition and deck-access pressure.
- The claim that non-healing Consumables are mostly useless is not established by the current telemetry. Consumables were played 21,548 times, averaged 1.92 effect applications/play, and had only a 3.4% discarded/drawn proxy. However, effect applications are not the same as player-perceived value, so the simulator needs impact telemetry before a balance conclusion is made.

## Final certification run

Source: `post-tuning-certification-20000.json`, rules `v2.3-r5`, Quick Duel, 20,000 completed games.

| Family | Market offers/game | Offer share | Purchased/game | Purchase when offered | Drawn/game | Played/game | Effect applications/play |
|---|---:|---:|---:|---:|---:|---:|---:|
| Attack | 3.547 | 18.2% | 2.739 | 77.2% | 23.492 | 20.284 | 1.127 |
| Defense | 4.461 | 22.9% | 3.435 | 77.0% | 24.116 | 15.155 | 1.181 |
| Consumable | 3.084 | 15.8% | 1.464 | 47.5% | 1.480 | 1.077 | 1.920 |
| Kata | 3.070 | 15.8% | 1.397 | 45.5% | 1.888 | 1.490 | 0.942 |
| Weapon | 3.226 | 16.6% | 1.272 | 39.4% | 1.138 | 0.931 | 1.947 |
| Defense Equipment | 0.400 | 2.1% | 0.240 | 60.1% | 0.202 | 0.171 | 3.217 |
| Gear | 1.195 | 6.1% | 0.478 | 40.0% | 0.466 | 0.392 | 3.327 |
| Reaction Item | 0.500 | 2.6% | 0.210 | 41.9% | 0.272 | 0.093 | 0.884 |

The offer/draw/play percentages above exclude `Other` starter/runtime cards and the separate learned Combo deck. They are therefore best read as a comparison of the tracked purchasable families, not as a complete deck composition.

## What the data supports

### 1. Attacks and Defenses overshadow the other families in play

Yes. This is real in the observed play loop, but it is not primarily caused by the market pool. The starter deck supplies the opening combat density, and the rules make Attacks and Defenses the repeated response loop. A market offer share near 16% for Katas and Consumables cannot compensate for zero starting copies and low purchase rates around 45–48%.

### 2. Katas are underrepresented, but not simply dead cards

Katas were purchased and played at roughly the same order of magnitude as Consumables, and their discarded/drawn proxy was lower. Their issue is that they compete for Focus and deck access while usually producing less immediate, countable value than an attack or defense. The next experiment should improve Kata decision density rather than simply add more Kata identities.

### 3. Consumables are under-acquired, but “useless” is not proven

The simulator does not currently measure the counterfactual value of a Consumable: what would have happened if the player had held it, played it one turn earlier, or used a different card instead. The available evidence says they are usually played after being drawn, not that they are intrinsically strong or weak. Human perception may be reacting to low visibility, conditional timing, or effects whose benefit is not immediately legible.

### 4. Defense may be functionally too strong

In the tuned certification policy, the Fortress strategy won 65.96%, compared with 42.98% Aggression, 43.84% Economy, and 47.22% Balanced. This is a balance signal worth investigating, although strategy-specific AI weighting means it is not yet a proof that Defense cards need nerfs. It does justify a controlled Defense-versus-Kata/Consumable experiment.

## Recommended mechanics direction

Do not add unconditional card draw to every card family. Use small, conditional forms of the existing core mechanics so that each family creates a distinct decision.

- **Katas:** prioritize flow and setup. Good candidates are draw 1 then discard 1, conditional Focus generation, zone/stance manipulation, or a bonus to the next attack/defense when a Kata is followed by the matching action. These effects make Katas improve the next decision instead of competing with the combat cards on raw immediate output.
- **Attacks:** reserve draw for attacks that hit, use a different zone, or complete a sequence. A hit-triggered draw or “draw then discard” effect makes successful attacks create momentum without making every attack a cantrip.
- **Defenses:** use successful blocks for filtering, Focus, or a temporary setup bonus. Avoid broad unconditional draw on defense; defense already has high access and a high Fortress win rate, so self-replacing defenses could increase stall and defensive snowballing.
- **Consumables:** make the benefit immediate and visible. Strong candidates are draw/filter, Focus conversion, next-attack or next-defense preparation, temporary removal of a bad hand card, or flexible timing. Non-healing Consumables should answer a clear tactical problem rather than provide an opaque delayed effect.

## Safest next experiments

1. **Starter-access experiment:** keep the market unchanged, replace one starter Defense and one Bad Habit with one Kata and one non-healing Consumable. Compare first-three-round play rates and win rate.
2. **Kata-flow experiment:** add a modest conditional draw/filter effect to a limited Kata subset. Measure whether Kata purchase rate and play rate rise without increasing round length materially.
3. **Consumable-legibility experiment:** give a limited subset of non-healing Consumables immediate draw/filter or Focus value. Compare play timing, hold duration, and win rate against matched controls.
4. **Defense stress test:** run the same experiments with Fortress weighting removed or equalized. If Fortress remains near 66%, investigate Defense power and block economics; if it falls sharply, the issue is primarily policy valuation.

## Telemetry needed before a final rebalance

Add per-card and per-play fields for: playable-in-hand opportunities, turns held before play, immediate HP/Focus/deck-size delta, cards drawn and discarded, damage/prevention in the next two actions, whether the card prevented lethal damage, and a matched “available but skipped” control. This will distinguish “not seen,” “not affordable,” “not playable,” and “played but low impact.”

## Certification health

The final run completed 20,000/20,000 games with zero invariant failures, zero illegal actions, zero unsupported effects, zero unresolved choices, zero stalls, and zero replay mismatches across 200 replay checks. The raw per-game JSONL trace was intentionally removed after analysis to reclaim disk space; the compact certification summary is retained externally.

## Simulator improvements

The simulator now exposes eight explicit archetypes: Balanced, Aggression, Economy, Fortress, Kata Specialist, Tempo, Control, and Cleanup. They change purchase scoring, utility-card timing, defense/reaction thresholds, equipment priorities, and willingness to thin Junk. The baseline policy remains deterministic and replayable; the archetype mix supplies behavioral diversity without hidden-information targeting.

Simulation runs now emit machine-readable `SIM_PROGRESS` milestones and the desktop Simulation Control displays them as a progress bar. Destruction telemetry distinguishes total destruction, Junk destruction, destruction chosen through a target choice, and source-card self-destruction. No card definitions were edited for these changes, so the card-template regeneration workflow was not invoked.
