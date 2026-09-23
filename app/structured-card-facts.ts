import cardEffectsJson from "./data/card-effects.json" with { type: "json" };

type StructuredCardFactSource = {
  catalogId?: string | null;
};

type StructuredEffectRegistry = {
  cards?: Record<string, { effects?: unknown[] }>;
};

const runtimeRegistry = cardEffectsJson as unknown as StructuredEffectRegistry;

function containsMechanicalNumber(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((entry) => containsMechanicalNumber(entry));
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((entry) => containsMechanicalNumber(entry));
}

/**
 * Returns a machine-readable fact derived only from the canonical structured
 * effect registry. `null` means this card has no structured registry entry, so
 * callers must not guess from printed rules prose.
 */
export function structuredCardHasPrintedNumericEffect(
  card: StructuredCardFactSource | null | undefined,
  registry: StructuredEffectRegistry = runtimeRegistry,
): boolean | null {
  const catalogId = String(card?.catalogId ?? "").trim();
  if (!catalogId) return null;
  const effects = registry.cards?.[catalogId]?.effects;
  if (!Array.isArray(effects)) return null;
  return effects.some((effect) => containsMechanicalNumber(effect));
}

export function structuredCardHasNoPrintedNumericEffect(
  card: StructuredCardFactSource | null | undefined,
  registry: StructuredEffectRegistry = runtimeRegistry,
): boolean | null {
  const hasNumeric = structuredCardHasPrintedNumericEffect(card, registry);
  return hasNumeric === null ? null : !hasNumeric;
}
