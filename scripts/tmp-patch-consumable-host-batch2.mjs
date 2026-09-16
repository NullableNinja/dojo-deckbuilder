import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { applyStage3CBoardCustomCommand, revertStage3CBoardCustomStatus } from "./stage3c-board-command-semantics.ts";\n',
  'import { applyStage3CBoardCustomCommand, revertStage3CBoardCustomStatus } from "./stage3c-board-command-semantics.ts";\nimport { chooseAiTemporaryStatusRemoval, removableTemporaryStatuses, removeTemporaryStatus } from "./stage3c-consumable-status-removal.ts";\nimport { structuredConsumableTopRevealPlan } from "./stage3c-consumable-reveal.ts";\n',
  "imports",
);

replaceOnce(
  '  | { kind: "stage3c-remove-negative"; sourceCardId: string; bonusAttack: number; stats: ("ATK" | "DEF" | "Speed")[] }\n',
  '  | { kind: "stage3c-remove-negative"; sourceCardId: string; bonusAttack: number; stats: ("ATK" | "DEF" | "Speed")[] }\n  | { kind: "stage3c-remove-status"; sourceCardId: string; statusIds: string[] }\n',
  "pending choice type",
);

replaceOnce(
  '    let deckNote = "";\n    if (!pendingChoice && deckLookPlan(card)) {',
  '    let deckNote = "";\n    const topRevealPlan = isCoreConsumableCard(card) ? structuredConsumableTopRevealPlan(card) : null;\n    if (topRevealPlan) {\n      const revealedId = nextPlayer.deck.at(-1);\n      const revealed = revealedId ? cardFor(revealedId) : null;\n      deckNote = revealed ? `Revealed ${revealed.name} (Focus Value ${cardFocus(revealed)}).` : "No card was available to reveal.";\n    }\n    if (!pendingChoice && deckLookPlan(card)) {',
  "top reveal note",
);

replaceOnce(
  '      if (card.catalogId === "DDB-CON-CORE-031" || card.catalogId === "DDB-CON-CORE-056") {\n        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.removeTemporaryNegativeStatModifier"]);\n        const stats = stage3cNegativeStatOptions(nextPlayer);\n        if (stats.length) pendingChoice = { kind: "stage3c-remove-negative", sourceCardId: id, bonusAttack: card.catalogId === "DDB-CON-CORE-031" ? 1 : 0, stats };\n      }\n',
  '      if (card.catalogId === "DDB-CON-CORE-031" || card.catalogId === "DDB-CON-CORE-056") {\n        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.removeTemporaryNegativeStatModifier"]);\n        const stats = stage3cNegativeStatOptions(nextPlayer);\n        if (stats.length) pendingChoice = { kind: "stage3c-remove-negative", sourceCardId: id, bonusAttack: card.catalogId === "DDB-CON-CORE-031" ? 1 : 0, stats };\n      }\n      if (nextPlayer.stage3cChoices?.some((choice) => choice.resolver === "consumable.healAndRemoveStatus")) {\n        nextPlayer = clearStage3CResolverChoices(nextPlayer, ["consumable.healAndRemoveStatus"]);\n        const statusIds = removableTemporaryStatuses(nextPlayer.stage3cStatuses).map((status) => status.sourceEffectId);\n        if (!pendingChoice && statusIds.length) pendingChoice = { kind: "stage3c-remove-status", sourceCardId: id, statusIds };\n      }\n',
  "player status removal continuation",
);

replaceOnce(
  '  const resolveStage3CRaffle = (buy: boolean) => setMatch((current) => {',
  '  const resolveStage3CStatusRemoval = (sourceEffectId: string) => setMatch((current) => {\n    const choice = current?.pendingChoice;\n    if (!current || !choice || choice.kind !== "stage3c-remove-status" || !choice.statusIds.includes(sourceEffectId)) return current;\n    const status = current.player.stage3cStatuses?.find((candidate) => candidate.sourceEffectId === sourceEffectId);\n    const removed = removeTemporaryStatus(current.player, sourceEffectId);\n    return write(current, `${cardFor(choice.sourceCardId)?.name ?? "Consumable"} removes ${status?.resolver ?? status?.effect ?? "the selected temporary status"}.`, { player: removed.board, pendingChoice: null });\n  });\n\n  const resolveStage3CRaffle = (buy: boolean) => setMatch((current) => {',
  "status removal resolver",
);

replaceOnce(
  '      if (card.catalogId === "DDB-CON-CORE-031" || card.catalogId === "DDB-CON-CORE-056") {\n        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.removeTemporaryNegativeStatModifier"]);\n        const stat = stage3cNegativeStatOptions(nextAi)[0];\n        if (stat) {\n          const removed = stage3cRemoveTemporaryNegative(nextAi, stat);\n          nextAi = removed.board;\n          if (removed.removed && card.catalogId === "DDB-CON-CORE-031") {\n            const status: RuntimeStatus = { sourceEffectId: `consumable-pep-talk-bonus:${card.id}`, effect: "combat.modifyAttackPower", target: "self", amount: 1, duration: "nextAttack", resolver: "consumable.pepTalkConditionalAttackBonus", qualifier: { nextAttack: true, expires: "endOfTurn" }, appliedImmediately: false };\n            nextAi = { ...nextAi, stage3cStatuses: [...(nextAi.stage3cStatuses ?? []), status] };\n          }\n        }\n      }\n',
  '      if (card.catalogId === "DDB-CON-CORE-031" || card.catalogId === "DDB-CON-CORE-056") {\n        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.removeTemporaryNegativeStatModifier"]);\n        const stat = stage3cNegativeStatOptions(nextAi)[0];\n        if (stat) {\n          const removed = stage3cRemoveTemporaryNegative(nextAi, stat);\n          nextAi = removed.board;\n          if (removed.removed && card.catalogId === "DDB-CON-CORE-031") {\n            const status: RuntimeStatus = { sourceEffectId: `consumable-pep-talk-bonus:${card.id}`, effect: "combat.modifyAttackPower", target: "self", amount: 1, duration: "nextAttack", resolver: "consumable.pepTalkConditionalAttackBonus", qualifier: { nextAttack: true, expires: "endOfTurn" }, appliedImmediately: false };\n            nextAi = { ...nextAi, stage3cStatuses: [...(nextAi.stage3cStatuses ?? []), status] };\n          }\n        }\n      }\n      if (nextAi.stage3cChoices?.some((choice) => choice.resolver === "consumable.healAndRemoveStatus")) {\n        nextAi = clearStage3CResolverChoices(nextAi, ["consumable.healAndRemoveStatus"]);\n        const sourceEffectId = chooseAiTemporaryStatusRemoval(nextAi.stage3cStatuses);\n        if (sourceEffectId) nextAi = removeTemporaryStatus(nextAi, sourceEffectId).board;\n      }\n',
  "AI status removal continuation",
);

replaceOnce(
  '    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Remove a temporary penalty"\n',
  '    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Remove a temporary penalty"\n    : match.pendingChoice?.kind === "stage3c-remove-status" ? "Remove a temporary status"\n',
  "choice title",
);

replaceOnce(
  '    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Choose one currently active temporary -ATK, -DEF, or -Speed effect to remove."\n',
  '    : match.pendingChoice?.kind === "stage3c-remove-negative" ? "Choose one currently active temporary -ATK, -DEF, or -Speed effect to remove."\n    : match.pendingChoice?.kind === "stage3c-remove-status" ? "Choose one currently active temporary status to remove from your fighter."\n',
  "choice prompt",
);

replaceOnce(
  ': match.pendingChoice?.kind === "stage3c-remove-negative" ? match.pendingChoice.stats.map((stat) => <button type="button" onClick={() => resolveStage3CNegative(stat)} key={stat}><span>REMOVE PENALTY</span><b>-{stat}</b><small>Remove one active temporary penalty</small></button>) : match.pendingChoice?.kind === "air-horn-reaction" ?',
  ': match.pendingChoice?.kind === "stage3c-remove-negative" ? match.pendingChoice.stats.map((stat) => <button type="button" onClick={() => resolveStage3CNegative(stat)} key={stat}><span>REMOVE PENALTY</span><b>-{stat}</b><small>Remove one active temporary penalty</small></button>) : match.pendingChoice?.kind === "stage3c-remove-status" ? match.pendingChoice.statusIds.map((sourceEffectId) => { const status = player.stage3cStatuses?.find((candidate) => candidate.sourceEffectId === sourceEffectId); return <button type="button" onClick={() => resolveStage3CStatusRemoval(sourceEffectId)} key={sourceEffectId}><span>REMOVE STATUS</span><b>{status?.resolver ?? status?.effect ?? "Temporary status"}</b><small>{status ? `${status.effect}${status.amount ? ` ${status.amount > 0 ? "+" : ""}${status.amount}` : ""} · ${status.duration}` : sourceEffectId}</small></button>; }) : match.pendingChoice?.kind === "air-horn-reaction" ?',
  "choice buttons",
);

fs.writeFileSync(path, source);
console.log("Patched app/playtest.tsx for generic Consumable status removal and top-deck reveal visibility.");
