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
  name: string;
  cardType: string;
  flavorText?: string | null;
};

const fighterFlavorByName = new Map(
  ((cardsJson as unknown as { cards: PresentationCard[] }).cards ?? [])
    .filter((card) => card.cardType === "Character" && card.flavorText)
    .map((card) => [card.name, card.flavorText ?? ""]),
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

/* Presentation metadata deliberately lives outside canonical game data. It lets
   the final CSS use printed Belt identity and fighter identity without changing
   card records or teaching layout concerns to the game engine. The Combo launch
   is also presentation-only: it forwards to the existing canonical docket UI.
   Fighter flavor is read from the generated canonical catalog and exposed as a
   data attribute so the living card can display it without duplicating content. */
function syncFighterPresentationMetadata() {
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
}

let presentationSyncQueued = false;
const fighterPresentationObserver = new MutationObserver(() => {
  if (presentationSyncQueued) return;
  presentationSyncQueued = true;
  window.requestAnimationFrame(() => {
    presentationSyncQueued = false;
    syncFighterPresentationMetadata();
  });
});
fighterPresentationObserver.observe(rootElement, { childList: true, subtree: true, characterData: true });
window.requestAnimationFrame(syncFighterPresentationMetadata);

createRoot(rootElement).render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);
