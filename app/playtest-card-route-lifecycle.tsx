"use client";

import { useEffect } from "react";
import { pushTransientRoute, replaceTransientRoute, serializeRoute } from "./routing";

const VIEWER_SELECTOR = ".universal-card-inspector";
const VIEWER_BACKDROP_SELECTOR = ".universal-card-inspector-backdrop";
const VIEWER_CLOSE_SELECTOR = ".card-inspector-close";
const VIEWER_ID_SELECTOR = ".card-inspector-title-block .eyebrow";
const PLAYTEST_HASH = serializeRoute({ page: "playtest" });

const catalogIdFromViewer = () => {
  const eyebrow = document.querySelector<HTMLElement>(VIEWER_ID_SELECTOR)?.textContent ?? "";
  return eyebrow.split("·")[0]?.trim() || "";
};

const cardHash = (catalogId: string) => serializeRoute({ page: "cards", cardId: catalogId });

/**
 * Quick Duel keeps the duel mounted while the shared card Dossier is open, but
 * the address bar must expose the same canonical #cards/DDB-... deep link as the
 * Card Library. The unified router intentionally notifies the app shell when a
 * normal route changes, so this coordinator uses its transient route helpers:
 * the URL changes, the Playtest remains mounted, and a copied/reloaded URL still
 * opens the exact card through the normal Card Library route.
 */
export default function PlaytestCardRouteLifecycle() {
  useEffect(() => {
    let activeCatalogId = "";
    let ownsTransientRoute = false;

    const restorePlaytestHash = () => {
      if (!ownsTransientRoute) return;
      const ownedHash = activeCatalogId ? cardHash(activeCatalogId) : "";
      if (!ownedHash || window.location.hash === ownedHash) {
        replaceTransientRoute({ page: "playtest" });
      }
      activeCatalogId = "";
      ownsTransientRoute = false;
    };

    const syncFromViewer = () => {
      // Card Library already owns #cards/... through the normal router. This
      // lifecycle exists only for the inspector mounted over Quick Duel.
      if (!document.querySelector(".playtest-shell")) {
        activeCatalogId = "";
        ownsTransientRoute = false;
        return;
      }

      const viewer = document.querySelector<HTMLElement>(VIEWER_SELECTOR);
      if (!viewer) {
        restorePlaytestHash();
        return;
      }

      const catalogId = catalogIdFromViewer();
      if (!catalogId) return;

      const nextHash = cardHash(catalogId);
      if (!ownsTransientRoute) {
        activeCatalogId = catalogId;
        ownsTransientRoute = true;
        if (window.location.hash === PLAYTEST_HASH) {
          pushTransientRoute({ page: "cards", cardId: catalogId });
        } else if (window.location.hash !== nextHash) {
          replaceTransientRoute({ page: "cards", cardId: catalogId });
        }
        return;
      }

      if (activeCatalogId !== catalogId || window.location.hash !== nextHash) {
        activeCatalogId = catalogId;
        replaceTransientRoute({ page: "cards", cardId: catalogId });
      }
    };

    const handleCloseCapture = (event: MouseEvent) => {
      if (!ownsTransientRoute) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(`${VIEWER_SELECTOR} ${VIEWER_CLOSE_SELECTOR}`) || target?.matches(VIEWER_BACKDROP_SELECTOR)) {
        restorePlaytestHash();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !ownsTransientRoute || !document.querySelector(VIEWER_SELECTOR)) return;
      restorePlaytestHash();
    };

    const handlePopState = () => {
      if (!ownsTransientRoute) return;
      const expectedHash = activeCatalogId ? cardHash(activeCatalogId) : "";
      if (expectedHash && window.location.hash === expectedHash) return;

      // Browser Back/Forward left the Dossier history entry. Close the overlay
      // so visible state and the URL cannot disagree.
      activeCatalogId = "";
      ownsTransientRoute = false;
      document.querySelector<HTMLButtonElement>(`${VIEWER_SELECTOR} ${VIEWER_CLOSE_SELECTOR}`)?.click();
    };

    const observer = new MutationObserver(syncFromViewer);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleCloseCapture, true);
    document.addEventListener("mousedown", handleCloseCapture, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("popstate", handlePopState);
    syncFromViewer();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleCloseCapture, true);
      document.removeEventListener("mousedown", handleCloseCapture, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}
