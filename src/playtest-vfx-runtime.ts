import "../app/playtest-vfx.css";
import { derivePlaytestEvents, dispatchPlaytestEvent, PLAYTEST_EVENT_NAME, type FighterSide, type PlaytestEvent, type PlaytestMatchSnapshot } from "./playtest-events";

type VfxWindow = Window & { __ddbPlaytestVfxInstalled?: boolean };

type VfxMode = "full" | "reduced" | "off";

const MATCH_KEY = "ddb-field-match";
const MODE_KEY = "ddb-vfx-mode";
const vfxWindow = window as VfxWindow;

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
  return document.querySelector<HTMLElement>(side === "player" ? ".playtest-shell--live .versus-player" : ".playtest-shell--live .versus-enemy");
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

function floatLabel(side: FighterSide | null, label: string, tone: string, duration = 850) {
  if (vfxMode() === "off") return;
  const layer = ensureLayer();
  const node = document.createElement("div");
  node.className = `playtest-vfx-float playtest-vfx-float--${tone}`;
  node.textContent = label;

  const anchor = side ? fighterElement(side) : shellElement();
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    node.style.setProperty("--vfx-x", `${rect.left + rect.width / 2}px`);
    node.style.setProperty("--vfx-y", `${rect.top + Math.min(rect.height * 0.68, 74)}px`);
  } else {
    node.style.setProperty("--vfx-x", "50vw");
    node.style.setProperty("--vfx-y", "26vh");
  }
  layer.append(node);
  window.setTimeout(() => node.remove(), vfxMode() === "reduced" ? Math.min(duration, 320) : duration);
}

function centerBanner(label: string, tone: string, duration = 1100) {
  if (vfxMode() === "off") return;
  const layer = ensureLayer();
  const node = document.createElement("div");
  node.className = `playtest-vfx-banner playtest-vfx-banner--${tone}`;
  node.textContent = label;
  layer.append(node);
  window.setTimeout(() => node.remove(), vfxMode() === "reduced" ? Math.min(duration, 420) : duration);
}

function renderEvent(event: PlaytestEvent) {
  if (vfxMode() === "off" || !shellElement()) return;

  switch (event.type) {
    case "combat.attack": {
      pulse(fighterElement(event.actor), "ddb-vfx-attack", 380);
      pulse(fighterElement(event.target), "ddb-vfx-brace", 380);
      if (event.zone) floatLabel(event.actor, `${event.zone.toUpperCase()} STRIKE`, "attack", 620);
      break;
    }
    case "combat.hit": {
      pulse(fighterElement(event.target), "ddb-vfx-hit", 520);
      floatLabel(event.target, event.amount > 0 ? `−${event.amount} HP` : "HIT!", "damage");
      if (event.amount >= 5) pulse(shellElement(), "ddb-vfx-screen-impact", 420);
      announce(event.amount > 0
        ? `${event.target === "player" ? "You take" : "Opponent takes"} ${event.amount} damage.`
        : `${event.target === "player" ? "The attack hits you" : "The attack hits the opponent"} but deals no damage.`);
      break;
    }
    case "combat.block": {
      pulse(fighterElement(event.target), "ddb-vfx-block", 560);
      floatLabel(event.target, "BLOCK!", "block");
      announce(event.target === "player" ? "Attack blocked." : "Opponent blocks the attack.");
      break;
    }
    case "combat.ko": {
      pulse(fighterElement(event.fighter), "ddb-vfx-ko", 1200);
      centerBanner("K.O.", "ko", 1500);
      pulse(shellElement(), "ddb-vfx-screen-impact", 700);
      announce(event.winner === "player" ? "Knockout. You win." : "Knockout. Opponent wins.");
      break;
    }
    case "vitality.heal":
      pulse(fighterElement(event.fighter), "ddb-vfx-heal", 520);
      floatLabel(event.fighter, `+${event.amount} HP`, "heal");
      break;
    case "resource.focusGain":
      pulse(fighterElement(event.fighter), "ddb-vfx-focus", 480);
      floatLabel(event.fighter, `+${event.amount} FOCUS`, "focus");
      break;
    case "resource.focusSpend":
      floatLabel(event.fighter, `−${event.amount} FOCUS`, "focus-spend", 660);
      break;
    case "resource.xpGain":
      pulse(fighterElement(event.fighter), "ddb-vfx-xp", 500);
      floatLabel(event.fighter, `+${event.amount} XP`, "xp", 760);
      break;
    case "card.draw":
      floatLabel(event.fighter, `DRAW +${event.amount}`, "draw", 620);
      break;
    case "card.discard":
      floatLabel(event.fighter, `DISCARD ×${event.amount}`, "discard", 650);
      break;
    case "card.destroy":
      pulse(fighterElement(event.fighter), "ddb-vfx-destroy", 520);
      floatLabel(event.fighter, `DESTROY ×${event.amount}`, "destroy", 780);
      break;
    case "tempo.used":
      floatLabel(event.fighter, "TEMPO!", "tempo", 620);
      break;
    case "tempo.ready":
      pulse(fighterElement(event.fighter), "ddb-vfx-ready", 420);
      floatLabel(event.fighter, "TEMPO READY", "ready", 600);
      break;
    case "flow.ready":
      pulse(fighterElement(event.fighter), "ddb-vfx-flow", 520);
      floatLabel(event.fighter, "FLOW READY", "flow", 680);
      break;
    case "flow.triggered":
      pulse(fighterElement(event.fighter), "ddb-vfx-flow", 520);
      floatLabel(event.fighter, "FLOW!", "flow", 650);
      break;
    case "equipment.exhaust":
      floatLabel(event.fighter, event.amount === 1 ? "EQUIPMENT EXHAUSTED" : `EQUIPMENT ×${event.amount} EXHAUSTED`, "equipment", 760);
      break;
    case "equipment.ready":
      pulse(fighterElement(event.fighter), "ddb-vfx-ready", 420);
      floatLabel(event.fighter, event.amount === 1 ? "EQUIPMENT READY" : `EQUIPMENT ×${event.amount} READY`, "ready", 700);
      break;
    case "market.purchase":
      pulse(fighterElement(event.fighter), "ddb-vfx-purchase", 460);
      floatLabel(event.fighter, event.amount === 1 ? "ACQUIRED" : `ACQUIRED ×${event.amount}`, "purchase", 720);
      break;
    case "progress.beltExam":
      pulse(fighterElement(event.fighter), "ddb-vfx-certified", 680);
      floatLabel(event.fighter, "EXAM CERTIFIED", "certified", 900);
      break;
    case "progress.promotion":
      pulse(fighterElement(event.fighter), "ddb-vfx-certified", 820);
      centerBanner(event.fighter === "player" ? "BELT UP!" : "OPPONENT PROMOTES", "promotion", 1050);
      announce(event.fighter === "player" ? "Belt promotion complete." : "Opponent promoted a belt rank.");
      break;
    case "combo.completed":
      pulse(fighterElement(event.fighter), "ddb-vfx-combo", 660);
      centerBanner("COMBO!", "combo", 900);
      break;
    case "scene.change":
      pulse(shellElement(), "ddb-vfx-scene", 720);
      centerBanner("SCENE CHANGE", "scene", 850);
      break;
  }
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
      for (const event of events) dispatchPlaytestEvent(event);
    }
    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key: string) {
    if (this === window.localStorage && key === MATCH_KEY) previous = null;
    return originalRemoveItem.call(this, key);
  };

  window.addEventListener(PLAYTEST_EVENT_NAME, ((customEvent: Event) => {
    renderEvent((customEvent as CustomEvent<PlaytestEvent>).detail);
  }) as EventListener);
}

installMatchStateBridge();
