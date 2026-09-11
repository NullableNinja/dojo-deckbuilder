"use client";

import { useEffect } from "react";
import { CardInspector } from "./card-inspector";

type ViewerOrigin = "cards" | "playtest";

const VIEWER_SELECTOR = ".universal-card-inspector";
const VIEWER_BACKDROP_SELECTOR = ".universal-card-inspector-backdrop";
const VIEWER_CLOSE_SELECTOR = ".card-inspector-close";
const VIEWER_ID_SELECTOR = ".card-inspector-title-block .eyebrow";

const catalogIdFromViewer = () => {
  const eyebrow = document.querySelector<HTMLElement>(VIEWER_ID_SELECTOR)?.textContent ?? "";
  return eyebrow.split("·")[0]?.trim() || "";
};

const canonicalCardHash = (catalogId: string) => `#cards/${encodeURIComponent(catalogId)}`;
const originHash = (origin: ViewerOrigin) => origin === "playtest" ? "#playtest" : "#cards";

/**
 * Shared Card Viewer lifecycle coordinator.
 *
 * The Card Library and Quick Duel both mount CardInspector, but they historically
 * owned navigation separately. That allowed route state and overlay state to
 * disagree, especially when a routed Library card was followed by Next/Previous
 * or when Quick Duel opened the same inspector without a shareable URL.
 *
 * Keeping a static CardInspector import here also makes the viewer part of the
 * initial app graph instead of depending on a late lazy chunk at click time.
 */
export default function CardViewerLifecycle() {
  useEffect(() => {
    // Read the imported component so bundlers must keep the inspector in the
    // eager module graph even though its existing hosts still use React.lazy.
    if (!CardInspector.name) return;

    let origin: ViewerOrigin | null = null;
    let activeCatalogId = "";

    const syncRouteFromViewer = () => {
      const viewer = document.querySelector<HTMLElement>(VIEWER_SELECTOR);

      if (!viewer) {
        if (origin && activeCatalogId) {
          const baseHash = originHash(origin);
          if (window.location.hash !== baseHash) {
            window.history.replaceState(null, "", baseHash);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        }
        origin = null;
        activeCatalogId = "";
        return;
      }

      const catalogId = catalogIdFromViewer();
      if (!catalogId) return;

      if (!origin) {
        origin = document.querySelector(".playtest-shell") ? "playtest" : "cards";
      }

      activeCatalogId = catalogId;
      const shareHash = canonicalCardHash(catalogId);
      if (window.location.hash !== shareHash) {
        // Do not emit popstate here. In Quick Duel the visible host must remain
        // the playtest while the address bar exposes the canonical share URL.
        window.history.replaceState(null, "", shareHash);
      }
    };

    const clearRoutedViewerState = () => {
      if (!origin) return;
      const baseHash = originHash(origin);
      if (window.location.hash !== baseHash) {
        window.history.replaceState(null, "", baseHash);
      }
      // CardsView can have both routed initial-card state and local selected-card
      // state. Clearing the route before React handles the close prevents the
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

    const observer = new MutationObserver(syncRouteFromViewer);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("mousedown", handleMouseDownCapture, true);
    window.addEventListener("keydown", handleKeyDown);
    syncRouteFromViewer();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClickCapture, true);
      document.removeEventListener("mousedown", handleMouseDownCapture, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
