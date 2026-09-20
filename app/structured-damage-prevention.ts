import type { RuntimeStatus } from "./family-effect-runtime.ts";

export type StructuredDamagePreventionResolution = {
  statuses: RuntimeStatus[];
  damage: number;
  focus: number;
  notes: string[];
};

export function resolveNextDamagePreventionStatuses(
  statuses: RuntimeStatus[],
  damage: number,
  source: string,
): StructuredDamagePreventionResolution {
  if (damage <= 0) return { statuses, damage, focus: 0, notes: [] };
  const normalizedSource = source.toLocaleLowerCase();
  const matching = statuses.filter((status) => {
    if (status.duration !== "nextDamage" || status.effect !== "combat.preventDamage") return false;
    const requiredSource = String(status.qualifier?.source ?? "").toLocaleLowerCase();
    return !requiredSource || requiredSource === normalizedSource;
  });
  if (!matching.length) return { statuses, damage, focus: 0, notes: [] };

  const preventsAll = matching.some((status) => status.qualifier?.setDamageToZero === true);
  const prevention = matching.reduce((total, status) => total + Math.max(0, status.amount), 0);
  const reducedDamage = preventsAll ? 0 : Math.max(0, damage - prevention);
  const consumed = new Set(matching.map((status) => status.sourceEffectId));
  let focus = 0;
  for (const status of matching) {
    const threshold = status.qualifier?.gainFocusIfDamageAfterReduction;
    if (threshold === undefined || Number(threshold) !== reducedDamage) continue;
    focus += Math.max(0, Number(status.qualifier?.focusAmount ?? 0));
  }
  return {
    statuses: statuses.filter((status) => !consumed.has(status.sourceEffectId)),
    damage: reducedDamage,
    focus,
    notes: [preventsAll ? "Structured prevention reduces damage to 0" : `Structured prevention reduces damage by ${Math.min(damage, prevention)}`, ...(focus ? [`Structured prevention grants ${focus} Focus`] : [])],
  };
}

export function expirePreventionAtNextInitiate(statuses: RuntimeStatus[]) {
  return statuses.filter((status) => !(
    status.effect === "combat.preventDamage"
    && status.duration === "nextDamage"
    && String(status.qualifier?.expires ?? "") === "nextInitiate"
  ));
}
