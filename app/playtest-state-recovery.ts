type RecoverableChoice = { kind: string } | null | undefined;

type RecoverableMatch = {
  pendingChoice?: RecoverableChoice;
  pendingStrike?: unknown | null;
  phase: string;
  log?: string[];
};

const STALE_PROMPT_RECOVERY_LOG = "Recovered a stale damage-prevention prompt left by an older Quick Duel build.";
const PHASE_RECOVERY_LOG = "Recovered an interrupted damage-prevention decision window.";

export function normalizePendingDamageChoice<T extends RecoverableMatch>(match: T): T {
  if (match.pendingChoice?.kind !== "prevent-combat-damage") return match;

  if (!match.pendingStrike) {
    return {
      ...match,
      pendingChoice: null,
      log: [STALE_PROMPT_RECOVERY_LOG, ...(match.log ?? [])],
    } as T;
  }

  if (match.phase !== "defense-window") {
    return {
      ...match,
      phase: "defense-window",
      log: [PHASE_RECOVERY_LOG, ...(match.log ?? [])],
    } as T;
  }

  return match;
}
