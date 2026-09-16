import type { RuntimeStatus } from "./family-effect-runtime.ts";

export type NextDefenseStatusFacts = {
  firstDefenseThisRound?: boolean;
  boughtCardThisTurn?: boolean;
};

function nextDefenseStatusQualifies(status: RuntimeStatus, facts: NextDefenseStatusFacts) {
  if (status.qualifier?.firstDefenseThisRound !== undefined
    && Boolean(status.qualifier.firstDefenseThisRound) !== Boolean(facts.firstDefenseThisRound)) return false;
  if (status.qualifier?.boughtCardThisTurn !== undefined
    && Boolean(status.qualifier.boughtCardThisTurn) !== Boolean(facts.boughtCardThisTurn)) return false;
  return true;
}

export function nextDefenseGuardBonus(statuses: RuntimeStatus[], facts: NextDefenseStatusFacts = {}) {
  return statuses
    .filter((status) => status.duration === "nextDefense" && status.effect === "combat.modifyGuard" && nextDefenseStatusQualifies(status, facts))
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
