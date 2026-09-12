import rulesJson from "./data/rules.json";

export type QuickDuelSupportStatus = "supported" | "planned" | "not-applicable";

export type QuickDuelHouseRule = {
  id: string;
  name: string;
  rule: string;
  category?: string;
  summary?: string;
  notes?: string;
  quickDuel: {
    status: QuickDuelSupportStatus;
    reason: string;
  };
};

type BeltThreshold = { xp: number };

const canonicalHouseRules = (rulesJson as unknown as { houseRules: QuickDuelHouseRule[] }).houseRules;

export const HOUSE_RULES = canonicalHouseRules;
export const QUICK_DUEL_HOUSE_RULES = HOUSE_RULES.filter((rule) => rule.quickDuel.status === "supported");
const QUICK_DUEL_HOUSE_RULE_IDS = new Set(QUICK_DUEL_HOUSE_RULES.map((rule) => rule.id));

export function quickDuelHouseRuleForName(name: string) {
  return HOUSE_RULES.find((rule) => rule.name === name) ?? null;
}

export function sanitizeQuickDuelHouseRuleIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && QUICK_DUEL_HOUSE_RULE_IDS.has(id)))];
}

export function hasQuickDuelHouseRule(enabledIds: readonly string[], id: string) {
  return enabledIds.includes(id) && QUICK_DUEL_HOUSE_RULE_IDS.has(id);
}

export function effectiveBeltThresholds(belts: readonly BeltThreshold[], enabledIds: readonly string[]) {
  const thresholds = belts.map((belt) => Number(belt.xp) || 0);
  if (!hasQuickDuelHouseRule(enabledIds, "fast-belts")) return thresholds;
  for (let index = 2; index < thresholds.length; index += 1) {
    thresholds[index] = Math.max(thresholds[index - 1] + 1, thresholds[index] - 3);
  }
  return thresholds;
}

export function shouldRefreshMarketAtRoundEnd(marketPurchasedThisRound: boolean, enabledIds: readonly string[]) {
  return hasQuickDuelHouseRule(enabledIds, "market-scramble") || !marketPurchasedThisRound;
}
