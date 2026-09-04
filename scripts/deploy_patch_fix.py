from pathlib import Path

patch = Path("scripts/deploy_patch.py")
code = compile(patch.read_text(), str(patch), "exec")
exec(code, {"__name__": "__main__", "__file__": str(patch)})

play = Path("app/playtest.tsx")
text = play.read_text()
old = '''<small>{plan.kind === "incoming-zone-penalty" ? `Call a zone · -${plan.attackPowerPenalty} Attack Power on a match` : `Your Defense gets +${plan.guard} Guard${plan.reversalPower ? " · Green+ Block boosts Reversal" : ""}`}</small>'''
new = '''<small>{plan.kind === "incoming-zone-penalty" ? `Call a zone · -${plan.attackPowerPenalty} Attack Power on a match` : plan.kind === "defense-guard" ? `Your Defense gets +${plan.guard} Guard${plan.reversalPower ? " · Green+ Block boosts Reversal" : ""}` : "Unsupported activation"}</small>'''
if old not in text:
    raise SystemExit("Reaction tray narrowing anchor missing after queued patch")
play.write_text(text.replace(old, new, 1))

Path("scripts/deploy_patch_fix.py").unlink(missing_ok=True)
