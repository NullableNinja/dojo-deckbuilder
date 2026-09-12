export type SitePage =
  | "home"
  | "playtest"
  | "quickstart"
  | "story"
  | "rules"
  | "cards"
  | "rulings"
  | "glossary"
  | "search";

export type RulingsTab = "official" | "house";

export type SiteRoute =
  | { page: "home" }
  | { page: "playtest" }
  | { page: "quickstart" }
  | { page: "story" }
  | { page: "rules"; chapterId?: string; sectionId?: string }
  | { page: "cards"; cardId?: string }
  | { page: "rulings"; tab?: RulingsTab; query?: string }
  | { page: "glossary"; term?: string }
  | { page: "search"; query?: string };

const SITE_PAGES = new Set<SitePage>([
  "home",
  "playtest",
  "quickstart",
  "story",
  "rules",
  "cards",
  "rulings",
  "glossary",
  "search",
]);

const listeners = new Set<(route: SiteRoute) => void>();
let nativeListenersInstalled = false;

const safeDecode = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const encodePart = (value: string) => encodeURIComponent(value);
const nonEmpty = (value: string | undefined) => value?.trim() || undefined;

const fallbackRoute = (): SiteRoute => ({ page: "home" });

export function parseRoute(location: string): SiteRoute {
  const rawHash = location.includes("#") ? location.slice(location.indexOf("#") + 1) : location.replace(/^#/, "");
  const raw = rawHash.replace(/^#/, "").replace(/^\/+|\/+$/g, "");
  if (!raw) return fallbackRoute();

  const [rawPage, ...rawParts] = raw.split("/");
  const page = safeDecode(rawPage).toLocaleLowerCase();
  const parts = rawParts.map(safeDecode);

  // Legacy public Dossier links used the singular #card/... form.
  if (page === "card") {
    const cardId = nonEmpty(parts[0]);
    return cardId ? { page: "cards", cardId } : { page: "cards" };
  }

  // Legacy House Rules links pre-date the unified Rulings view.
  if (page === "house-rules") {
    return { page: "rulings", tab: "house", query: nonEmpty(parts[0]) };
  }

  if (!SITE_PAGES.has(page as SitePage)) return fallbackRoute();

  switch (page as SitePage) {
    case "rules": {
      const chapterId = nonEmpty(parts[0]);
      const sectionId = nonEmpty(parts[1]);
      return chapterId ? { page: "rules", chapterId, ...(sectionId ? { sectionId } : {}) } : { page: "rules" };
    }
    case "cards": {
      const cardId = nonEmpty(parts[0]);
      return cardId ? { page: "cards", cardId } : { page: "cards" };
    }
    case "rulings": {
      const first = nonEmpty(parts[0]);
      const second = nonEmpty(parts[1]);
      if (first === "official" || first === "house") {
        return { page: "rulings", tab: first, ...(second ? { query: second } : {}) };
      }
      // Legacy #rulings/<query> links implied the official tab.
      return first ? { page: "rulings", tab: "official", query: first } : { page: "rulings", tab: "official" };
    }
    case "glossary": {
      const term = nonEmpty(parts[0]);
      return term ? { page: "glossary", term } : { page: "glossary" };
    }
    case "search": {
      const query = nonEmpty(parts.join("/"));
      return query ? { page: "search", query } : { page: "search" };
    }
    case "home": return { page: "home" };
    case "playtest": return { page: "playtest" };
    case "quickstart": return { page: "quickstart" };
    case "story": return { page: "story" };
  }
}

export function serializeRoute(route: SiteRoute): string {
  switch (route.page) {
    case "home": return "#home";
    case "playtest": return "#playtest";
    case "quickstart": return "#quickstart";
    case "story": return "#story";
    case "rules": return `#rules${route.chapterId ? `/${encodePart(route.chapterId)}` : ""}${route.chapterId && route.sectionId ? `/${encodePart(route.sectionId)}` : ""}`;
    case "cards": return `#cards${route.cardId ? `/${encodePart(route.cardId)}` : ""}`;
    case "rulings": {
      const tab = route.tab ?? "official";
      return `#rulings/${tab}${route.query ? `/${encodePart(route.query)}` : ""}`;
    }
    case "glossary": return `#glossary${route.term ? `/${encodePart(route.term)}` : ""}`;
    case "search": return `#search${route.query ? `/${encodePart(route.query)}` : ""}`;
  }
}

export function readRoute(): SiteRoute {
  if (typeof window === "undefined") return fallbackRoute();
  return parseRoute(window.location.hash);
}

const notify = () => {
  const route = readRoute();
  listeners.forEach((listener) => listener(route));
};

const installNativeListeners = () => {
  if (nativeListenersInstalled || typeof window === "undefined") return;
  nativeListenersInstalled = true;
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
};

export function subscribeToRoute(listener: (route: SiteRoute) => void) {
  installNativeListeners();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const writeRoute = (route: SiteRoute, replace: boolean) => {
  if (typeof window === "undefined") return;
  const hash = serializeRoute(route);
  if (window.location.hash === hash) {
    notify();
    return;
  }
  const state = { ...(window.history.state ?? {}), ddbRoute: true };
  if (replace) window.history.replaceState(state, "", hash);
  else window.history.pushState(state, "", hash);
  notify();
};

export function navigate(route: SiteRoute) {
  writeRoute(route, false);
}

export function replaceRoute(route: SiteRoute) {
  writeRoute(route, true);
}

export const topLevelRoute = (page: SitePage): SiteRoute => {
  switch (page) {
    case "home": return { page: "home" };
    case "playtest": return { page: "playtest" };
    case "quickstart": return { page: "quickstart" };
    case "story": return { page: "story" };
    case "rules": return { page: "rules" };
    case "cards": return { page: "cards" };
    case "rulings": return { page: "rulings", tab: "official" };
    case "glossary": return { page: "glossary" };
    case "search": return { page: "search" };
  }
};

export const activePageForRoute = (route: SiteRoute): SitePage => route.page;
