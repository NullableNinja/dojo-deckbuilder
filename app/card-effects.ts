export type EffectTiming = "onPlay" | "onHit" | "onBlock" | "afterResolve";
export type EffectKind = "draw" | "discard" | "heal" | "focus" | "speed" | "nextAttackPower";
export type CardEffect = { timing: EffectTiming; kind: EffectKind; amount: number };
export type CardEffectPlan = { effects: CardEffect[]; unsupported: string[] };

const TIMING_LABELS: Record<EffectTiming, string> = {
  onPlay: "on play",
  onHit: "on Hit",
  onBlock: "on Block",
  afterResolve: "after resolution",
};

function amount(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : 0;
}

function sentenceTiming(sentence: string): EffectTiming | null {
  if (/^(?:if (?:this|it|that (?:Attack|Defense)) Blocks?|when (?:this|that) Blocks?)/i.test(sentence)) return "onBlock";
  if (/^(?:on Hit|if (?:this Attack|it|that Attack) Hits?|when (?:this|that) Hits?)/i.test(sentence)) return "onHit";
  if (/^after (?:this|it|that (?:card|Attack|Defense)) resolves/i.test(sentence)) return "afterResolve";
  if (/^(?:Draw|Discard|Gain|Heal|Lose|Your next|The next|Use\s*[:—-])/i.test(sentence)) return "onPlay";
  return null;
}

function operationsForSentence(sentence: string, timing: EffectTiming): CardEffect[] {
  const effects: CardEffect[] = [];
  const draw = amount(/draw (\d+) cards?/i, sentence);
  const discard = amount(/discard (\d+) cards?/i, sentence);
  const heal = amount(/heal (\d+) HP?/i, sentence);
  const focus = amount(/gain \+?(\d+) Focus/i, sentence);
  const gainSpeed = amount(/gain \+?(\d+) Speed/i, sentence);
  const loseSpeed = amount(/lose (\d+) Speed/i, sentence);
  const nextAttackPower = amount(/next (?:unarmed )?Attack[^.]*?(?:gets|gains?) \+(\d+) (?:Attack Power|damage)/i, sentence);
  if (draw) effects.push({ timing, kind: "draw", amount: draw });
  if (discard) effects.push({ timing, kind: "discard", amount: discard });
  if (heal) effects.push({ timing, kind: "heal", amount: heal });
  if (focus) effects.push({ timing, kind: "focus", amount: focus });
  if (gainSpeed) effects.push({ timing, kind: "speed", amount: gainSpeed });
  if (loseSpeed) effects.push({ timing, kind: "speed", amount: -loseSpeed });
  if (nextAttackPower) effects.push({ timing, kind: "nextAttackPower", amount: nextAttackPower });
  return effects;
}

export function compileCardEffects(text = ""): CardEffectPlan {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized || /^(?:No (?:additional )?effect|—|-)[.]?$/i.test(normalized)) return { effects: [], unsupported: [] };
  const effects: CardEffect[] = [];
  const unsupported: string[] = [];
  for (const sentence of normalized.split(/(?<=[.!?])\s+/)) {
    if (/\b(?:may|choose|up to|either|one of|optionally)\b/i.test(sentence)) { unsupported.push(sentence); continue; }
    const timing = sentenceTiming(sentence);
    if (!timing) { unsupported.push(sentence); continue; }
    const parsed = operationsForSentence(sentence, timing);
    if (parsed.length) effects.push(...parsed);
    else unsupported.push(sentence);
  }
  return { effects, unsupported };
}

export function describeEffectPlan(plan: CardEffectPlan) {
  if (!plan.effects.length) return "Printed effect is queued for a dedicated resolver; its exact text is shown in the Card Inspector.";
  const kinds = [...new Set(plan.effects.map((effect) => `${TIMING_LABELS[effect.timing]} ${effect.kind}`))];
  const remaining = plan.unsupported.length ? ` ${plan.unsupported.length} conditional clause${plan.unsupported.length === 1 ? " remains" : "s remain"} queued.` : "";
  return `Engine resolver: ${kinds.join(", ")}.${remaining}`;
}

export function effectCoverage(cards: { rulesText?: string | null }[]) {
  const relevant = cards.filter((card) => card.rulesText && !/no (additional )?effect/i.test(card.rulesText));
  const full = relevant.filter((card) => {
    const plan = compileCardEffects(card.rulesText ?? "");
    return plan.effects.length > 0 && plan.unsupported.length === 0;
  });
  const partial = relevant.filter((card) => {
    const plan = compileCardEffects(card.rulesText ?? "");
    return plan.effects.length > 0 && plan.unsupported.length > 0;
  });
  return { total: relevant.length, full: full.length, partial: partial.length, queued: relevant.length - full.length - partial.length };
}
