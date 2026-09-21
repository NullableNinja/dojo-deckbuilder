export const HEADLESS_SUPPORTED_ACTIONS = new Set([
  "gainFocus", "draw", "modifyAttackPower", "modifySpeed", "modifyGuard", "modifyDefense",
  "preventDamage", "heal", "dealDamage", "minimumSpeed", "piercing", "chooseZone",
]);

export const HEADLESS_SUPPORTED_CONDITIONS = new Set([
  "always", "isFastest", "firstAttackThisTurn", "attackNumber", "defenderPlayedDefense",
  "targetHpAtMost", "hasTempo", "targetPermanentEquipmentCount", "hasFewerCardsThanTarget", "alternateZone",
]);

export function analyzeEffectCoverage(cardEffects) {
  const actionCounts = {}; const resolverCounts = {}; const conditionCounts = {}; const unsupportedActions = {}; const unsupportedResolvers = {}; const unsupportedConditions = {};
  let totalEffects = 0; let supportedEffects = 0; let fullySupportedCards = 0; let cardsWithEffects = 0;
  for (const [catalogId, card] of Object.entries(cardEffects.cards ?? {})) {
    const effects = card.effects ?? []; if (!effects.length) continue; cardsWithEffects += 1; let cardSupported = true;
    for (const effect of effects) {
      totalEffects += 1; const action = String(effect.action ?? ""); const resolver = String(effect.resolver ?? ""); actionCounts[action] = (actionCounts[action] ?? 0) + 1; if (resolver) resolverCounts[resolver] = (resolverCounts[resolver] ?? 0) + 1;
      let supported = HEADLESS_SUPPORTED_ACTIONS.has(action) || action === "custom" && resolver === "starter.gainFocusIfFastest";
      for (const raw of effect.conditions ?? []) {
        const kind = typeof raw === "string" ? raw.match(/kind=([^;}]*)/)?.[1] : raw.kind; conditionCounts[kind] = (conditionCounts[kind] ?? 0) + 1;
        if (!HEADLESS_SUPPORTED_CONDITIONS.has(kind)) { supported = false; unsupportedConditions[kind] = (unsupportedConditions[kind] ?? 0) + 1; }
      }
      if (!supported) { cardSupported = false; if (!HEADLESS_SUPPORTED_ACTIONS.has(action) && !(action === "custom" && resolver === "starter.gainFocusIfFastest")) unsupportedActions[action] = (unsupportedActions[action] ?? 0) + 1; if (action === "custom" && resolver !== "starter.gainFocusIfFastest") unsupportedResolvers[resolver] = (unsupportedResolvers[resolver] ?? 0) + 1; }
      else { supportedEffects += 1; }
    }
    if (cardSupported) fullySupportedCards += 1;
    if (!cardSupported && !(catalogId)) throw new Error("unreachable card coverage state");
  }
  return { cardsWithEffects, fullySupportedCards, totalEffects, supportedEffects, unsupportedEffects: totalEffects - supportedEffects, actionCounts, resolverCounts, conditionCounts, unsupportedActions, unsupportedResolvers, unsupportedConditions };
}
