import rulesJson from "./data/rules.json";

export type HouseRuleRecord = {
  name: string;
  rule: string;
  category?: string;
  summary?: string;
  notes?: string;
};

export type QuickDuelSupportStatus = "supported" | "planned" | "not-applicable";

export type QuickDuelHouseRule = HouseRuleRecord & {
  id: string;
  quickDuel: {
    status: QuickDuelSupportStatus;
    reason: string;
  };
};

type BeltThreshold = { xp: number };

type Capability = {
  id: string;
  status: QuickDuelSupportStatus;
  reason: string;
};

const CAPABILITIES: Record<string, Capability> = {
  "Steal the Belt": {
    id: "steal-the-belt",
    status: "not-applicable",
    reason: "Quick Duel ends when the opposing fighter is KO'd, so task credit from that KO cannot affect the duel.",
  },
  "Corner Advice": {
    id: "corner-advice",
    status: "planned",
    reason: "This needs a once-per-game draw/discard decision for both the player and tactical AI before it can be enforced fairly.",
  },
  "Secret Kata Night": {
    id: "secret-kata-night",
    status: "planned",
    reason: "Hidden Market information needs dedicated masking and AI knowledge rules before the digital implementation can be trustworthy.",
  },
  "Crowd Favorite": {
    id: "crowd-favorite",
    status: "planned",
    reason: "The Crowd token needs Honor timing, per-round ownership, and a post-Hit choice window that the current duel state does not model yet.",
  },
  "Training Montage": {
    id: "training-montage",
    status: "planned",
    reason: "Skipping Yell, choosing a Junk card to Destroy, and teaching the AI when to take the trade all require a new decision state.",
  },
  "Friendly Fire": {
    id: "friendly-fire",
    status: "not-applicable",
    reason: "Quick Duel has one fighter per side and no allied active fighter to target.",
  },
  "Market Scramble": {
    id: "market-scramble",
    status: "supported",
    reason: "Quick Duel can enforce the full seven-card end-of-round refresh through the same Market pipeline used by Market Mercy.",
  },
  "Fast Belts": {
    id: "fast-belts",
    status: "supported",
    reason: "Quick Duel can apply the reduced post-Gold XP thresholds symmetrically to the player, AI, promotion checks, and Belt displays.",
  },
  "Scroll Shopping": {
    id: "scroll-shopping",
    status: "planned",
    reason: "Three-card Combo selection needs a new acquisition choice surface and matching AI policy before it can be automated safely.",
  },
};

const canonicalHouseRules = (rulesJson as { houseRules: HouseRuleRecord[] }).houseRules;

const fallbackId = (name: string) => name
  .normalize("NFKD")
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const HOUSE_RULES: QuickDuelHouseRule[] = canonicalHouseRules.map((rule) => {
  const capability = CAPABILITIES[rule.name] ?? {
    id: fallbackId(rule.name),
    status: "planned" as const,
    reason: "This canonical house rule has not yet been certified for the digital Quick Duel engine.",
  };
  return { ...rule, id: capability.id, quickDuel: { status: capability.status, reason: capability.reason } };
});

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
