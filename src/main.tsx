import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import CompanionApp from "../app/companion-app";
import "../app/playtest-production-layout.css";
import "../app/playtest-polish.css";
import "../app/playtest-readability.css";
import "../app/playtest-acquisition-desk.css";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);
