# Offline Dojo Deckbuilder Simulation

- Rules: **v2.3/v2.3-r5**
- Mode: **quick-duel**
- Games: **10000/10000** completed
- Workers: **8**

## Reliability

| Metric | Result |
|---|---:|
| Failures | 0 |
| Invariant failures | 0 |
| Replay checks | 100 |
| Replay mismatches | 0 |
| Unsupported effects | 0 |
| Unresolved choices | 0 |
| Round-limit games | 166 |

## Game length

Average 11.63 rounds; median 10; p90 19; p95 23; p99 40; max 40.

## Progression and Combos

- Promotions: **78016**; transitions: {"White->Gold":19987,"Gold->Orange":18898,"Orange->Green":16226,"Green->Purple":14898,"Purple->Blue":4904,"Blue->Red":2022,"Red->Brown":1081}
- Final belt distribution: White: 13, Gold: 1089, Orange: 2672, Green: 1328, Purple: 9994, Blue: 2882, Red: 941, Brown: 1081
- Combo opportunities: **47816**; acquisitions: **39951**; owners: **19996**; users: **5938**; activations: **22085**; resolved effects: **11025**

## Families

| Family | Offered/game | Purchased/game | Purchase when offered | Drawn/game | Played/game | Effect applications/play |
|---|---:|---:|---:|---:|---:|---:|
| Attacks | 6.757 | 5.433 | 80.4% | 44.894 | 41.299 | 1.1586 |
| Defenses | 8.526 | 7.089 | 83.2% | 50.163 | 41.012 | 0.1961 |
| Consumables | 5.85 | 4.072 | 69.6% | 6.185 | 5.157 | 1.7655 |
| Katas | 5.833 | 3.583 | 61.4% | 6.462 | 5.671 | 0.9134 |
| Weapons | 6.13 | 2.154 | 35.1% | 1.52 | 1.309 | 7.8028 |
| Defense Equipment | 0.746 | 0.626 | 83.9% | 0.483 | 0.422 | 8.6631 |
| Gear | 2.261 | 1.41 | 62.3% | 1.04 | 0.905 | 9.7453 |
| Reaction Items | 0.936 | 0.717 | 76.5% | 1.368 | 1.188 | 0.1445 |
| Combos | 4.782 | 0 | 0.0% | 0 | 0 | 0 |

## Consumables

Consumables: 5.85 offered/game, 4.072 purchased/game, 69.6% purchase rate when offered, 6.185 drawn/game, 5.157 played/game, 2.5% discarded/drawn.

The JSON and JSONL outputs contain the full machine-readable telemetry selected by the run. Winner association is correlation only.
