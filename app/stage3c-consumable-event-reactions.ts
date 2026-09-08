import { consumableRuntimeCommands } from "./consumable-effect-resolvers.ts";
import type { RuntimeCardLike, RuntimeStatus } from "./family-effect-runtime.ts";

export type ConsumableEventReactionKind =
  | "cancel-reaction"
  | "replace-disarm"
  | "replace-reveal"
  | "invalidate-target";

export function consumableEventReactionKind(card: RuntimeCardLike): ConsumableEventReactionKind | null {
  const commands = consumableRuntimeCommands(card, "onPlay", { friendlyTargetCount: 1, opponentTargetCount: 1 });
  if (commands.some((command) => command.resolver === "consumable.cancelReaction")) return "cancel-reaction";
  if (commands.some((command) => command.resolver === "consumable.replaceDisarmWithSelfDestroy")) return "replace-disarm";
  if (commands.some((command) => command.resolver === "consumable.replaceRevealedMarketOrLocation")) return "replace-reveal";
  if (commands.some((command) => command.qualifier?.untargetable === true)) return "invalidate-target";
  return null;
}

export function isUntargetableStatus(status: RuntimeStatus) {
  return status.qualifier?.untargetable === true;
}

export function hasUntargetableStatus(statuses: RuntimeStatus[] | undefined) {
  return Boolean(statuses?.some(isUntargetableStatus));
}

export function isTargetInvalidationReaction(card: RuntimeCardLike) {
  return consumableEventReactionKind(card) === "invalidate-target";
}
