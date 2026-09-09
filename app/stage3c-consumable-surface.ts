import type { RuntimeStatus } from "./family-effect-runtime.ts";

export type PurchaseCardLike = { cardType?: string | null; subtype?: string | null; category?: string | null; fpCost?: string | number | null };

function spendOnlyOn(status: RuntimeStatus) {
  const value = status.qualifier?.spendOnlyOn;
  return Array.isArray(value) ? value.map(String) : [];
}

export function isRestrictedFocusPurchaseEligible(card: PurchaseCardLike | undefined, status: RuntimeStatus) {
  if (!card) return false;
  const allowed = spendOnlyOn(status);
  if (!allowed.length) return false;
  const labels = [card.cardType, card.subtype, card.category].map((value) => String(value ?? ""));
  return allowed.some((entry) => labels.includes(entry) || (entry === "Equipment" && String(card.cardType ?? "") === "Item" && String(card.subtype ?? "") !== "Consumable"));
}

export function restrictedFocusAmount(statuses: RuntimeStatus[] | undefined) {
  return (statuses ?? []).filter((status) => status.effect === "core.gainFocus" && spendOnlyOn(status).length).reduce((total, status) => total + Math.max(0, status.amount), 0);
}

export function spendableFocusForPurchase(totalFocus: number, statuses: RuntimeStatus[] | undefined, card: PurchaseCardLike | undefined) {
  const restricted = (statuses ?? []).filter((status) => status.effect === "core.gainFocus" && spendOnlyOn(status).length);
  const locked = restricted.filter((status) => !isRestrictedFocusPurchaseEligible(card, status)).reduce((total, status) => total + Math.max(0, status.amount), 0);
  return Math.max(0, totalFocus - locked);
}

export function spendFocusForPurchase(totalFocus: number, statuses: RuntimeStatus[] | undefined, card: PurchaseCardLike | undefined, price: number) {
  let remaining = Math.max(0, price);
  const nextStatuses = (statuses ?? []).map((status) => ({ ...status, qualifier: status.qualifier ? { ...status.qualifier } : undefined }));
  for (const status of nextStatuses) {
    if (!remaining || status.effect !== "core.gainFocus" || !spendOnlyOn(status).length || !isRestrictedFocusPurchaseEligible(card, status)) continue;
    const spent = Math.min(Math.max(0, status.amount), remaining);
    status.amount -= spent;
    remaining -= spent;
  }
  const nextFocus = Math.max(0, totalFocus - Math.max(0, price));
  return { focus: nextFocus, statuses: nextStatuses.filter((status) => !(status.effect === "core.gainFocus" && spendOnlyOn(status).length && status.amount <= 0)) };
}

export function qualifiedNextPurchaseDiscount(statuses: RuntimeStatus[] | undefined, printedCost: number) {
  const status = (statuses ?? []).find((candidate) => candidate.duration === "nextPurchase" && candidate.resolver === "consumable.ascendPurchaseDiscount" && printedCost >= Number(candidate.qualifier?.minPrintedCost ?? 0));
  if (!status) return { amount: 0, minimumFinalCost: 0, sourceEffectId: null as string | null };
  return { amount: status.amount, minimumFinalCost: Number(status.qualifier?.minimumFinalCost ?? 0), sourceEffectId: status.sourceEffectId };
}

export function consumeQualifiedNextPurchaseStatuses(statuses: RuntimeStatus[] | undefined, printedCost: number) {
  const discount = qualifiedNextPurchaseDiscount(statuses, printedCost);
  if (!discount.sourceEffectId) return [...(statuses ?? [])];
  return (statuses ?? []).filter((status) => status.sourceEffectId !== discount.sourceEffectId);
}
