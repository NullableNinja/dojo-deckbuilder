import { resolveKataEffects, type KataCommand, type KataCondition, type KataStructuredEffect } from "./kata-effect-resolvers.ts";
import { conditionValue, structuredRuntimeEffects, type RuntimeCardLike, type RuntimeCommand, type RuntimeTrigger } from "./family-effect-runtime.ts";

export type KataHostFacts = Record<string, unknown> & {
  belt?: string;
  marketCardsRemaining?: number;
  isFastest?: boolean;
  wasHitSinceLastTurn?: boolean;
  hasWeaponEquipped?: boolean;
  dealtDamagePreviousTurn?: boolean;
  hasTempo?: boolean;
  playedAttackThisTurn?: boolean;
  hpAtOrBelowHalfMax?: boolean;
  usedConsumableThisTurn?: boolean;
  discardedCardType?: string;
  discardedFocusValue?: number;
  attackZone?: string;
  differentCardTypesPlayedThisTurn?: number;
  learnedComboTriggeredThisTurn?: boolean;
  damage?: number;
  attackIsReversal?: boolean;
  firstCardPlayedThisTurn?: boolean;
  firstAttackThisTurn?: boolean;
};

export type KataDeckLookPlan =
  | { kind: "pick-discard"; count: number; filter: "defense-or-kata"; optional: false; noMatchFocus: number }
  | { kind: "reorder"; count: number; distinctTypeFocus: number }
  | { kind: "pick-reorder"; count: number; filter: "technique"; optional: false }
  | { kind: "pick-shuffle"; count: number; filter: "item"; optional: true };

export type KataDestroyPlan = {
  count: number;
  sources: ("hand" | "discard")[];
  optional: boolean;
  drawAfterHandDestroy: number;
};

export type KataEquipFromHandPlan = {
  family: string;
  subtype?: string;
  ready: boolean;
  nextAttackPower: number;
  additionalFocus: number;
};

const ACTION_BY_EFFECT: Record<string, string> = {
  "core.draw": "draw",
  "core.discard": "discard",
  "core.heal": "heal",
  "core.gainFocus": "gainFocus",
  "core.gainXP": "gainXP",
  "core.destroy": "destroy",
  "core.reveal": "reveal",
  "combat.modifySpeed": "modifySpeed",
  "combat.modifyAttackPower": "modifyAttackPower",
  "combat.modifyDefense": "modifyDefense",
  "combat.modifyGuard": "modifyGuard",
  "combat.preventDamage": "preventDamage",
  "combat.dealDamage": "dealDamage",
  "combat.grantFlow": "grantFlow",
  "combat.chooseZone": "chooseZone",
  "combat.piercing": "piercing",
  "economy.modifyCost": "modifyCost",
  "equipment.ready": "ready",
  "equipment.exhaust": "exhaust",
};

export function isCoreKataCard(card: RuntimeCardLike | null | undefined) {
  return String(card?.catalogId ?? "").startsWith("DDB-KAT-CORE-");
}

function kataStructuredEffects(card: RuntimeCardLike): KataStructuredEffect[] {
  if (!isCoreKataCard(card)) return [];
  return structuredRuntimeEffects(card).map((effect) => ({
    id: effect.id,
    trigger: String(effect.trigger ?? "onPlay"),
    action: String(effect.action ?? ACTION_BY_EFFECT[String(effect.effect ?? "")] ?? "custom"),
    target: effect.target,
    amount: effect.amount,
    duration: effect.duration,
    conditions: (effect.conditions ?? []).map((condition): KataCondition => ({
      kind: condition.kind,
      operator: condition.operator as KataCondition["operator"],
      value: condition.value,
    })),
    resolver: effect.resolver,
  }));
}

/**
 * Quick Duel's only Kata semantic entry point. The host supplies facts about the
 * current game state; the canonical Kata registry decides which commands exist.
 * Card identity and printed prose are deliberately absent from this interface.
 */
export function kataCommandsForHost(card: RuntimeCardLike, trigger: string, facts: KataHostFacts = {}): KataCommand[] {
  return resolveKataEffects(kataStructuredEffects(card), { trigger, values: facts });
}

function numberParam(command: KataCommand, key: string, fallback = 0) {
  const value = command.params?.[key];
  return value === undefined ? fallback : Number(value);
}

function stringArrayParam(command: KataCommand, key: string) {
  const value = command.params?.[key];
  return Array.isArray(value) ? value.map(String) : [];
}

export function kataDeckLookPlanForHost(card: RuntimeCardLike): KataDeckLookPlan | null {
  const command = kataCommandsForHost(card, "onPlay").find((entry) => entry.kind === "resolveDeckLook");
  if (!command) return null;
  const count = numberParam(command, "lookCount");
  const eligible = stringArrayParam(command, "eligibleTypes").map((value) => value.toLocaleLowerCase());
  const restAction = String(command.params?.restAction ?? "").toLocaleLowerCase();
  if (eligible.includes("defense") && eligible.includes("kata") && restAction === "discard") {
    return { kind: "pick-discard", count, filter: "defense-or-kata", optional: false, noMatchFocus: numberParam(command, "noMatchFocus") };
  }
  if (!eligible.length && restAction === "reorder") {
    return { kind: "reorder", count, distinctTypeFocus: numberParam(command, "differentCardTypesFocus") };
  }
  if (eligible.includes("technique") && restAction === "reorder") {
    return { kind: "pick-reorder", count, filter: "technique", optional: false };
  }
  if (eligible.includes("item") && restAction === "shuffle") {
    return { kind: "pick-shuffle", count, filter: "item", optional: true };
  }
  return null;
}

export function kataDestroyPlanForHost(card: RuntimeCardLike): KataDestroyPlan | null {
  const command = kataCommandsForHost(card, "onPlay").find((entry) => entry.kind === "chooseAndDestroy");
  if (!command || String(command.params?.cardType ?? "").toLocaleLowerCase() !== "junk") return null;
  const sources = stringArrayParam(command, "zones")
    .map((zone) => zone.toLocaleLowerCase())
    .filter((zone): zone is "hand" | "discard" => zone === "hand" || zone === "discard");
  return {
    count: Math.max(1, Number(command.amount ?? 1)),
    sources,
    optional: Boolean(command.params?.optional),
    drawAfterHandDestroy: String(command.params?.drawIfSourceZone ?? "").toLocaleLowerCase() === "hand"
      ? numberParam(command, "drawAmount")
      : 0,
  };
}

export function kataEquipFromHandPlanForHost(card: RuntimeCardLike): KataEquipFromHandPlan | null {
  const command = kataCommandsForHost(card, "onPlay").find((entry) => entry.kind === "equipFromHand");
  if (!command) return null;
  return {
    family: String(command.params?.cardFamily ?? "Equipment"),
    subtype: command.params?.ifSubtype ? String(command.params.ifSubtype) : undefined,
    ready: command.params?.gearEntersReady === true,
    nextAttackPower: Number(command.params?.gearNextAttackPower ?? 0),
    additionalFocus: Number(command.params?.additionalFocusGenerated ?? 0),
  };
}

export function kataMandatoryDiscardCountForHost(card: RuntimeCardLike) {
  return kataCommandsForHost(card, "onPlay")
    .filter((command) => command.kind === "apply" && command.action === "discard" && (command.target ?? "self") === "self")
    .reduce((total, command) => total + Math.max(0, Number(command.amount ?? 0)), 0);
}

export function kataConditionalHealForHost(card: RuntimeCardLike, facts: KataHostFacts) {
  return kataCommandsForHost(card, "onPlay", facts)
    .filter((command) => command.kind === "apply" && command.action === "heal" && (command.target ?? "self") === "self")
    .reduce((total, command) => total + Math.max(0, Number(command.amount ?? 0)), 0);
}

export function kataDiscardFollowupForHost(card: RuntimeCardLike, facts: KataHostFacts) {
  let focus = 0;
  let nextAttackPower = 0;
  let nextDefenseGuard = 0;
  const notes: string[] = [];
  for (const command of kataCommandsForHost(card, "afterResolve", facts)) {
    if (command.resolver !== "kata.discardBranch") continue;
    if (command.action === "gainFocus") {
      focus += Number(command.amount ?? 0);
      notes.push(`structured Kata discard +${Number(command.amount ?? 0)} Focus`);
    } else if (command.action === "modifyAttackPower" && command.duration === "nextAttack") {
      nextAttackPower += Number(command.amount ?? 0);
      notes.push(`structured Kata discard +${Number(command.amount ?? 0)} next Attack Power`);
    } else if (command.action === "modifyGuard" && command.duration === "nextDefense") {
      nextDefenseGuard += Number(command.amount ?? 0);
      notes.push(`structured Kata discard +${Number(command.amount ?? 0)} next Defense Guard`);
    }
  }
  return { focus, nextAttackPower, nextDefenseGuard, notes };
}

export function kataFastestFocusForHost(card: RuntimeCardLike, selfSpeed: number, opponentSpeed: number) {
  return kataCommandsForHost(card, "afterResolve", { isFastest: selfSpeed > opponentSpeed })
    .filter((command) => command.resolver === "kata.conditional" && command.action === "gainFocus")
    .reduce((total, command) => total + Number(command.amount ?? 0), 0);
}

export function kataNextAttackFlowForHost(card: RuntimeCardLike, trigger: string, facts: KataHostFacts = {}) {
  const structured = structuredRuntimeEffects(card).filter((effect) => {
    if (effect.resolver === "kata.flowGrant") return true;
    return effect.resolver === "kata.branch" && conditionValue(effect, "grantFlowTo") === "nextAttack";
  });
  const commands = kataCommandsForHost(card, trigger, facts);
  const matching = commands.filter((command) => {
    if (!(command.kind === "grantFlow" || command.action === "grantFlow" || command.params?.grantFlowTo === "nextAttack")) return false;
    const zones = stringArrayParam(command, "attackZones").map((zone) => zone.toLocaleLowerCase());
    if (zones.length && !facts.attackZone) return false;
    if (zones.length && facts.attackZone && !zones.includes(String(facts.attackZone).toLocaleLowerCase())) return false;
    return true;
  });
  return { handled: structured.length > 0, grant: matching.length > 0 };
}

export function kataNextAttackAnyZoneForHost(card: RuntimeCardLike, trigger: string, facts: KataHostFacts = {}) {
  const structured = structuredRuntimeEffects(card).filter((effect) => {
    if (effect.resolver === "kata.zoneOverride") return true;
    return effect.resolver === "kata.branch" && String(effect.action ?? effect.effect ?? "") === "chooseZone";
  });
  const commands = kataCommandsForHost(card, trigger, facts);
  const matching = commands.filter((command) => {
    if (!(command.kind === "armZoneOverride" || command.action === "chooseZone")) return false;
    if (command.params?.firstAttackThisTurn === true && facts.firstAttackThisTurn !== true) return false;
    return true;
  });
  return { handled: structured.length > 0, grant: matching.length > 0 };
}


const SIMPLE_KATA_RUNTIME_RESOLVERS = new Set([
  "kata.conditional",
  "kata.attackModifier",
  "kata.nextAttackPiercing",
  "kata.branch",
  "kata.damagePrevention",
  "kata.defenseModifier",
  "kata.deferredConditional",
  "kata.purchaseDiscount",
  "kata.comboDiscount",
]);

const KATA_RUNTIME_EFFECT_BY_ACTION: Record<string, string> = {
  draw: "core.draw",
  discard: "core.discard",
  heal: "core.heal",
  gainFocus: "core.gainFocus",
  gainXP: "core.gainXP",
  modifySpeed: "combat.modifySpeed",
  modifyAttackPower: "combat.modifyAttackPower",
  modifyDefense: "combat.modifyDefense",
  modifyGuard: "combat.modifyGuard",
  preventDamage: "combat.preventDamage",
  dealDamage: "combat.dealDamage",
  grantFlow: "combat.grantFlow",
  chooseZone: "combat.chooseZone",
  piercing: "combat.piercing",
};

/**
 * Converts only Kata resolvers that already fit the generic one-shot/status runtime.
 * Complex choices, deferred watchers, equipment actions, reveals, and
 * multi-event plans intentionally stay out until their matching host protocol exists.
 */
export function kataRuntimeCommandsForHost(
  card: RuntimeCardLike,
  trigger: RuntimeTrigger,
  facts: KataHostFacts = {},
): RuntimeCommand[] {
  return kataCommandsForHost(card, trigger, facts).flatMap((command) => {
    const resolver = String(command.resolver ?? "");
    if (!SIMPLE_KATA_RUNTIME_RESOLVERS.has(resolver)) return [];
    if (resolver === "kata.attackModifier" && !(command.action === "modifyAttackPower" && command.duration === "nextAttack")) return [];
    if (resolver === "kata.nextAttackPiercing" && !(command.action === "piercing" && command.duration === "nextAttack")) return [];
    if (resolver === "kata.branch" && !(command.action === "heal" || command.kind === "grantFlow")) return [];
    if (resolver === "kata.damagePrevention" && command.kind !== "armDamagePrevention") return [];
    if (resolver === "kata.defenseModifier" && command.action !== "modifyDefense") return [];
    if (resolver === "kata.deferredConditional" && !(trigger === "onHide" && ["gainFocus", "heal"].includes(String(command.action ?? "")))) return [];
    if (resolver === "kata.purchaseDiscount" && command.kind !== "armPurchaseDiscount") return [];
    if (resolver === "kata.comboDiscount" && command.kind !== "armComboDiscount") return [];
    if ((resolver === "kata.purchaseDiscount" || resolver === "kata.comboDiscount") && command.params?.beltExam !== undefined && String(facts.belt ?? "") !== String(command.params.beltExam)) return [];

    const effect = resolver === "kata.purchaseDiscount" || resolver === "kata.comboDiscount"
      ? "economy.modifyCost"
      : command.kind === "grantFlow"
      ? "combat.grantFlow"
      : resolver === "kata.damagePrevention"
        ? "combat.preventDamage"
        : KATA_RUNTIME_EFFECT_BY_ACTION[String(command.action ?? "")];
    if (!effect) return [];
    const deferredDuration = String(command.params?.duration ?? "");
    const duration = resolver === "kata.purchaseDiscount"
      ? "nextPurchase"
      : resolver === "kata.comboDiscount"
        ? "nextComboLearn"
        : command.kind === "grantFlow"
      ? String(command.params?.grantFlowTo ?? "nextAttack")
      : resolver === "kata.damagePrevention"
        ? "nextDamage"
        : resolver === "kata.defenseModifier" && !command.duration && deferredDuration === "untilStartOfNextTurn"
          ? "nextTurn"
          : String(command.duration ?? "immediate");
    const qualifier = resolver === "kata.purchaseDiscount"
      ? {
          ...command.params,
          minPrintedCost: Number(command.params?.minimumPrintedCost ?? 0),
          minimumFinalCost: Number(command.params?.minimumCost ?? 0),
        }
      : resolver === "kata.comboDiscount"
        ? { ...command.params }
        : resolver === "kata.damagePrevention"
          ? { ...command.params, expires: command.params?.firstDamageEventBefore }
          : command.params;
    return [{
      sourceEffectId: String(command.effectId ?? `kata:${resolver}:${trigger}`),
      effect,
      trigger,
      target: "self",
      amount: resolver === "kata.purchaseDiscount" || resolver === "kata.comboDiscount"
        ? -Math.abs(Number(command.amount ?? command.params?.discount ?? 0))
        : Number(command.amount ?? 0),
      duration,
      resolver,
      conditions: [],
      qualifier,
    }];
  });
}
