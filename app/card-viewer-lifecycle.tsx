"use client";

import { useEffect } from "react";

type ViewerOrigin = "cards" | "playtest";

const VIEWER_SELECTOR = ".universal-card-inspector";
const VIEWER_BACKDROP_SELECTOR = ".universal-card-inspector-backdrop";
const VIEWER_CLOSE_SELECTOR = ".card-inspector-close";
const VIEWER_ID_SELECTOR = ".card-inspector-title-block .eyebrow";
const CANONICAL_CARD_PREFIX = "#card/";

const catalogIdFromViewer = () => {
  const eyebrow = document.querySelector<HTMLElement>(VIEWER_ID_SELECTOR)?.textContent ?? "";
  return eyebrow.split("·")[0]?.trim() || "";
};

const canonicalCardHash = (catalogId: string) => `${CANONICAL_CARD_PREFIX}${encodeURIComponent(catalogId)}`;
const libraryCardHash = (encodedCatalogId: string) => `#cards/${encodedCatalogId}`;
const originHash = (origin: ViewerOrigin) => origin === "playtest" ? "#playtest" : "#cards";

/**
 * Convert the public singular card deep-link into the Card Library's existing
 * internal route before React performs its first route sync. Once the shared
 * inspector mounts, CardViewerLifecycle restores the canonical #card/... URL.
 */
export const prepareCardRouteAlias = () => {
  if (typeof window === "undefined") return;
  const match = window.location.hash.match(/^#card\/([^/]+)$/i);
  if (!match) return;
  window.history.replaceState(window.history.state, "", libraryCardHash(match[1]));
};

/**
 * Dojo Dossier lifecycle coordinator.
 *
 * The Card Library and Quick Duel both mount the same lazy CardInspector. This
 * coordinator owns only browser history; it deliberately does not import the
 * inspector component so the production CardInspector chunk remains isolated.
 *
 * While a Dossier is visible the canonical address is #card/DDB-.... Closing it
 * restores the page that opened it. A direct #card/... load is temporarily
 * translated to #cards/... by prepareCardRouteAlias so the Library can hydrate
 * the requested card, then canonicalized back here once the Dossier appears.
 */
export default function CardViewerLifecycle() {
  useEffect(() => {
    let origin: ViewerOrigin | null = null;
    let activeCatalogId = "";

    const syncRouteFromViewer = () => {
      const viewer = document.querySelector<HTMLElement>(VIEWER_SELECTOR);

      if (!viewer) {
        if (origin && activeCatalogId) {
          const cardHash = canonicalCardHash(activeCatalogId);
          const baseHash = originHash(origin);
          // Restore only when the Dossier still owns the URL. If navigation has
          // already moved elsewhere, never pull the user back to the old page.
          if (window.location.hash === cardHash) {
            window.history.replaceState(window.history.state, "", baseHash);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        }
        origin = null;
        activeCatalogId = "";
        return;
      }

      const catalogId = catalogIdFromViewer();
      if (!catalogId) return;

      const firstOpen = !origin;
      if (!origin) {
        origin = document.querySelector(".playtest-shell") ? "playtest" : "cards";
      }

      activeCatalogId = catalogId;
      const shareHash = canonicalCardHash(catalogId);
      if (window.location.hash === shareHash) return;

      // The Card Library already creates a history entry when a card opens, so
      // only canonicalize that entry. Quick Duel does not, so give the Dossier
      // its own entry: browser Back can then dismiss it and return to #playtest.
      if (origin === "playtest" && firstOpen && window.location.hash === "#playtest") {
        window.history.pushState(null, "", shareHash);
      } else {
        window.history.replaceState(window.history.state, "", shareHash);
      }
    };

    const clearRoutedViewerState = () => {
      if (!origin) return;
      const baseHash = originHash(origin);
      if (window.location.hash !== baseHash) {
        window.history.replaceState(window.history.state, "", baseHash);
      }
      // CardsView can have both routed initial-card state and local selected-card
      // state. Syncing the host route before React handles Close prevents the
      // routed card from being revealed underneath the card that just closed.
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(`${VIEWER_SELECTOR} ${VIEWER_CLOSE_SELECTOR}`)) {
        clearRoutedViewerState();
      }
    };

    const handleMouseDownCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.matches(VIEWER_BACKDROP_SELECTOR)) {
        clearRoutedViewerState();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !document.querySelector(VIEWER_SELECTOR)) return;
      clearRoutedViewerState();
      document.querySelector<HTMLButtonElement>(`${VIEWER_SELECTOR} ${VIEWER_CLOSE_SELECTOR}`)?.click();
    };

    const handlePopState = () => {
      const viewer = document.querySelector<HTMLElement>(VIEWER_SELECTOR);
      if (!viewer || window.location.hash.startsWith(CANONICAL_CARD_PREFIX)) return;

      // Browser Back/Forward moved away from the Dossier route. Prevent the
      // route and overlay from disagreeing by closing the visible inspector.
      origin = null;
      activeCatalogId = "";
      document.querySelector<HTMLButtonElement>(`${VIEWER_SELECTOR} ${VIEWER_CLOSE_SELECTOR}`)?.click();
    };

    const observer = new MutationObserver(syncRouteFromViewer);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("mousedown", handleMouseDownCapture, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);
    syncRouteFromViewer();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClickCapture, true);
      document.removeEventListener("mousedown", handleMouseDownCapture, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}
