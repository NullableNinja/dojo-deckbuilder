import type { SitePage, SiteRoute } from "./routing";

export type SiteNavigationItem = {
  page: Exclude<SitePage, "search">;
  label: string;
  shortLabel: string;
  description: string;
  desktop: boolean;
  mobileMenu: boolean;
  mobileBottom: boolean;
  mobileBottomIcon?: string;
  order: number;
};

const SITE_NAVIGATION_ITEMS: SiteNavigationItem[] = [
  {
    page: "home",
    label: "Home",
    shortLabel: "Home",
    description: "Return to the Dojo Desk.",
    desktop: false,
    mobileMenu: true,
    mobileBottom: true,
    mobileBottomIcon: "⌂",
    order: 0,
  },
  {
    page: "playtest",
    label: "Play the Game",
    shortLabel: "Play",
    description: "Fight the computer using the live card catalog.",
    desktop: true,
    mobileMenu: false,
    mobileBottom: false,
    order: 10,
  },
  {
    page: "quickstart",
    label: "Quick Start",
    shortLabel: "Start",
    description: "Set up and play the first round.",
    desktop: true,
    mobileMenu: true,
    mobileBottom: true,
    mobileBottomIcon: "▶",
    order: 20,
  },
  {
    page: "story",
    label: "Backstory",
    shortLabel: "Story",
    description: "Why a filing cabinet became sacred.",
    desktop: true,
    mobileMenu: true,
    mobileBottom: false,
    order: 30,
  },
  {
    page: "rules",
    label: "Full Rules",
    shortLabel: "Rules",
    description: "Every official procedure.",
    desktop: true,
    mobileMenu: true,
    mobileBottom: true,
    mobileBottomIcon: "§",
    order: 40,
  },
  {
    page: "cards",
    label: "Card Library",
    shortLabel: "Cards",
    description: "Search the registered curriculum.",
    desktop: true,
    mobileMenu: true,
    mobileBottom: true,
    mobileBottomIcon: "▤",
    order: 50,
  },
  {
    page: "rulings",
    label: "Rulings & Variants",
    shortLabel: "Rulings",
    description: "Official clarifications and optional table variants.",
    desktop: true,
    mobileMenu: true,
    mobileBottom: false,
    order: 60,
  },
  {
    page: "glossary",
    label: "Glossary",
    shortLabel: "Terms",
    description: "Find every defined term.",
    desktop: true,
    mobileMenu: true,
    mobileBottom: true,
    mobileBottomIcon: "Aa",
    order: 70,
  },
];

export const SITE_NAVIGATION: SiteNavigationItem[] = SITE_NAVIGATION_ITEMS.sort((a, b) => a.order - b.order);

export const DESKTOP_NAVIGATION = SITE_NAVIGATION.filter((item) => item.desktop);
export const MOBILE_MENU_NAVIGATION = SITE_NAVIGATION.filter((item) => item.mobileMenu);
export const MOBILE_BOTTOM_NAVIGATION = SITE_NAVIGATION.filter((item) => item.mobileBottom);

export const navigationItemIsActive = (item: SiteNavigationItem, route: SiteRoute) => route.page === item.page;
