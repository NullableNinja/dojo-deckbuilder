import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { CompanionApp } from "../app/companion-app";
import "../app/card-inspector.css";
import "../app/mobile-site-polish.css";
import "../app/card-inspector-host-fix.css";
import "../app/rulings-variants.css";
import "../app/playtest-card-surface.css";
import "../app/playtest-market-card-polish.css";
import "../app/card-library-art-consistency.css";
import "../app/playtest-layout.css";

const companionRootElement = document.getElementById("companion-root");
if (!companionRootElement) {
  throw new Error("companion-root not found");
}

const companionRoot = createRoot(companionRootElement);

companionRoot.render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);

const mountQuickDuel = async () => {
  const playtestRootElement = document.getElementById("playtest-root");
  if (!playtestRootElement) {
    throw new Error("playtest-root not found");
  }

  const { QuickDuelApp } = await import("../app/quick-duel-app");
  const playtestRoot = createRoot(playtestRootElement);

  playtestRoot.render(
    <StrictMode>
      <QuickDuelApp />
    </StrictMode>,
  );
};

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(() => {
    void mountQuickDuel();
  });
} else {
  setTimeout(() => {
    void mountQuickDuel();
  }, 0);
}
