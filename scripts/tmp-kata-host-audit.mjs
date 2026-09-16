import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync(new URL("../content/card-effects/katas.json", import.meta.url), "utf8")).cards ?? {};
const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards ?? [];
const cardByCatalog = new Map(cards.map((card) => [card.catalogId, card]));
const hostFiles = ["app/playtest.tsx", "app/effect-resolvers.ts", "app/kata-playtest-bridge.ts"];
const host = hostFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const resolverKind = {
  "kata.conditional": "apply", "kata.attackModifier": "apply", "kata.defenseModifier": "apply", "kata.nextAttackPiercing": "apply", "kata.linkedAttackOutcome": "apply", "kata.cardTypeThreshold": "apply", "kata.branch": "branch/apply",
  "kata.deferredConditional": "armDeferredConditional", "kata.deferredEvent": "resolveDeferredEvent", "kata.discardBranch": "resolveDiscardBranch", "kata.flowGrant": "grantFlow", "kata.destroyChoice": "chooseAndDestroy", "kata.purchaseDiscount": "armPurchaseDiscount", "kata.choice": "promptChoice", "kata.equipmentActivation": "promptEquipmentActivation", "kata.deckLook": "resolveDeckLook", "kata.attackRestriction": "armAttackRestriction", "kata.equipmentChoice": "promptEquipmentChoice", "kata.controlledEscalation": "armControlledEscalation", "kata.revealUntil": "revealUntilMatch", "kata.zoneOverride": "armZoneOverride", "kata.zoneAttackReward": "armZoneAttackReward", "kata.recycle": "recycleDiscardCard", "kata.markCard": "markCardForReward", "kata.damagePrevention": "armDamagePrevention", "kata.copyKata": "copyLastOpponentKata", "kata.recoverThenDiscard": "recoverThenDiscard", "kata.comboHitReward": "resolveComboHitReward", "kata.comboDiscount": "armComboDiscount", "kata.variableCycle": "promptVariableCycle", "kata.threeZonePlan": "armThreeZonePlan", "kata.equipFromHand": "equipFromHand", "kata.weaponModifier": "armWeaponModifier",
};
const rows = [];
for (const [catalogId, card] of Object.entries(registry)) {
  for (const effect of card.effects ?? []) {
    const resolver = effect.resolver ?? "generic";
    const kind = resolverKind[resolver] ?? (resolver === "generic" ? "generic" : "unknown");
    rows.push({ catalogId, name: card.name, effectId: effect.id, trigger: effect.trigger, action: effect.action, duration: effect.duration ?? "immediate", resolver, commandKind: kind, resolverHostRefs: resolver === "generic" ? null : host.split(resolver).length - 1, kindHostRefs: ["generic","apply","branch/apply"].includes(kind) ? null : host.split(kind).length - 1 });
  }
}
const byResolver = {};
for (const row of rows) { const key=row.resolver; byResolver[key] ??= {resolver:key,commandKind:row.commandKind,effects:0,cards:new Set(),resolverHostRefs:row.resolverHostRefs,kindHostRefs:row.kindHostRefs,effectIds:[]}; byResolver[key].effects++; byResolver[key].cards.add(`${row.catalogId}:${row.name}`); byResolver[key].effectIds.push(row.effectId); }
const summary = Object.values(byResolver).map((entry)=>({...entry,cards:[...entry.cards]})).sort((a,b)=>(a.kindHostRefs??999)-(b.kindHostRefs??999)||a.resolver.localeCompare(b.resolver));
console.log("KATA_SUMMARY=" + JSON.stringify(summary));
console.log("SEMANTIC_WITH_NO_KIND_HOST=" + JSON.stringify(summary.filter((entry) => ![null,undefined].includes(entry.kindHostRefs) && entry.kindHostRefs === 0)));
const directResolvers = new Set(["kata.conditional","kata.branch","kata.attackModifier","kata.defenseModifier","kata.nextAttackPiercing","kata.cardTypeThreshold","kata.linkedAttackOutcome"]);
const directIds = [...new Set(rows.filter((row)=>directResolvers.has(row.resolver)).map((row)=>row.catalogId))];
console.log("DIRECT_CARD_RULES=" + JSON.stringify(directIds.map((catalogId)=>{ const c=cardByCatalog.get(catalogId); return {catalogId,name:c?.name,rulesText:c?.rulesText,focusValue:c?.focusValue}; })));
