const COMBO_PANEL_SELECTOR = ".playtest-shell--live .ascend-featured-combo";
const DESKTOP_QUERY = "(min-width: 1200px)";

const desktopMedia = window.matchMedia(DESKTOP_QUERY);

function comboPanels(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(COMBO_PANEL_SELECTOR));
}

function comboHeader(panel: HTMLElement) {
  return panel.querySelector<HTMLElement>(":scope > header");
}

function panelName(panel: HTMLElement) {
  return panel.querySelector("h3")?.textContent?.trim() || "featured Combo";
}

function syncPanelAccessibility(panel: HTMLElement) {
  const header = comboHeader(panel);
  if (!header) return;

  if (!desktopMedia.matches) {
    panel.classList.remove("is-open");
    panel.removeAttribute("data-combo-popout");
    header.removeAttribute("role");
    header.removeAttribute("tabindex");
    header.removeAttribute("aria-expanded");
    header.removeAttribute("aria-label");
    return;
  }

  panel.dataset.comboPopout = "ready";
  const open = panel.classList.contains("is-open");
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.setAttribute("aria-expanded", String(open));
  header.setAttribute("aria-label", `${open ? "Close" : "Open"} featured Combo ${panelName(panel)}`);
}

function setPanelOpen(panel: HTMLElement, open: boolean) {
  if (!desktopMedia.matches) return;

  if (open) {
    comboPanels().forEach((other) => {
      if (other === panel) return;
      other.classList.remove("is-open");
      syncPanelAccessibility(other);
    });
  }

  panel.classList.toggle("is-open", open);
  syncPanelAccessibility(panel);
}

function syncAllPanels() {
  comboPanels().forEach(syncPanelAccessibility);
}

function elementTarget(target: EventTarget | null) {
  return target instanceof Element ? target : null;
}

document.addEventListener("click", (event) => {
  if (!desktopMedia.matches) return;
  const target = elementTarget(event.target);
  if (!target) return;

  const panel = target.closest<HTMLElement>(COMBO_PANEL_SELECTOR);
  if (!panel) {
    comboPanels().filter((candidate) => candidate.classList.contains("is-open")).forEach((candidate) => setPanelOpen(candidate, false));
    return;
  }

  const open = panel.classList.contains("is-open");
  const header = target.closest(".ascend-featured-combo > header");

  if (!open) {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(panel, true);
    return;
  }

  if (header) {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(panel, false);
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (!desktopMedia.matches) return;
  const target = elementTarget(event.target);
  if (!target) return;

  const panel = target.closest<HTMLElement>(COMBO_PANEL_SELECTOR);
  if (!panel) return;

  if (event.key === "Escape" && panel.classList.contains("is-open")) {
    event.preventDefault();
    setPanelOpen(panel, false);
    comboHeader(panel)?.focus();
    return;
  }

  const header = target.closest(".ascend-featured-combo > header");
  if (header && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    setPanelOpen(panel, !panel.classList.contains("is-open"));
  }
});

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(COMBO_PANEL_SELECTOR)) syncPanelAccessibility(node);
      comboPanels(node).forEach(syncPanelAccessibility);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
desktopMedia.addEventListener("change", syncAllPanels);
syncAllPanels();
