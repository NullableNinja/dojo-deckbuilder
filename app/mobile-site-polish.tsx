"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const currentViewFromHash = () => {
  if (typeof window === "undefined") return "home";
  const raw = window.location.hash.replace(/^#/, "").split("/")[0] || "home";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/**
 * Restores the mobile navigation slot that was left open when the playtest was
 * removed from phones. The CompanionApp already owns hash routing, so this
 * shortcut only needs to point at the existing Glossary view.
 */
export default function MobileSitePolish() {
  const [mobileNav, setMobileNav] = useState<HTMLElement | null>(null);
  const [currentView, setCurrentView] = useState(currentViewFromHash);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".mobile-nav");
    setMobileNav(nav);

    const syncView = () => setCurrentView(currentViewFromHash());
    window.addEventListener("hashchange", syncView);
    window.addEventListener("popstate", syncView);

    const observer = nav
      ? new MutationObserver(syncView)
      : null;
    observer?.observe(nav!, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-expanded"],
    });

    return () => {
      observer?.disconnect();
      window.removeEventListener("hashchange", syncView);
      window.removeEventListener("popstate", syncView);
    };
  }, []);

  if (!mobileNav) return null;

  const openGlossary = () => {
    if (currentViewFromHash() === "glossary") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.location.hash = "glossary";
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  return createPortal(
    <button
      type="button"
      className={`mobile-nav-terms${currentView === "glossary" ? " active" : ""}`}
      onClick={openGlossary}
      aria-label="Open Glossary"
      aria-current={currentView === "glossary" ? "page" : undefined}
    >
      <span aria-hidden="true">Aa</span>
      Terms
    </button>,
    mobileNav,
  );
}
