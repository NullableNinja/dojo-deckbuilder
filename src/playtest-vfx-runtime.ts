import "../app/playtest-vfx.css";
import { derivePlaytestEvents, dispatchPlaytestEvent, PLAYTEST_EVENT_NAME, type FighterSide, type PlaytestEvent, type PlaytestMatchSnapshot } from "./playtest-events";
import { buildVfxPresentationCues, type VfxPresentationCue } from "./playtest-vfx-presentation";

type VfxWindow = Window & { __ddbPlaytestVfxInstalled?: boolean };
type VfxMode = "full" | "reduced" | "off";

const MATCH_KEY = "ddb-field-match";
const MODE_KEY = "ddb-vfx-mode";
const CUE_GAP_MS = 140;
const MAX_PENDING_CUES = 14;
const vfxWindow = window as VfxWindow;

const presentationQueue: VfxPresentationCue[] = [];
let presentationRunning = false;
let bridgeDispatchDepth = 0;

function parseMatch(value: string | null): PlaytestMatchSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PlaytestMatchSnapshot;
    return parsed?.schema === 8 ? parsed : null;
  } catch {
    return null;
  }
}

function vfxMode(): VfxMode {
  const stored = window.localStorage.getItem(MODE_KEY);
  if (stored === "off" || stored === "reduced" || stored === "full") return stored;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

function fighterElement(side: FighterSide) {
  return document.querySelector<HTMLElement>(`.playtest-shell--live .living-fighter-card[data-side="${side}"]`);
}

function shellElement() {
  return document.querySelector<HTMLElement>(".playtest-shell--live");
}

function ensureLayer() {
  let layer = document.querySelector<HTMLElement>(".playtest-vfx-layer");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "playtest-vfx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  return layer;
}

function ensureAnnouncer() {
  let announcer = document.querySelector<HTMLElement>(".playtest-vfx-announcer");
  if (announcer) return announcer;
  announcer = document.createElement("div");
  announcer.className = "playtest-vfx-announcer";
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  document.body.append(announcer);
  return announcer;
}

function announce(message: string) {
  const announcer = ensureAnnouncer();
  announcer.textContent = "";
  window.setTimeout(() => { announcer.textContent = message; }, 20);
}

function pulse(element: HTMLElement | null, className: string, duration = 520) {
  if (!element || vfxMode() === "off") return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), vfxMode() === "reduced" ? Math.min(duration, 220) : duration);
}

function anchoredPosition(side: FighterSide, offset: number) {
  const anchor = fighterElement(side);
  if (!anchor) return { x: side === "player" ? "28vw" : "72vw", y: "27vh" };
  const rect = anchor.getBoundingClientRect();
  const x = `${Math.max(90, Math.min(window.innerWidth - 90, rect.left + rect.width / 2))}px`;
  const anchorIsUpperHalf = rect.top + rect.height / 2 < window.innerHeight / 2;
  const rawY = anchorIsUpperHalf ? rect.bottom + offset : rect.top - offset;
  const y = `${Math.max(74, Math.min(window.innerHeight - 74, rawY))}px`;
  return { x, y };
}

function cueLabel(side: FighterSide, label: string, tone: string, duration: number, lane: "combat" | "summary" = "combat") {
  if (vfxMode() === "off") return;
  document.querySelectorAll(".playtest-vfx-cue").forEach((node) => node.remove());
  const layer = ensureLayer();
  const node = document.createElement("div");
  node.className = `playtest-vfx-cue playtest-vfx-cue--${lane} playtest-vfx-cue--${tone}`;
  node.textContent = label;
  const position = anchoredPosition(side, lane === "combat" ? 28 : 78);
  node.style.setProperty("--vfx-x", position.x);
  node.style.setProperty("--vfx-y", position.y);
  node.style.animationDuration = `${vfxMode() === "reduced" ? Math.min(duration, 420) : duration}ms`;
  layer.append(node);
  window.setTimeout(() => node.remove(), vfxMode() === "reduced" ? Math.min(duration, 440) : duration + 30);
}

function centerBanner(label: string, tone: string, duration = 1200) {
  if (vfxMode() === "off") return;
  document.querySelectorAll(".playtest-vfx-banner").forEach((node) => node.remove());
  const layer = ensureLayer();
  const node = document.createElement("div");
  node.className = `playtest-vfx-banner playtest-vfx-banner--${tone}`;
  node.textContent = label;
  node.style.animationDuration = `${vfxMode() === "reduced" ? Math.min(duration, 460) : duration}ms`;
  layer.append(node);
  window.setTimeout(() => node.remove(), vfxMode() === "reduced" ? Math.min(duration, 480) : duration + 30);
}

function renderEvent(event: PlaytestEvent, holdMs: number) {
  if (vfxMode() === "off" || !shellElement()) return;

  switch (event.type) {
    case "combat.attack": {
      pulse(fighterElement(event.actor), "ddb-vfx-attack", 520);
      pulse(fighterElement(event.target), "ddb-vfx-brace", 520);
      cueLabel(event.actor, event.zone ? `${event.zone.toUpperCase()} STRIKE` : "ATTACK", "attack", holdMs);
      break;
    }
    case "combat.hit": {
      pulse(fighterElement(event.target), "ddb-vfx-hit", 700);
      cueLabel(event.target, event.amount > 0 ? `−${event.amount} HP` : "HIT!", "damage", holdMs);
      if (event.amount >= 5) pulse(shellElement(), "ddb-vfx-screen-impact", 520);
      announce(event.amount > 0
        ? `${event.target === "player" ? "You take" : "Opponent takes"} ${event.amount} damage.`
        : `${event.target === "player" ? "The attack hits you" : "The attack hits the opponent"} but deals no damage.`);
      break;
    }
    case "combat.block": {
      pulse(fighterElement(event.target), "ddb-vfx-block", 760);
      cueLabel(event.target, "BLOCK!", "block", holdMs);
      announce(event.target === "player" ? "Attack blocked." : "Opponent blocks the attack.");
      break;
    }
    case "combat.ko": {
      pulse(fighterElement(event.fighter), "ddb-vfx-ko", 1400);
      centerBanner("K.O.", "ko", holdMs);
      pulse(shellElement(), "ddb-vfx-screen-impact", 800);
      announce(event.winner === "player" ? "Knockout. You win." : "Knockout. Opponent wins.");
      break;
    }
    case "progress.beltExam":
      pulse(fighterElement(event.fighter), "ddb-vfx-certified", 800);
      cueLabel(event.fighter, "EXAM CERTIFIED", "certified", holdMs);
      break;
    case "progress.promotion":
      pulse(fighterElement(event.fighter), "ddb-vfx-certified", 900);
      centerBanner(event.fighter === "player" ? "BELT UP!" : "OPPONENT PROMOTES", "promotion", holdMs);
      announce(event.fighter === "player" ? "Belt promotion complete." : "Opponent promoted a belt rank.");
      break;
    case "combo.completed":
      pulse(fighterElement(event.fighter), "ddb-vfx-combo", 760);
      centerBanner(event.amount > 1 ? `COMBO ×${event.amount}!` : "COMBO!", "combo", holdMs);
      break;
    case "scene.change":
      pulse(shellElement(), "ddb-vfx-scene", 800);
      centerBanner("SCENE CHANGE", "scene", holdMs);
      break;
    default:
      // Routine resource/card/equipment events are intentionally condensed into
      // one readable summary ticket by buildVfxPresentationCues().
      break;
  }
}

function renderCue(cue: VfxPresentationCue) {
  if (cue.kind === "event") {
    renderEvent(cue.event, cue.holdMs);
    return;
  }

  const label = cue.labels.join("  ·  ");
  cueLabel(cue.fighter, label, "summary", cue.holdMs, "summary");
  announce(`${cue.fighter === "player" ? "Your" : "Opponent"} results: ${cue.labels.join(", ")}.`);
}

function cueDelay(cue: VfxPresentationCue) {
  if (vfxMode() === "reduced") return Math.min(cue.holdMs, 440) + 70;
  return cue.holdMs + CUE_GAP_MS;
}

function drainPresentationQueue() {
  if (presentationRunning || vfxMode() === "off") return;
  const cue = presentationQueue.shift();
  if (!cue) return;
  presentationRunning = true;
  renderCue(cue);
  window.setTimeout(() => {
    presentationRunning = false;
    drainPresentationQueue();
  }, cueDelay(cue));
}

function enqueuePresentation(events: PlaytestEvent[]) {
  if (!events.length || vfxMode() === "off") return;
  const cues = buildVfxPresentationCues(events);

  // If rapid actions create a backlog, drop only stale routine summaries first.
  // Combat and milestone cues are never discarded.
  while (presentationQueue.length + cues.length > MAX_PENDING_CUES) {
    const staleSummary = presentationQueue.findIndex((cue) => cue.kind === "summary");
    if (staleSummary < 0) break;
    presentationQueue.splice(staleSummary, 1);
  }

  presentationQueue.push(...cues);
  drainPresentationQueue();
}

function installMatchStateBridge() {
  if (vfxWindow.__ddbPlaytestVfxInstalled) return;
  vfxWindow.__ddbPlaytestVfxInstalled = true;

  let previous = parseMatch(window.localStorage.getItem(MATCH_KEY));
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
    if (this === window.localStorage && key === MATCH_KEY) {
      const next = parseMatch(value);
      const events = derivePlaytestEvents(previous, next);
      previous = next;

      // Preserve the semantic event bus for future audio/accessibility subscribers,
      // while batching this same state transition into one readable visual sentence.
      bridgeDispatchDepth += 1;
      try {
        for (const event of events) dispatchPlaytestEvent(event);
      } finally {
        bridgeDispatchDepth -= 1;
      }
      enqueuePresentation(events);
    }
    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key: string) {
    if (this === window.localStorage && key === MATCH_KEY) {
      previous = null;
      presentationQueue.length = 0;
    }
    return originalRemoveItem.call(this, key);
  };

  window.addEventListener(PLAYTEST_EVENT_NAME, ((customEvent: Event) => {
    // Events raised by another future subsystem still receive VFX. Events dispatched
    // by our own state bridge are already queued as a batch and must not be duplicated.
    if (bridgeDispatchDepth > 0) return;
    enqueuePresentation([(customEvent as CustomEvent<PlaytestEvent>).detail]);
  }) as EventListener);
}

installMatchStateBridge();
