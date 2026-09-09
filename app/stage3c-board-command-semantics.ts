import type { RuntimeCommand, RuntimeStatus } from "./family-effect-runtime.ts";

export type Stage3CBoardCustomModifiers = {
  attackModifier: number;
  defenseModifier: number;
  speedOverride: number | null;
};

export function applyStage3CBoardCustomCommand(
  state: Stage3CBoardCustomModifiers,
  command: Pick<RuntimeCommand, "effect" | "amount" | "resolver" | "qualifier">,
  direction: 1 | -1 = 1,
): { state: Stage3CBoardCustomModifiers; handled: boolean } {
  const next = { ...state };
  if (command.effect !== "core.custom") return { state: next, handled: false };
  if (command.qualifier?.setValue !== undefined && command.resolver?.includes("setSpeedToValue")) {
    next.speedOverride = direction > 0 ? Number(command.qualifier.setValue) : null;
    return { state: next, handled: true };
  }
  if (command.qualifier?.stat === "ATK") {
    next.attackModifier += Number(command.amount ?? 0) * direction;
    return { state: next, handled: true };
  }
  if (command.qualifier?.stat === "DEF") {
    next.defenseModifier += Number(command.amount ?? 0) * direction;
    return { state: next, handled: true };
  }
  return { state: next, handled: false };
}

export function revertStage3CBoardCustomStatus(
  state: Stage3CBoardCustomModifiers,
  status: Pick<RuntimeStatus, "effect" | "amount" | "resolver" | "qualifier">,
) {
  return applyStage3CBoardCustomCommand(state, status, -1);
}
