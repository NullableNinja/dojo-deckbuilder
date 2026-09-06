import type { FighterSide, PlaytestEvent } from "./playtest-events";

export type VfxPresentationCue =
  | { kind: "event"; event: PlaytestEvent; holdMs: number }
  | { kind: "summary"; fighter: FighterSide; labels: string[]; holdMs: number };

const isAttack = (event: PlaytestEvent) => event.type === "combat.attack";
const isResolution = (event: PlaytestEvent) => event.type === "combat.hit" || event.type === "combat.block";
const isKo = (event: PlaytestEvent) => event.type === "combat.ko";
const isMilestone = (event: PlaytestEvent) =>
  event.type === "progress.beltExam"
  || event.type === "progress.promotion"
  || event.type === "combo.completed"
  || event.type === "scene.change";

function summaryLabel(event: PlaytestEvent): { fighter: FighterSide; label: string } | null {
  switch (event.type) {
    case "vitality.heal": return { fighter: event.fighter, label: `+${event.amount} HP` };
    case "resource.focusGain": return { fighter: event.fighter, label: `+${event.amount} FOCUS` };
    case "resource.focusSpend": return { fighter: event.fighter, label: `−${event.amount} FOCUS` };
    case "resource.xpGain": return { fighter: event.fighter, label: `+${event.amount} XP` };
    case "card.draw": return { fighter: event.fighter, label: `DRAW ${event.amount}` };
    case "card.discard": return { fighter: event.fighter, label: `DISCARD ${event.amount}` };
    case "card.destroy": return { fighter: event.fighter, label: `DESTROY ${event.amount}` };
    case "tempo.used": return { fighter: event.fighter, label: "TEMPO USED" };
    case "tempo.ready": return { fighter: event.fighter, label: "TEMPO READY" };
    case "flow.ready": return { fighter: event.fighter, label: "FLOW READY" };
    case "flow.triggered": return { fighter: event.fighter, label: "FLOW" };
    case "equipment.exhaust": return { fighter: event.fighter, label: event.amount === 1 ? "EQUIPMENT EXHAUSTED" : `EQUIPMENT ×${event.amount} EXHAUSTED` };
    case "equipment.ready": return { fighter: event.fighter, label: event.amount === 1 ? "EQUIPMENT READY" : `EQUIPMENT ×${event.amount} READY` };
    case "market.purchase": return { fighter: event.fighter, label: event.amount === 1 ? "ACQUIRED" : `ACQUIRED ×${event.amount}` };
    default: return null;
  }
}

function eventHoldMs(event: PlaytestEvent) {
  switch (event.type) {
    case "combat.attack": return 760;
    case "combat.hit":
    case "combat.block": return 1250;
    case "combat.ko": return 1700;
    case "progress.promotion": return 1450;
    case "combo.completed": return 1350;
    case "progress.beltExam": return 1300;
    case "scene.change": return 1250;
    default: return 1100;
  }
}

export function buildVfxPresentationCues(events: PlaytestEvent[]): VfxPresentationCue[] {
  if (!events.length) return [];

  const attacks = events.filter(isAttack);
  const resolutions = events.filter(isResolution);
  const ko = events.find(isKo);

  // A KO should finish the visual sentence cleanly: Attack -> Hit/Block -> K.O.
  // Secondary resource/card chatter from the same transition is intentionally omitted.
  if (ko) {
    return [...attacks, ...resolutions, ko].map((event) => ({ kind: "event" as const, event, holdMs: eventHoldMs(event) }));
  }

  const promotions = new Set(
    events
      .filter((event): event is Extract<PlaytestEvent, { type: "progress.promotion" }> => event.type === "progress.promotion")
      .map((event) => event.fighter),
  );

  const milestones = events.filter((event) => {
    if (!isMilestone(event)) return false;
    // Promotion already communicates that the Belt Exam succeeded; don't immediately flash both.
    if (event.type === "progress.beltExam" && promotions.has(event.fighter)) return false;
    return true;
  });

  const summaryByFighter: Record<FighterSide, string[]> = { player: [], ai: [] };
  for (const event of events) {
    if (isAttack(event) || isResolution(event) || isKo(event) || isMilestone(event)) continue;
    const summary = summaryLabel(event);
    if (!summary) continue;
    if (!summaryByFighter[summary.fighter].includes(summary.label)) summaryByFighter[summary.fighter].push(summary.label);
  }

  const cues: VfxPresentationCue[] = [
    ...attacks.map((event) => ({ kind: "event" as const, event, holdMs: eventHoldMs(event) })),
    ...resolutions.map((event) => ({ kind: "event" as const, event, holdMs: eventHoldMs(event) })),
    ...milestones.map((event) => ({ kind: "event" as const, event, holdMs: eventHoldMs(event) })),
  ];

  for (const fighter of ["player", "ai"] as const) {
    const labels = summaryByFighter[fighter];
    if (labels.length) cues.push({ kind: "summary", fighter, labels, holdMs: 1450 });
  }

  return cues;
}
