import { consumableRuntimeCommands } from "./consumable-effect-resolvers.ts";
import type { RuntimeCardLike, RuntimeStatus } from "./family-effect-runtime.ts";

export type ConsumableEventReactionKind =
  | "cancel-reaction"
  | "replace-disarm"
  | "replace-reveal"
  | "invalidate-target";

export type EventReactionCard = RuntimeCardLike & {
  id: string;
  timing?: string | null;
};

export function consumableEventReactionKind(card: RuntimeCardLike): ConsumableEventReactionKind | null {
  const commands = consumableRuntimeCommands(card, "onPlay", { friendlyTargetCount: 1, opponentTargetCount: 1 });
  if (commands.some((command) => command.resolver === "consumable.cancelReaction")) return "cancel-reaction";
  if (commands.some((command) => command.resolver === "consumable.replaceDisarmWithSelfDestroy")) return "replace-disarm";
  if (commands.some((command) => command.resolver === "consumable.replaceRevealedMarketOrLocation")) return "replace-reveal";
  if (commands.some((command) => command.qualifier?.untargetable === true)) return "invalidate-target";
  return null;
}

export function isEventReactionCard(card: RuntimeCardLike, kind: ConsumableEventReactionKind) {
  return consumableEventReactionKind(card) === kind;
}

export function eventReactionCards(cards: EventReactionCard[], kind: ConsumableEventReactionKind) {
  return cards.filter((card) => String(card.timing ?? "").trim().toLocaleLowerCase() === "reaction" && isEventReactionCard(card, kind));
}

export function firstEventReactionCard(cards: EventReactionCard[], kind: ConsumableEventReactionKind) {
  return eventReactionCards(cards, kind)[0] ?? null;
}

export function isReactionCancellationReaction(card: RuntimeCardLike) {
  return isEventReactionCard(card, "cancel-reaction");
}

export function isDisarmReplacementReaction(card: RuntimeCardLike) {
  return isEventReactionCard(card, "replace-disarm");
}

export function isRevealReplacementReaction(card: RuntimeCardLike) {
  return isEventReactionCard(card, "replace-reveal");
}

export function isUntargetableStatus(status: RuntimeStatus) {
  return status.qualifier?.untargetable === true;
}

export function hasUntargetableStatus(statuses: RuntimeStatus[] | undefined) {
  return Boolean(statuses?.some(isUntargetableStatus));
}

export function isTargetInvalidationReaction(card: RuntimeCardLike) {
  return isEventReactionCard(card, "invalidate-target");
}
