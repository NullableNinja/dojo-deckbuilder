import fs from "node:fs";
import { consumableRuntimeCommands } from "../app/consumable-effect-resolvers.ts";

const cards = JSON.parse(fs.readFileSync(new URL("../app/data/cards.json", import.meta.url), "utf8")).cards ?? [];
const effects = JSON.parse(fs.readFileSync(new URL("../content/card-effects/consumables.json", import.meta.url), "utf8")).cards ?? {};
const cardById = new Map(cards.map((card) => [card.catalogId, card]));
const hostFiles = [
  "app/playtest.tsx",
  "app/stage3c-consumable-attack-followup.ts",
  "app/stage3c-consumable-hide-followup.ts",
  "app/stage3c-consumable-event-reactions.ts",
  "app/stage3c-consumable-surface.ts",
  "app/stage3c-board-command-semantics.ts",
  "app/stage3c-consumable-play-window.ts",
  "app/stage3c-consumable-reaction-ai.ts",
];
const hostSource = hostFiles.map((path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "").join("\n");
const context = {
  hpThresholdMet: true,
  hasTempo: true,
  handEmptyAfterHeal: true,
  normalAttacksResolvedThisTurn: 3,
  reactionItemUsedSinceLastTurn: true,
  temporaryNegativeModifierPresent: true,
  removedTemporaryNegativeModifier: true,
  nextAttackBlocked: true,
  interferencePrevented: false,
  chosenFriendlyIsBenched: false,
  chosenFriendlyIsConscious: true,
  sameTurnSourceActive: true,
  discardedCount: 2,
  revealedFocusValue: 3,
  revealedDifferentTypeCount: 3,
  friendlyTargetCount: 2,
  opponentTargetCount: 2,
  junkDestroyed: true,
  selectedEquipmentSubtype: "Weapon",
};
const triggers = ["onPlay", "afterResolve", "onHide", "passive", "onHit", "onBlock", "onAttackDeclared", "onDefenseDeclared", "onInitiate", "onPurchase", "onEquip"];
const rows = [];
for (const [catalogId, entry] of Object.entries(effects)) {
  const card = cardById.get(catalogId) ?? { catalogId, name: entry.name };
  for (const effect of entry.effects ?? []) {
    if (!effect.resolver) continue;
    const commands = triggers.flatMap((trigger) => consumableRuntimeCommands(card, trigger, context));
    const command = commands.find((candidate) => candidate.sourceEffectId === effect.id) ?? null;
    const token = effect.resolver;
    const refs = hostSource.split(token).length - 1;
    rows.push({ catalogId, name: entry.name, effectId: effect.id, trigger: effect.trigger, resolver: effect.resolver, declaredEffect: effect.effect ?? effect.action ?? "", declaredDuration: effect.duration ?? "immediate", commandEffect: command?.effect ?? null, commandDuration: command?.duration ?? null, commandChoice: Boolean(command?.choice), qualifier: command?.qualifier ?? null, hostRefs: refs });
  }
}
const byResolver = new Map();
for (const row of rows) {
  const current = byResolver.get(row.resolver) ?? { resolver: row.resolver, effects: 0, hostRefs: row.hostRefs, choices: 0, triggers: new Set(), commandEffects: new Set(), durations: new Set() };
  current.effects++;
  current.choices += row.commandChoice ? 1 : 0;
  current.triggers.add(row.trigger);
  current.commandEffects.add(String(row.commandEffect));
  current.durations.add(String(row.commandDuration));
  byResolver.set(row.resolver, current);
}
const summary = [...byResolver.values()].map((row) => ({ ...row, triggers: [...row.triggers], commandEffects: [...row.commandEffects], durations: [...row.durations] })).sort((a,b) => a.hostRefs - b.hostRefs || a.resolver.localeCompare(b.resolver));
console.log("ZERO_HOST_REFS=" + JSON.stringify(summary.filter((row) => row.hostRefs === 0)));
console.log("CHOICE_RESOLVERS=" + JSON.stringify(summary.filter((row) => row.choices > 0)));
const suspects = ["DDB-CON-CORE-008","DDB-CON-CORE-017","DDB-CON-CORE-020","DDB-CON-CORE-028","DDB-CON-CORE-036","DDB-CON-CORE-040","DDB-CON-CORE-049","DDB-CON-CORE-050","DDB-CON-CORE-058"];
console.log("SUSPECT_RULES=" + JSON.stringify(suspects.map((id) => { const c=cardById.get(id); return {catalogId:id,name:c?.name,rulesText:c?.rulesText}; })));
