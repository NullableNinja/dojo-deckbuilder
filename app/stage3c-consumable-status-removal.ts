import { revertStage3CBoardCustomStatus } from "./stage3c-board-command-semantics.ts";
import type { RuntimeStatus } from "./family-effect-runtime.ts";

export type TemporaryStatusBoard = {
  stage3cStatuses?: RuntimeStatus[];
  stage3cRestrictions?: string[];
  tempSpeed: number;
  stage3cAttackModifier?: number;
  stage3cDefenseModifier?: number;
  stage3cSpeedOverride?: number | null;
  stage3cPurchaseCostModifier?: number;
};

export type RemovableTemporaryStatus = {
  sourceEffectId: string;
  resolver: string | null;
  effect: string;
  amount: number;
  duration: string;
  harmful: boolean;
};

export function removableTemporaryStatuses(statuses: RuntimeStatus[] | undefined): RemovableTemporaryStatus[] {
  return (statuses ?? [])
    .filter((status) => status.duration !== "immediate")
    .map((status) => ({
      sourceEffectId: status.sourceEffectId,
      resolver: status.resolver ?? null,
      effect: status.effect,
      amount: status.amount,
      duration: status.duration,
      harmful: status.amount < 0 || Boolean(status.qualifier?.restriction),
    }));
}

export function removeTemporaryStatus<T extends TemporaryStatusBoard>(board: T, sourceEffectId: string): { board: T; removed: RuntimeStatus | null } {
  const status = (board.stage3cStatuses ?? []).find((candidate) => candidate.sourceEffectId === sourceEffectId) ?? null;
  if (!status || status.duration === "immediate") return { board, removed: null };

  let next: T = { ...board };
  if (status.appliedImmediately) {
    if (status.effect === "combat.modifySpeed") next = { ...next, tempSpeed: next.tempSpeed - status.amount };
    if (status.effect === "combat.modifyDefense") next = { ...next, stage3cDefenseModifier: (next.stage3cDefenseModifier ?? 0) - status.amount };
    if (status.effect === "economy.modifyCost") next = { ...next, stage3cPurchaseCostModifier: (next.stage3cPurchaseCostModifier ?? 0) - status.amount };
    if (status.effect === "core.custom") {
      const reverted = revertStage3CBoardCustomStatus({
        attackModifier: next.stage3cAttackModifier ?? 0,
        defenseModifier: next.stage3cDefenseModifier ?? 0,
        speedOverride: next.stage3cSpeedOverride ?? null,
      }, status);
      if (reverted.handled) {
        next = {
          ...next,
          stage3cAttackModifier: reverted.state.attackModifier,
          stage3cDefenseModifier: reverted.state.defenseModifier,
          stage3cSpeedOverride: reverted.state.speedOverride,
        };
      }
    }
  }

  const remainingStatuses = (next.stage3cStatuses ?? []).filter((candidate) => candidate.sourceEffectId !== sourceEffectId);
  const activeRestrictions = new Set(remainingStatuses.map((candidate) => String(candidate.qualifier?.restriction ?? "")).filter(Boolean));
  next = {
    ...next,
    stage3cStatuses: remainingStatuses,
    stage3cRestrictions: (next.stage3cRestrictions ?? []).filter((restriction) => activeRestrictions.has(restriction) || restriction.includes(".")),
  };
  return { board: next, removed: status };
}

export function chooseAiTemporaryStatusRemoval(statuses: RuntimeStatus[] | undefined) {
  const options = removableTemporaryStatuses(statuses);
  return options.find((status) => status.harmful)?.sourceEffectId ?? options[0]?.sourceEffectId ?? null;
}
