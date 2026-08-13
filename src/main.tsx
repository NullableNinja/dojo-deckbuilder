import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CompanionApp from "../app/companion-app";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CompanionApp />
  </StrictMode>,
);
