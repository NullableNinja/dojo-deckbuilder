# Starter Deck Controlled Experiment

- Experiment: **starter-deck-experiment-v1**
- Rules revision: **v2.3-r5**
- Matched seeds: **100000–104999**
- Games per variant: **5,000**
- Policy: **baselinePolicy**
- Telemetry: **starter-telemetry-v1**

## Change

Remove one Bad Habit and one High Guard; add the purpose-built Reset Stance Kata and Tactical Refresh non-healing Consumable. Both variants remain 15 cards. The experiment is scenario-only; canonical rules remain unchanged.

## Results

| Metric | Control | Experiment | Delta (experiment − control) |
|---|---:|---:|---:|
| Win rate — Aggression | 52.0% | 51.7% | -0.4 pp |
| Win rate — Fortress | 44.7% | 46.2% | 1.5 pp |
| Average rounds | 11.56 | 9.94 | -1.62 |
| Opening purchase rate | 38.6% | 44.2% | 5.6 pp |
| Early Market engagement | 98.7% | 99.8% | 1.1 pp |
| Katas played/game | 5.667 | 12.123 | 6.456 |
| Consumables played/game | 5.108 | 6.163 | 1.055 |
| Defenses played/game | 40.854 | 31.91 | -8.944 |
| Attacks played/game | 41.106 | 36.694 | -4.412 |
| Skipped affordable offers/game | 111.220 | 103.943 | -7.2776 |

## Reliability

| Metric | Control | Experiment |
|---|---:|---:|
| Completed games | 5000 | 5000 |
| Failed games | 0 | 0 |
| Invariant failures | 0 | 0 |
| Replay mismatches | 0 | 0 |
| Unsupported effects | 0 | 0 |

## Decision

**INSUFFICIENT EVIDENCE** — This report is a controlled measurement artifact. It does not promote the experimental starter deck to canonical rules without review of causal metrics and follow-up tests.
