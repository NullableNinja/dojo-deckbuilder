import { consumableRuntimeCommands } from "./consumable-effect-resolvers.ts";
import type { RuntimeCardLike, RuntimeStatus } from "./family-effect-runtime.ts";

export type ConsumableHideResolution = {
  statuses: RuntimeStatus[];
  focus: number;
  directSelfDamage: number;
  notes: string[];
};

const HIDE_SUFFIX = ":resolve-at-hide";

export function armConsumableHideStatuses(statuses: RuntimeStatus[], card: RuntimeCardLike) {
  const hideCommands = consumableRuntimeCommands(card, "onHide", { sameTurnSourceActive: true });
  let next = [...statuses];
  for (const command of hideCommands) {
    const sourceEffectId = `${command.sourceEffectId}${HIDE_SUFFIX}`;
    next = next.filter((status) => status.sourceEffectId !== sourceEffectId);
    next.push({
      sourceEffectId,
      effect: command.effect,
      target: "self",
      amount: command.amount,
      duration: "endOfTurn",
      resolver: command.resolver,
      qualifier: { resolveAtHide: true },
      appliedImmediately: false,
    });
  }
  return next;
}

export function isConsumableHideStatus(status: RuntimeStatus) {
  return status.qualifier?.resolveAtHide === true;
}

export function resolveConsumableHideStatuses(statuses: RuntimeStatus[]): ConsumableHideResolution {
  let focus = 0;
  let directSelfDamage = 0;
  const notes: string[] = [];
  const remaining: RuntimeStatus[] = [];

  for (const status of statuses) {
    if (!isConsumableHideStatus(status)) {
      remaining.push(status);
      continue;
    }
    if (status.effect === "combat.dealDamage") {
      directSelfDamage += Math.max(0, status.amount);
      notes.push(`${status.resolver ?? "Consumable"} deals ${Math.max(0, status.amount)} direct damage at Hide`);
    } else if (status.effect === "core.gainFocus") {
      focus += Math.max(0, status.amount);
      notes.push(`${status.resolver ?? "Consumable"} grants ${Math.max(0, status.amount)} Focus at Hide`);
    }
  }

  return { statuses: remaining, focus, directSelfDamage, notes };
}
