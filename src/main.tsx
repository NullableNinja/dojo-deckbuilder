import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import CompanionApp from "../app/companion-app";
import CardViewerLifecycle, { prepareCardRouteAlias } from "../app/card-viewer-lifecycle";
import SearchPage from "../app/search-page";
import MobileSitePolish from "../app/mobile-site-polish";
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
import "../app/playtest-functional-recovery.css";
import "../app/card-inspector.css";
import "../app/mobile-site-polish.css";
import "../app/card-inspector-host-fix.css";
import "../app/playtest-collision-guard.css";
import "../app/playtest-graphics-fix.css";
import "../app/rulings-variants.css";
import "../app/playtest-card-surface.css";
import "../app/playtest-market-card-polish.css";
import "../app/card-library-art-consistency.css";
import "../app/playtest-user-facing-polish.css";
import "../app/playtest-house-rule-layout-fix.css";

const buildMeta = document.querySelector<HTMLMetaElement>('meta[name="ddb-build"]');
const currentBuild = buildMeta?.content;

// #card/DDB-... is the public Dossier route. Translate it to the Card Library's
// existing internal route before CompanionApp performs its first hash sync; the
// lifecycle restores the canonical singular route once the inspector mounts.
prepareCardRouteAlias();

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
    let refreshingForWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshingForWorker) return;
      refreshingForWorker = true;
      window.location.reload();
    });

    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);
  }, { once: true });
}

const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
  <StrictMode>
    <>
      <CompanionApp />
      <SearchPage />
      <MobileSitePolish />
      <CardViewerLifecycle />
    </>
  </StrictMode>,
);
