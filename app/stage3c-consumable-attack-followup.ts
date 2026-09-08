import { consumableRuntimeCommands, type ConsumableRuntimeContext } from "./consumable-effect-resolvers.ts";
import type { RuntimeCardLike, RuntimeStatus } from "./family-effect-runtime.ts";

export type ConsumableAttackFollowupResolution = {
  statuses: RuntimeStatus[];
  focus: number;
  directSelfDamage: number;
  notes: string[];
};

const WATCHER_SUFFIX = ":watch-next-attack";

function watcherQualifier(resolver?: string) {
  if (resolver === "consumable.blockedAttackBacklash" || resolver === "consumable.pocketYoyo") {
    return { resolveAfterAttack: true, requireBlocked: true };
  }
  if (resolver === "consumable.preventInterfereOnNextAttack") {
    return { resolveAfterAttack: true, requireNoInterferencePrevented: true };
  }
  return null;
}

export function armConsumableAttackFollowupStatuses(statuses: RuntimeStatus[], card: RuntimeCardLike) {
  const context: ConsumableRuntimeContext = {
    nextAttackBlocked: true,
    interferencePrevented: false,
    friendlyTargetCount: 1,
    opponentTargetCount: 1,
  };
  const passive = consumableRuntimeCommands(card, "passive", context);
  let next = [...statuses];
  for (const command of passive) {
    const qualifier = watcherQualifier(command.resolver);
    if (!qualifier) continue;
    const sourceEffectId = `${command.sourceEffectId}${WATCHER_SUFFIX}`;
    next = next.filter((status) => status.sourceEffectId !== sourceEffectId);
    next.push({
      sourceEffectId,
      effect: command.effect,
      target: "self",
      amount: command.amount,
      duration: "nextAttack",
      resolver: command.resolver,
      qualifier,
      appliedImmediately: false,
    });
  }
  return next;
}

export function isConsumableAttackFollowupStatus(status: RuntimeStatus) {
  return status.duration === "nextAttack" && status.qualifier?.resolveAfterAttack === true;
}

export function resolveConsumableAttackFollowupStatuses(
  statuses: RuntimeStatus[],
  outcome: { blocked: boolean; interferencePrevented?: boolean },
): ConsumableAttackFollowupResolution {
  let focus = 0;
  let directSelfDamage = 0;
  const notes: string[] = [];
  const remaining: RuntimeStatus[] = [];

  for (const status of statuses) {
    if (!isConsumableAttackFollowupStatus(status)) {
      remaining.push(status);
      continue;
    }
    const requiresBlocked = status.qualifier?.requireBlocked === true;
    const requiresNoInterferencePrevented = status.qualifier?.requireNoInterferencePrevented === true;
    const qualifies = (!requiresBlocked || outcome.blocked)
      && (!requiresNoInterferencePrevented || !outcome.interferencePrevented);
    if (!qualifies) continue;

    if (status.effect === "core.gainFocus") {
      focus += Math.max(0, status.amount);
      notes.push(`${status.resolver ?? "Consumable"} grants ${Math.max(0, status.amount)} Focus after the watched Attack`);
    } else if (status.effect === "combat.dealDamage") {
      directSelfDamage += Math.max(0, status.amount);
      notes.push(`${status.resolver ?? "Consumable"} deals ${Math.max(0, status.amount)} direct self-damage after the watched Attack`);
    }
  }

  return { statuses: remaining, focus, directSelfDamage, notes };
}
