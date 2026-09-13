import { canonicalTrainingStripeBelts, canonicalTrainingStripeConfig } from "./training-stripes-config.ts";
import {
  QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT,
  quickDuelTrainingStripeHealingAvailability,
  type QuickDuelTrainingStripeMatch,
} from "./quick-duel-training-stripes.ts";
import { trainingStripeEligibility, trainingStripeState, type TrainingStripeBoard } from "./training-stripes.ts";

const MATCH_STORAGE_KEY = "ddb-field-match";
let installed = false;

type SavedStripeMatch = QuickDuelTrainingStripeMatch<TrainingStripeBoard> & { phase?: string };

function savedMatch(): SavedStripeMatch | null {
  try {
    const raw = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (!raw) return null;
    const match = JSON.parse(raw) as SavedStripeMatch;
    return match?.player && match?.ai && Array.isArray(match.turnOrder) ? match : null;
  } catch {
    return null;
  }
}

function ensureStripeRack(panel: HTMLElement) {
  let rack = panel.querySelector<HTMLElement>("[data-training-stripes]");
  if (rack) return rack;

  rack = document.createElement("section");
  rack.className = "training-stripe-rack";
  rack.dataset.trainingStripes = "true";
  rack.setAttribute("aria-live", "polite");
  rack.innerHTML = `
    <div class="training-stripe-copy">
      <span>Training stripes</span>
      <b><strong data-training-stripe-count>0</strong> / <span data-training-stripe-max>0</span></b>
      <small data-training-stripe-status>Keep training. The clipboard is watching.</small>
      <button type="button" class="training-stripe-heal" data-training-stripe-heal disabled>
        <span data-training-stripe-heal-label>Stripe recovery unavailable</span>
        <small data-training-stripe-heal-note></small>
      </button>
    </div>
    <div class="training-belt-strip" aria-hidden="true">
      <i class="training-belt-knot"></i>
      <div class="training-stripe-slots" data-training-stripe-slots></div>
      <i class="training-belt-tail training-belt-tail-a"></i>
      <i class="training-belt-tail training-belt-tail-b"></i>
    </div>`;

  const healButton = rack.querySelector<HTMLButtonElement>("[data-training-stripe-heal]");
  healButton?.addEventListener("click", () => {
    if (healButton.disabled) return;
    window.dispatchEvent(new CustomEvent(QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT));
  });

  const ledger = panel.querySelector(".belt-ledger-list");
  if (ledger) panel.insertBefore(rack, ledger);
  else panel.appendChild(rack);
  return rack;
}

function stripeStatus(board: TrainingStripeBoard) {
  const config = canonicalTrainingStripeConfig;
  const result = trainingStripeEligibility(board, config);
  const state = result.state;
  if (!config.rule.enabled) return "Training stripes are disabled for this format.";
  if (result.threshold === null) return "Full curriculum certified. No further Belt stripes are issued.";
  if (result.examComplete && result.xpMet) return "Promotion ready · stripes pause while certification is available.";
  if (!result.xpMet) return `Unlocks at ${result.threshold} XP if the next Belt Exam is still incomplete.`;
  if (result.awardCapReached || result.heldCapReached) return "Stripe limit reached for this Belt. Finish the Exam when you can.";
  if (state.provisional) return "XP ready · one new training stripe staged for this Belt Check.";
  return "XP ready · next Belt Exam still in progress.";
}

function healingCopy(match: SavedStripeMatch) {
  const availability = quickDuelTrainingStripeHealingAvailability(match, "player", "belt-check");
  const spend = canonicalTrainingStripeConfig.rule.spend;
  const label = spend?.enabled
    ? `Spend ${availability.stripeCost} Stripe${availability.stripeCost === 1 ? "" : "s"} · Recover ${availability.healHp} HP`
    : "Stripe recovery unavailable";

  if (!spend?.enabled) return { availability, label, note: "Stripe recovery is disabled for this format." };
  if (!availability.timingAllowed) return { availability, label, note: "Recovery opens during your Belt Check." };
  if (availability.atFullHp) return { availability, label, note: "Already at Max HP." };
  if (availability.spendsThisTurn >= availability.usesPerTurn) return { availability, label, note: "Stripe recovery already used this turn." };
  if (availability.spendableHeld < availability.stripeCost && availability.provisionalReserved > 0) {
    return { availability, label, note: "Your newly earned Stripe becomes spendable on a later turn." };
  }
  if (availability.spendableHeld < availability.stripeCost) return { availability, label, note: "No previously earned Stripe is available to spend." };
  return { availability, label, note: `Recover up to ${availability.healHp} HP without exceeding ${availability.maxHp} Max HP.` };
}

function decorateBeltPanel(panel: HTMLElement, match: SavedStripeMatch) {
  const board = match.player;
  const beltIndex = Math.max(0, Math.trunc(Number(board.belt ?? 0)));
  const track = panel.querySelector<HTMLElement>(".belt-track");
  if (track) {
    Array.from(track.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return;
      const belt = canonicalTrainingStripeBelts[index];
      child.classList.toggle("is-past-belt", index < beltIndex);
      child.classList.toggle("is-current-belt", index === beltIndex);
      child.classList.toggle("is-future-belt", index > beltIndex);
      if (belt) {
        child.dataset.beltId = belt.id;
        child.style.setProperty("--belt-rank", belt.color);
        child.setAttribute("aria-label", `${belt.name} Belt`);
      }
    });
  }

  const rack = ensureStripeRack(panel);
  const state = trainingStripeState(board);
  const currentBelt = canonicalTrainingStripeBelts[beltIndex];
  const maxHeld = Math.max(0, Math.trunc(Number(canonicalTrainingStripeConfig.rule.maxHeld) || 0));
  rack.style.setProperty("--current-belt", currentBelt?.color ?? "#f5f0df");
  rack.dataset.beltId = currentBelt?.id ?? "white";
  rack.hidden = !canonicalTrainingStripeConfig.rule.enabled || !canonicalTrainingStripeBelts[beltIndex + 1];
  rack.setAttribute("aria-label", `${state.held} of ${maxHeld} Training Stripes on ${currentBelt?.name ?? "current"} Belt`);

  const count = rack.querySelector<HTMLElement>("[data-training-stripe-count]");
  const max = rack.querySelector<HTMLElement>("[data-training-stripe-max]");
  const status = rack.querySelector<HTMLElement>("[data-training-stripe-status]");
  if (count && count.textContent !== String(state.held)) count.textContent = String(state.held);
  if (max && max.textContent !== String(maxHeld)) max.textContent = String(maxHeld);
  if (status) {
    const nextStatus = stripeStatus(board);
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
  }

  const slots = rack.querySelector<HTMLElement>("[data-training-stripe-slots]");
  if (slots && slots.children.length !== maxHeld) {
    slots.replaceChildren(...Array.from({ length: maxHeld }, (_, index) => {
      const stripe = document.createElement("i");
      stripe.dataset.trainingStripeSlot = String(index + 1);
      return stripe;
    }));
  }
  if (slots) {
    Array.from(slots.children).forEach((slot, index) => {
      if (slot instanceof HTMLElement) slot.classList.toggle("is-earned", index < state.held);
    });
  }

  const recovery = healingCopy(match);
  const healButton = rack.querySelector<HTMLButtonElement>("[data-training-stripe-heal]");
  const healLabel = rack.querySelector<HTMLElement>("[data-training-stripe-heal-label]");
  const healNote = rack.querySelector<HTMLElement>("[data-training-stripe-heal-note]");
  if (healButton) {
    healButton.disabled = !recovery.availability.canSpend;
    healButton.classList.toggle("is-ready", recovery.availability.canSpend);
    healButton.dataset.stripeSpendable = String(recovery.availability.spendableHeld);
  }
  if (healLabel && healLabel.textContent !== recovery.label) healLabel.textContent = recovery.label;
  if (healNote && healNote.textContent !== recovery.note) healNote.textContent = recovery.note;
}

function refreshBeltCheck() {
  const match = savedMatch();
  if (!match) return;
  document.querySelectorAll<HTMLElement>(".ascend-belt.belt-panel").forEach((panel) => decorateBeltPanel(panel, match));
}

export function installBeltCheckTrainingStripes() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;
  let queued = false;
  const queueRefresh = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      refreshBeltCheck();
    });
  };

  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("storage", queueRefresh);
  window.addEventListener("focus", queueRefresh);
  window.addEventListener(QUICK_DUEL_TRAINING_STRIPE_HEAL_REQUEST_EVENT, queueRefresh);
  queueRefresh();
}
