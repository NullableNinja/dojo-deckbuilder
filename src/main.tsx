import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import CompanionApp from "../app/companion-app";
import "../app/playtest-production-layout.css";
import "../app/playtest-polish.css";
import "../app/playtest-readability.css";
import "../app/playtest-acquisition-desk.css";
import "../app/playtest-hand-stage.css";
import "../app/playtest-stability-pass.css";
import "../app/playtest-ui-overhaul.css";

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

/* Presentation metadata deliberately lives outside canonical game data. It lets
   the final CSS use the printed Belt name and fighter identity without changing
   card records or teaching layout concerns to the game engine. */
function syncFighterPresentationMetadata() {
  rootElement.querySelectorAll<HTMLElement>(".fighter-panel.living-fighter-card").forEach((panel) => {
    const fighterName = panel.querySelector<HTMLElement>(".fighter-dossier-name")?.textContent?.trim();
    if (fighterName) panel.dataset.fighter = presentationSlug(fighterName);

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

const fighterPresentationObserver = new MutationObserver(() => {
  window.requestAnimationFrame(syncFighterPresentationMetadata);
});
fighterPresentationObserver.observe(rootElement, { childList: true, subtree: true, characterData: true });
window.requestAnimationFrame(syncFighterPresentationMetadata);

createRoot(rootElement).render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);
