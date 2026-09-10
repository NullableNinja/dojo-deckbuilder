import type { RuntimeStatus } from "./family-effect-runtime.ts";

export function nextDefenseGuardBonus(statuses: RuntimeStatus[]) {
  return statuses
    .filter((status) => status.duration === "nextDefense" && status.effect === "combat.modifyGuard")
    .reduce((total, status) => total + status.amount, 0);
}

export function nextIncomingAttackDefenseBonus(statuses: RuntimeStatus[]) {
  return statuses
    .filter((status) => status.duration === "nextIncomingAttack" && status.effect === "combat.modifyDefense")
    .reduce((total, status) => total + status.amount, 0);
}

export function consumeNextDefenseStatuses(statuses: RuntimeStatus[]) {
  return statuses.filter((status) => status.duration !== "nextDefense");
}

export function consumeNextIncomingAttackStatuses(statuses: RuntimeStatus[]) {
  return statuses.filter((status) => status.duration !== "nextIncomingAttack");
}
