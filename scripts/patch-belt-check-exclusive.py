from pathlib import Path

path = Path("app/playtest.tsx")
source = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    source = source.replace(old, new, 1)


import_anchor = 'import { QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT, spendQuickDuelTrainingStripeForHealing } from "./quick-duel-training-stripes.ts";\n'
import_line = 'import { markQuickDuelBeltCheckAction, quickDuelBeltCheckActionAvailability } from "./quick-duel-belt-check-actions.ts";\n'
if import_line not in source:
    if import_anchor not in source:
        raise SystemExit("Belt Check import anchor not found")
    source = source.replace(import_anchor, import_anchor + import_line, 1)

old_promote = '''  const promote = () => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.player.belt >= belts.length - 1) return current;
    const next = belts[current.player.belt + 1];
    if (current.player.xp < beltThresholds[current.player.belt + 1] || !current.player.completedTasks.includes(current.player.belt + 1)) return current;
    const nextPlayer = applyBeltPromotion(current.player, current.player.belt + 1);
    const vitality = nextPlayer.maxHp > current.player.maxHp ? ` Max HP ${current.player.maxHp} → ${nextPlayer.maxHp}; current HP ${current.player.hp} → ${nextPlayer.hp}.` : "";
    return write(current, `Certification approved: ${next.name} Belt. ${next.reward.summary}${next.reward.onPromotionFocus ? ` +${next.reward.onPromotionFocus} Focus.` : ""}${vitality}`, { player: nextPlayer });
  });
'''
new_promote = '''  const promote = () => setMatch((current) => {
    if (!current || current.phase !== "player-ascend" || current.player.belt >= belts.length - 1) return current;
    const next = belts[current.player.belt + 1];
    if (current.player.xp < beltThresholds[current.player.belt + 1] || !current.player.completedTasks.includes(current.player.belt + 1)) return current;
    if (!quickDuelBeltCheckActionAvailability(current, "player", "promote").canUse) return current;
    const nextPlayer = applyBeltPromotion(current.player, current.player.belt + 1);
    const vitality = nextPlayer.maxHp > current.player.maxHp ? ` Max HP ${current.player.maxHp} → ${nextPlayer.maxHp}; current HP ${current.player.hp} → ${nextPlayer.hp}.` : "";
    const promoted = markQuickDuelBeltCheckAction({ ...current, player: nextPlayer }, "player", "promote");
    return write(promoted, `Certification approved: ${next.name} Belt. ${next.reward.summary}${next.reward.onPromotionFocus ? ` +${next.reward.onPromotionFocus} Focus.` : ""}${vitality}`);
  });
'''
replace_once(old_promote, new_promote, "promote handler")

old_can = '  const canPromote = Boolean(nextBelt && player.xp >= nextBeltXp && playerTask);\n'
new_can = '  const promotionAction = quickDuelBeltCheckActionAvailability(match, "player", "promote");\n  const canPromote = Boolean(nextBelt && player.xp >= nextBeltXp && playerTask && promotionAction.canUse);\n'
replace_once(old_can, new_can, "canPromote")

old_help = '      ? "Check your XP and Belt Exam requirement. Promote if you qualify. This is the final review before Hide clears unspent Focus."\n'
new_help = '      ? "Check your XP and Belt Exam requirement. If eligible, choose either promotion or Training Stripe recovery; taking either uses this turn\'s Belt Check action."\n'
replace_once(old_help, new_help, "Belt Check help")

old_button = '            {nextBelt && <button className="button primary" disabled={match.phase !== "player-ascend" || !canPromote} onClick={promote}>{canPromote && match.phase === "player-ascend" ? `Promote to ${nextBelt.name} →` : match.phase !== "player-ascend" ? "Promotion opens during Ascend" : `${nextBelt.name}: ${nextBeltXp} XP + completed task`}</button>}\n'
new_button = '            {nextBelt && <button className="button primary" disabled={match.phase !== "player-ascend" || !canPromote} onClick={promote}>{canPromote && match.phase === "player-ascend" ? `Promote to ${nextBelt.name} →` : match.phase !== "player-ascend" ? "Promotion opens during Ascend" : !promotionAction.canUse ? "Belt Check action used · promotion next turn" : `${nextBelt.name}: ${nextBeltXp} XP + completed task`}</button>}\n'
replace_once(old_button, new_button, "promotion button")

path.write_text(source)
