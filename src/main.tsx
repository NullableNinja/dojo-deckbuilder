import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import CompanionApp from "../app/companion-app";
import cardsJson from "../app/data/cards.json";
import "../app/playtest-production-layout.css";
import "../app/playtest-polish.css";
import "../app/playtest-readability.css";
import "../app/playtest-acquisition-desk.css";
import "../app/playtest-hand-stage.css";
import "../app/playtest-stability-pass.css";
import "../app/playtest-ui-overhaul.css";
import "../app/playtest-final-fit.css";
import "../app/playtest-refinement-pass.css";
import "../app/playtest-overlay-fix.css";

type PresentationCard = {
  id: string;
  name: string;
  cardType: string;
  catalogId?: string | null;
  fpCost?: string | number | null;
  rulesText?: string | null;
  flavorText?: string | null;
  details?: Record<string, string | number | null>;
};

type PresentationMatch = {
  phase?: string;
  comboOfferId?: string | null;
  player?: {
    focus?: number;
    learnedCombos?: string[];
    comboAttemptedTurn?: boolean;
  };
};

const presentationCards = ((cardsJson as unknown as { cards: PresentationCard[] }).cards ?? []);
const presentationCardById = new Map(presentationCards.map((card) => [card.id, card]));
const fighterFlavorByName = new Map(
  presentationCards
    .filter((card) => card.cardType === "Character" && card.flavorText)
    .map((card) => [card.name, card.flavorText ?? ""]),
);
const comboArtModules = import.meta.glob<string>("../app/assets/cards/combos/*.webp", { eager: true, query: "?url", import: "default" });
const comboArtByCatalogId = Object.fromEntries(
  Object.entries(comboArtModules).flatMap(([path, url]) => {
    const match = path.match(/(ddb-cmb-core-\d{3})_/i);
    return match ? [[match[1].toUpperCase(), url]] : [];
  }),
);

const buildMeta = document.querySelector<HTMLMetaElement>('meta[name="ddb-build"]');
const currentBuild = buildMeta?.content;

if (currentBuild && currentBuild !== "__DDB_BUILD__") {
  fetch(`${import.meta.env.BASE_URL}build.json?ts=${Date.now()}`, { cache: "no-store" })
    .then((response) => response.ok ? response.json() as Promise<{ build?: string }> : null)
    .then((payload) => {
      const latestBuild = payload?.build;
      if (!latestBuild || latestBuild === currentBuild) return;
      const reloadKey = `ddb-reloaded-${latestBuild}`;
      if (window.sessionStorage.getItem(reloadKey)) return;
      window.sessionStorage.setItem(reloadKey, "1");
      const refreshedUrl = new URL(window.location.href);
      refreshedUrl.searchParams.set("_ddb_build", latestBuild.slice(0, 12));
      window.location.replace(refreshedUrl.toString());
    })
    .catch(() => undefined);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }, { once: true });
}

const rootElement = document.getElementById("root")!;

function presentationSlug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function readPresentationMatch(): PresentationMatch | null {
  try {
    return JSON.parse(window.localStorage.getItem("ddb-field-match") ?? "null") as PresentationMatch | null;
  } catch {
    return null;
  }
}

function setTextIfChanged(element: Element | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function waitForElement<T extends Element>(selector: string, attempts = 30): Promise<T | null> {
  return new Promise((resolve) => {
    const check = (remaining: number) => {
      const found = rootElement.querySelector<T>(selector);
      if (found || remaining <= 0) {
        resolve(found ?? null);
        return;
      }
      window.requestAnimationFrame(() => check(remaining - 1));
    };
    check(attempts);
  });
}

function ensureComboLauncher(panel: HTMLElement) {
  if (panel.dataset.side !== "player") return;

  let launch = panel.querySelector<HTMLButtonElement>(".fighter-combo-launch");
  if (!launch) {
    launch = document.createElement("button");
    launch.type = "button";
    launch.className = "fighter-combo-launch";
    launch.setAttribute("aria-label", "Open Combo docket");

    const label = document.createElement("span");
    label.textContent = "∞ COMBOS";
    const count = document.createElement("b");
    const hint = document.createElement("small");
    hint.textContent = "Open docket";
    launch.append(label, count, hint);

    launch.addEventListener("click", () => {
      rootElement.querySelector<HTMLButtonElement>(".acquisition-dockets button")?.click();
    });
    panel.append(launch);
  }

  const learned = rootElement.querySelectorAll(".fighter-column--player .active-combo-card").length;
  const nextValue = `${learned}/2`;
  const count = launch.querySelector("b");
  if (count && count.textContent !== nextValue) count.textContent = nextValue;
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

async function openCanonicalComboStep() {
  const next = rootElement.querySelector<HTMLButtonElement>(".ascend-next");
  if (!next) return null;
  next.click();
  return waitForElement<HTMLElement>(".ascend-combo");
}

async function runIntegratedComboDecision(action: "learn" | "pass") {
  if (document.body.dataset.comboBridgeActive === "1") return;
  document.body.dataset.comboBridgeActive = "1";
  try {
    const comboPanel = await openCanonicalComboStep();
    if (!comboPanel) return;

    const buttons = Array.from(comboPanel.querySelectorAll<HTMLButtonElement>(".combo-actions button"));
    const target = action === "learn"
      ? buttons.find((button) => button.classList.contains("primary"))
      : buttons.find((button) => button.classList.contains("ghost"));
    if (!target || target.disabled) return;
    target.click();

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    rootElement.querySelector<HTMLButtonElement>(".ascend-next")?.click();
  } finally {
    window.setTimeout(() => { delete document.body.dataset.comboBridgeActive; }, 140);
  }
}

async function continueIntegratedToBelt() {
  if (document.body.dataset.comboBridgeActive === "1") return;
  document.body.dataset.comboBridgeActive = "1";
  try {
    const comboPanel = await openCanonicalComboStep();
    if (!comboPanel) return;
    rootElement.querySelector<HTMLButtonElement>(".ascend-next")?.click();
  } finally {
    window.setTimeout(() => { delete document.body.dataset.comboBridgeActive; }, 140);
  }
}

function buildFeaturedComboPanel(card: PresentationCard, match: PresentationMatch) {
  const panel = document.createElement("aside");
  panel.className = "ascend-featured-combo";
  panel.dataset.comboId = card.id;
  const learned = match.player?.learnedCombos?.length ?? 0;
  const focus = match.player?.focus ?? 0;
  const attempted = Boolean(match.player?.comboAttemptedTurn);
  panel.dataset.state = `${card.id}|${focus}|${learned}|${attempted ? 1 : 0}`;

  const heading = document.createElement("header");
  const headingCopy = document.createElement("div");
  headingCopy.append(
    createTextElement("span", "eyebrow", "FEATURED COMBO · SAME DECISION DESK"),
    createTextElement("h3", "", card.name),
  );
  const state = createTextElement("span", "ascend-featured-combo-state", attempted ? "FILED" : `${learned}/2 LEARNED`);
  heading.append(headingCopy, state);

  const cardVisual = document.createElement("div");
  cardVisual.className = "ascend-featured-combo-card";
  const art = card.catalogId ? comboArtByCatalogId[String(card.catalogId).toUpperCase()] : undefined;
  if (art) {
    const image = document.createElement("img");
    image.src = art;
    image.alt = card.name;
    cardVisual.append(image);
  } else {
    cardVisual.classList.add("is-fallback");
    cardVisual.textContent = card.name;
  }

  const metadata = document.createElement("div");
  metadata.className = "ascend-featured-combo-meta";
  metadata.append(
    createTextElement("b", "", `${Number(card.fpCost ?? 0)} FOCUS`),
    createTextElement("span", "", String(card.catalogId ?? "COMBO OFFER")),
  );

  const requirement = String(card.details?.["Sequence / Requirement"] ?? "See the printed Combo requirement.");
  const effect = String(card.details?.Effect ?? card.rulesText ?? "See the printed Combo payoff.");
  const copy = document.createElement("div");
  copy.className = "ascend-featured-combo-copy";
  const req = document.createElement("p");
  req.append(createTextElement("b", "", "REQUIREMENT"), document.createTextNode(requirement));
  const payoff = document.createElement("p");
  payoff.append(createTextElement("b", "", "PAYOFF"), document.createTextNode(effect));
  copy.append(req, payoff);
  if (card.flavorText) copy.append(createTextElement("em", "", card.flavorText));

  const actions = document.createElement("div");
  actions.className = "ascend-featured-combo-actions";
  if (attempted) {
    actions.append(createTextElement("strong", "ascend-featured-combo-filed", "Combo decision filed for this Ascend."));
    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "button primary";
    continueButton.textContent = "Continue to Belt Check →";
    continueButton.addEventListener("click", () => { void continueIntegratedToBelt(); });
    actions.append(continueButton);
  } else {
    const cost = Number(card.fpCost ?? 0);
    const learn = document.createElement("button");
    learn.type = "button";
    learn.className = "button primary";
    learn.textContent = `Learn ${card.name}`;
    learn.disabled = focus < cost || learned >= 2;
    learn.addEventListener("click", () => { void runIntegratedComboDecision("learn"); });

    const pass = document.createElement("button");
    pass.type = "button";
    pass.className = "button ghost";
    pass.textContent = "Pass Combo → Belt Check";
    pass.addEventListener("click", () => { void runIntegratedComboDecision("pass"); });
    actions.append(learn, pass);
  }

  panel.append(heading, cardVisual, metadata, copy, actions);
  return panel;
}

function syncAscendPresentation() {
  const market = rootElement.querySelector<HTMLElement>(".ascend-market");
  const comboPanel = rootElement.querySelector<HTMLElement>(".ascend-combo");
  const match = readPresentationMatch();

  if (comboPanel && match?.phase === "player-ascend" && document.body.dataset.comboBridgeActive !== "1") {
    rootElement.querySelector<HTMLButtonElement>(".ascend-guide-actions > button.button.ghost")?.click();
    return;
  }

  if (!market || !match) {
    rootElement.querySelectorAll<HTMLElement>(".ascend-desk--integrated-acquisition").forEach((desk) => desk.classList.remove("ascend-desk--integrated-acquisition"));
    return;
  }

  const offer = match.comboOfferId ? presentationCardById.get(match.comboOfferId) : null;
  const existing = market.querySelector<HTMLElement>(".ascend-featured-combo");
  if (!offer) {
    existing?.remove();
    return;
  }

  const learned = match.player?.learnedCombos?.length ?? 0;
  const focus = match.player?.focus ?? 0;
  const attempted = Boolean(match.player?.comboAttemptedTurn);
  const stateKey = `${offer.id}|${focus}|${learned}|${attempted ? 1 : 0}`;
  if (!existing || existing.dataset.state !== stateKey) {
    const featured = buildFeaturedComboPanel(offer, match);
    if (existing) existing.replaceWith(featured);
    else {
      const marketHeader = market.querySelector(":scope > header");
      if (marketHeader) marketHeader.insertAdjacentElement("afterend", featured);
      else market.prepend(featured);
    }
  }

  const desk = market.closest<HTMLElement>(".ascend-desk");
  if (!desk) return;
  desk.classList.add("ascend-desk--integrated-acquisition");
  setTextIfChanged(desk.querySelector("#ascend-desk-title"), "Acquisition Desk");
  setTextIfChanged(desk.querySelector(".ascend-desk-header p"), "Compare the seven-card Shared Market with the face-up Combo offer, spend Focus once, then check your Belt.");
  setTextIfChanged(desk.querySelector(".ascend-desk-header .eyebrow"), "ASCEND REVIEW · ACQUISITION + COMBO");

  const guideItems = Array.from(desk.querySelectorAll<HTMLElement>(".ascend-guide li"));
  if (guideItems[0]) {
    setTextIfChanged(guideItems[0].querySelector("b"), "1");
    setTextIfChanged(guideItems[0].querySelector("span"), "ACQUISITION DESK");
    setTextIfChanged(guideItems[0].querySelector("small"), "Market + Combo");
  }
  if (guideItems[2]) {
    setTextIfChanged(guideItems[2].querySelector("b"), "2");
    setTextIfChanged(guideItems[2].querySelector("span"), "BELT CHECK");
  }
  if (guideItems[3]) {
    setTextIfChanged(guideItems[3].querySelector("b"), "3");
    setTextIfChanged(guideItems[3].querySelector("span"), "HIDE");
  }
}

/* Presentation metadata deliberately lives outside canonical game data. It lets
   the final CSS use printed Belt identity and fighter identity without changing
   card records or teaching layout concerns to the game engine. Ascend's visual
   acquisition desk forwards to the existing canonical Combo Learn/Pass handlers
   instead of duplicating Combo rules in the presentation layer. */
function syncPresentationMetadata() {
  rootElement.querySelectorAll<HTMLElement>(".fighter-panel.living-fighter-card").forEach((panel) => {
    const fighterName = panel.querySelector<HTMLElement>(".fighter-dossier-name")?.textContent?.trim();
    if (fighterName) {
      panel.dataset.fighter = presentationSlug(fighterName);
      const heading = panel.querySelector<HTMLElement>(".fighter-card-heading");
      const flavor = fighterFlavorByName.get(fighterName);
      if (heading && flavor) heading.dataset.flavor = flavor;
      else if (heading) delete heading.dataset.flavor;
    }

    ensureComboLauncher(panel);

    const beltBadge = panel.querySelector<HTMLElement>(".fighter-belt-badge");
    if (!beltBadge) return;
    const directText = Array.from(beltBadge.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .trim();
    const beltName = directText || beltBadge.textContent?.replace(/belt/gi, "").trim() || "white";
    beltBadge.dataset.belt = presentationSlug(beltName);
  });
  syncAscendPresentation();
}

let presentationSyncQueued = false;
const fighterPresentationObserver = new MutationObserver(() => {
  if (presentationSyncQueued) return;
  presentationSyncQueued = true;
  window.requestAnimationFrame(() => {
    presentationSyncQueued = false;
    syncPresentationMetadata();
  });
});
fighterPresentationObserver.observe(rootElement, { childList: true, subtree: true, characterData: true });
window.requestAnimationFrame(syncPresentationMetadata);

createRoot(rootElement).render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);