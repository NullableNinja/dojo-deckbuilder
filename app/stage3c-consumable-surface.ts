import type { RuntimeStatus } from "./family-effect-runtime.ts";

export type PurchaseCardLike = { cardType?: string | null; subtype?: string | null; category?: string | null; fpCost?: string | number | null };

function purchaseDiscountMatches(status: RuntimeStatus, printedCost: number, card?: PurchaseCardLike, purchasedTypes: string[] = []) {
  if (status.duration !== "nextPurchase" || !["consumable.ascendPurchaseDiscount", "defense.nextPurchaseDiscount", "equipment.blockPurchaseDiscount"].includes(String(status.resolver ?? ""))) return false;
  if (printedCost < Number(status.qualifier?.minPrintedCost ?? 0)) return false;
  if (status.qualifier?.firstNovelPurchasedCardType === true && (!card?.cardType || purchasedTypes.includes(String(card.cardType)))) return false;
  return true;
}

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

export function qualifiedNextPurchaseDiscount(statuses: RuntimeStatus[] | undefined, printedCost: number, card?: PurchaseCardLike, purchasedTypes: string[] = []) {
  const status = (statuses ?? []).find((candidate) => purchaseDiscountMatches(candidate, printedCost, card, purchasedTypes));
  if (!status) return { amount: 0, minimumFinalCost: 0, sourceEffectId: null as string | null };
  return { amount: status.amount, minimumFinalCost: Number(status.qualifier?.minimumFinalCost ?? 0), sourceEffectId: status.sourceEffectId };
}

export function consumeQualifiedNextPurchaseStatuses(statuses: RuntimeStatus[] | undefined, printedCost: number, card?: PurchaseCardLike, purchasedTypes: string[] = []) {
  const discount = qualifiedNextPurchaseDiscount(statuses, printedCost, card, purchasedTypes);
  if (!discount.sourceEffectId) return [...(statuses ?? [])];
  return (statuses ?? []).filter((status) => status.sourceEffectId !== discount.sourceEffectId);
}

export function qualifiedNextComboLearnDiscount(statuses: RuntimeStatus[] | undefined) {
  const status = (statuses ?? []).find((candidate) => candidate.duration === "nextComboLearn" && candidate.resolver === "kata.comboDiscount");
  return status ? { amount: Math.max(0, -status.amount), sourceEffectId: status.sourceEffectId } : { amount: 0, sourceEffectId: null as string | null };
}

export function consumeQualifiedNextComboLearnDiscount(statuses: RuntimeStatus[] | undefined) {
  const discount = qualifiedNextComboLearnDiscount(statuses);
  if (!discount.sourceEffectId) return [...(statuses ?? [])];
  return (statuses ?? []).filter((status) => status.sourceEffectId !== discount.sourceEffectId);
}
