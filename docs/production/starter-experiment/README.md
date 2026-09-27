# Starter experiment physical cards

These layered OpenRaster archives are production-ready layouts for the controlled starter-deck experiment `starter-deck-experiment-v1`:

- `DDB-STA-EXP-001-reset-stance.ora` — Reset Stance, a low-complexity Kata.
- `DDB-STA-EXP-002-tactical-refresh.ora` — Tactical Refresh, a non-healing Consumable.

The layouts preserve the official local masters from `Templates/Card Templates/04_Kata.ora` and `06_Item_Consumable.ora`, including the 825×1125 canvas, layer structure, card frame, type tab, starter tag, chips, and rules panel. PNG previews are provided under `previews/`.

Artwork is intentionally marked pending. Before print approval, replace only the `ARTWORK — replace this group` layers in each `.ora`; do not alter the rules text, type, card ID, or starter tag without updating the scenario and manifest.

Regenerate with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-starter-experiment-card-assets.ps1
```
