"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cardPlaceholderUrl from "./assets/art/card-placeholder-v2.webp";
import cardsJson from "./data/cards.json";
import cardEffectsJson from "./data/card-effects.json";

type CardEntry = {
  id: string;
  name: string;
  cardType: string;
  subtype: string;
  category?: string | null;
  catalogId: string;
  catalogOrder: number;
  deck: string;
  lineage?: string | null;
  availability?: string | null;
  fpCost?: string | number | null;
  chiCost?: string | number | null;
  focusValue?: string | number | null;
  zone?: string | null;
  timing?: string | null;
  rulesText?: string | null;
  flavorText?: string | null;
  tags: string[];
  buildPaths: string[];
  stats: Record<string, string | number>;
  image?: string | null;
  sourceSheet: string;
  sourceRulesVersion?: string | null;
  details: Record<string, string | number>;
};

type StructuredCondition = {
  kind?: string;
  operator?: string;
  value?: unknown;
  [key: string]: unknown;
};

type StructuredEffect = {
  id?: string;
  trigger?: string;
  target?: string;
  amount?: string | number;
  value?: unknown;
  duration?: string;
  action?: string;
  effect?: string;
  resolver?: string;
  conditions?: StructuredCondition[];
  [key: string]: unknown;
};

type CardEffectEntry = { name?: string; effects?: StructuredEffect[] };
type CardEffectRegistry = {
  schemaVersion?: number;
  rulesVersion?: string;
  rulesRevision?: string;
  cards?: Record<string, CardEffectEntry>;
};

type LegacyModalState = {
  catalogId: string | null;
  saved: boolean;
  positionLabel: string;
  previousName: string;
  nextName: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
};

export type CardInspectorProps = {
  card: CardEntry;
  imageUrl: string;
  effectEntry?: CardEffectEntry;
  effectRevision?: string;
  saved: boolean;
  positionLabel?: string;
  previousName?: string;
  nextName?: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  onToggleSaved: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
};

const cardData = cardsJson as unknown as { cards: CardEntry[] };
const effectRegistry = cardEffectsJson as unknown as CardEffectRegistry;
const cardsByCatalogId = new Map(cardData.cards.map((card) => [card.catalogId.toUpperCase(), card]));

const cardAssetModules = import.meta.glob<string>("./assets/cards/**/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const CARD_ASSET_URLS = Object.fromEntries(
  Object.entries(cardAssetModules).map(([path, url]) => [path.replace(/^\.\/assets/, ""), url]),
);
const COMPLETE_CARD_URLS_BY_CATALOG_ID = Object.fromEntries(
  Object.entries(CARD_ASSET_URLS).flatMap(([path, url]) => {
    const match = path.match(/\/(ddb-[a-z]+-core-\d{3})_/i);
    return match ? [[match[1].toUpperCase(), url]] : [];
  }),
);

const TRIGGER_LABELS: Record<string, string> = {
  passive: "Always active",
  onAttackDeclared: "Attack declared",
  onDefenseDeclared: "Defense declared",
  onHit: "On hit",
  onBlock: "On block",
  onPlay: "When played",
  onPurchase: "When purchased",
  onEquip: "When equipped",
  onExhaust: "When exhausted",
  onReady: "When readied",
  onTurnStart: "Start of turn",
  onTurnEnd: "End of turn",
  onRoundStart: "Start of round",
  onRoundEnd: "End of round",
  onAscend: "During Ascend",
  onHide: "During Hide",
};
const TARGET_LABELS: Record<string, string> = {
  source: "This card",
  self: "Your fighter",
  owner: "Card owner",
  opponent: "Opponent",
  target: "Chosen target",
  "chosen-equipment": "Chosen Equipment",
  "active-fighter": "Active fighter",
  "opposing-fighter": "Opposing fighter",
};
const DURATION_LABELS: Record<string, string> = {
  immediate: "Immediate",
  endOfTurn: "Until end of turn",
  endOfRound: "Until end of round",
  nextAttack: "Next Attack",
  nextDefense: "Next Defense",
  whileEquipped: "While equipped",
  permanent: "Permanent",
};
const ACTION_LABELS: Record<string, string> = {
  chooseZone: "Choose zone",
  modifyAttackPower: "Attack Power",
  modifyGuard: "Guard",
  draw: "Draw cards",
  discard: "Discard",
  gainFocus: "Gain Focus",
  gainXP: "Gain XP",
  heal: "Heal",
  damage: "Damage",
  piercing: "Piercing",
  ready: "Ready",
  exhaust: "Exhaust",
  move: "Move",
};

const splitWords = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[._/-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const sentenceCase = (value: string) => {
  const words = splitWords(value);
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
};

const displayUnknown = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayUnknown).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${sentenceCase(key)}: ${displayUnknown(entry)}`)
    .join("; ");
  return String(value);
};

const signedAmount = (amount: string | number | undefined) => {
  if (amount === undefined || amount === null || amount === "") return "";
  if (typeof amount === "number") return amount > 0 ? `+${amount}` : String(amount);
  const numeric = Number(amount);
  if (Number.isFinite(numeric)) return numeric > 0 ? `+${numeric}` : String(numeric);
  return String(amount);
};

const effectActionLabel = (effect: StructuredEffect) => {
  if (effect.action && ACTION_LABELS[effect.action]) return ACTION_LABELS[effect.action];
  if (effect.action) return sentenceCase(effect.action);
  if (effect.effect) {
    const last = effect.effect.split(".").at(-1) ?? effect.effect;
    return ACTION_LABELS[last] ?? sentenceCase(last);
  }
  return "Effect";
};

const effectSummary = (effect: StructuredEffect) => {
  const action = effectActionLabel(effect);
  const amount = signedAmount(effect.amount);
  if (amount) return `${action} ${amount}`;
  if (effect.value !== undefined) return `${action}: ${displayUnknown(effect.value)}`;
  return action;
};

const conditionLabel = (condition: StructuredCondition) => {
  const kind = condition.kind ? sentenceCase(condition.kind) : "Condition";
  const value = condition.value;
  if (value === true) return kind;
  if (value === false) return `Not ${kind.toLocaleLowerCase()}`;
  if (value !== undefined) {
    const operator = condition.operator === "gte" ? "at least" : condition.operator === "lte" ? "at most" : condition.operator === "neq" ? "not" : condition.operator === "eq" || !condition.operator ? "" : sentenceCase(condition.operator);
    return [kind, operator, displayUnknown(value)].filter(Boolean).join(" ");
  }
  const extras = Object.entries(condition).filter(([key]) => key !== "kind" && key !== "operator");
  return extras.length ? `${kind}: ${extras.map(([key, entry]) => `${sentenceCase(key)} ${displayUnknown(entry)}`).join(", ")}` : kind;
};

const triggerLabel = (trigger?: string) => trigger ? TRIGGER_LABELS[trigger] ?? sentenceCase(trigger) : "Effect";
const targetLabel = (target?: string) => target ? TARGET_LABELS[target] ?? sentenceCase(target) : "—";
const durationLabel = (duration?: string) => duration ? DURATION_LABELS[duration] ?? sentenceCase(duration) : "Immediate";

const valueLabel = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "—" : String(value);

const cardImageUrl = (card: CardEntry) => {
  const complete = COMPLETE_CARD_URLS_BY_CATALOG_ID[card.catalogId.toUpperCase()];
  if (complete) return complete;
  if (card.image) return CARD_ASSET_URLS[card.image] ?? card.image;
  return cardPlaceholderUrl;
};

const readLegacyModalState = (): LegacyModalState => {
  const legacyModal = document.querySelector<HTMLElement>(".card-modal");
  if (!legacyModal) return { catalogId: null, saved: false, positionLabel: "", previousName: "", nextName: "", previousDisabled: true, nextDisabled: true };
  const eyebrow = legacyModal.querySelector<HTMLElement>(".modal-heading .eyebrow")?.textContent ?? "";
  const catalogId = eyebrow.split("·")[0]?.trim().toUpperCase() || null;
  const binder = legacyModal.querySelector<HTMLButtonElement>(".binder-toggle--modal");
  const navButtons = legacyModal.querySelectorAll<HTMLButtonElement>(".card-modal-nav > button");
  return {
    catalogId,
    saved: binder?.getAttribute("aria-pressed") === "true",
    positionLabel: legacyModal.querySelector<HTMLElement>(".card-modal-position")?.textContent?.trim() ?? "",
    previousName: navButtons[0]?.querySelector("strong")?.textContent?.trim() ?? "",
    nextName: navButtons[1]?.querySelector("strong")?.textContent?.trim() ?? "",
    previousDisabled: navButtons[0]?.disabled ?? true,
    nextDisabled: navButtons[1]?.disabled ?? true,
  };
};

const clickLegacyModalControl = (kind: "previous" | "next" | "binder" | "close") => {
  const legacyModal = document.querySelector<HTMLElement>(".card-modal");
  if (!legacyModal) return;
  if (kind === "binder") return void legacyModal.querySelector<HTMLButtonElement>(".binder-toggle--modal")?.click();
  if (kind === "close") return void legacyModal.querySelector<HTMLButtonElement>(".modal-close")?.click();
  const buttons = legacyModal.querySelectorAll<HTMLButtonElement>(".card-modal-nav > button");
  const button = kind === "previous" ? buttons[0] : buttons[1];
  if (button && !button.disabled) button.click();
};

function StructuredEffectBreakdown({ entry, revision }: { entry?: CardEffectEntry; revision?: string }) {
  const effects = entry?.effects ?? [];
  return <section className="card-inspector-effects" aria-labelledby="card-inspector-effects-title">
    <div className="card-inspector-section-heading">
      <div><span className="eyebrow">Engine interpretation</span><h3 id="card-inspector-effects-title">Technique Breakdown</h3></div>
      <span className={`structured-status${effects.length ? " is-structured" : ""}`}>{effects.length ? `${effects.length} structured effect${effects.length === 1 ? "" : "s"}` : "No structured effect"}</span>
    </div>
    {effects.length ? <div className="structured-effect-list">{effects.map((effect, index) => <article className="structured-effect" key={effect.id ?? `${effect.trigger}-${index}`}>
      <header><span>{triggerLabel(effect.trigger)}</span><strong>{effectSummary(effect)}</strong></header>
      <dl>
        <div><dt>Target</dt><dd>{targetLabel(effect.target)}</dd></div>
        <div><dt>Duration</dt><dd>{durationLabel(effect.duration)}</dd></div>
        {effect.conditions?.length ? <div className="effect-conditions"><dt>Only if</dt><dd>{effect.conditions.map((condition, conditionIndex) => <span key={`${condition.kind}-${conditionIndex}`}>{conditionLabel(condition)}</span>)}</dd></div> : null}
      </dl>
    </article>)}</div> : <p className="structured-empty">This card has no executable effect entry in the current generated registry. Printed rules text remains authoritative.</p>}
    <p className="structured-source">Generated from <code>card-effects.json</code>{revision ? ` · ${revision}` : ""}. Printed card text remains the player-facing authority.</p>
  </section>;
}

function DesignNotes({ card, entry }: { card: CardEntry; entry?: CardEffectEntry }) {
  const designPurpose = card.details?.["Design Purpose"];
  const playtestFocus = card.details?.["Playtest Focus"];
  const effects = entry?.effects ?? [];
  return <details className="card-inspector-design-notes">
    <summary>Design &amp; registry notes <span aria-hidden="true">+</span></summary>
    <div className="design-note-grid">
      {designPurpose && <div><span>Design purpose</span><p>{String(designPurpose)}</p></div>}
      {playtestFocus && <div><span>Playtest focus</span><p>{String(playtestFocus)}</p></div>}
      <div><span>Source</span><p>{card.sourceSheet}{card.sourceRulesVersion ? ` · ${card.sourceRulesVersion}` : ""}</p></div>
      <div><span>Availability</span><p>{card.availability ?? "—"}</p></div>
    </div>
    {effects.length ? <div className="registry-note-list">{effects.map((effect, index) => <div key={effect.id ?? index}><b>{effect.id ?? `Effect ${index + 1}`}</b><code>{effect.effect ?? "No canonical effect id"}</code>{effect.resolver && <code>{effect.resolver}</code>}</div>)}</div> : null}
  </details>;
}

export function CardInspector({
  card,
  imageUrl,
  effectEntry,
  effectRevision,
  saved,
  positionLabel,
  previousName,
  nextName,
  previousDisabled = true,
  nextDisabled = true,
  onToggleSaved,
  onPrevious,
  onNext,
  onClose,
}: CardInspectorProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const statPairs = Object.entries(card.stats ?? {});
  const primaryFacts = [
    card.fpCost !== null && card.fpCost !== undefined ? ["Focus Cost", valueLabel(card.fpCost)] : null,
    card.focusValue !== null && card.focusValue !== undefined ? ["Focus", valueLabel(card.focusValue)] : null,
    card.chiCost !== null && card.chiCost !== undefined ? ["Chi", valueLabel(card.chiCost)] : null,
    card.zone ? ["Zone", card.zone] : null,
    card.timing ? ["Timing", card.timing] : null,
  ].filter((entry): entry is string[] => Boolean(entry));

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, [card.catalogId]);

  return createPortal(<div className="universal-card-inspector-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <article ref={dialogRef} className="universal-card-inspector" role="dialog" aria-modal="true" aria-labelledby="universal-card-inspector-title" tabIndex={-1}>
      <button className="card-inspector-close" type="button" onClick={onClose} aria-label="Close card inspector">×</button>
      <nav className="card-inspector-nav" aria-label="Browse cards">
        <button type="button" onClick={onPrevious} disabled={previousDisabled} aria-label={previousDisabled ? "No previous card" : `Previous card: ${previousName}`}><span aria-hidden="true">←</span><span><small>Previous</small><b>{previousDisabled ? "First card" : previousName}</b></span></button>
        <span>{positionLabel || card.catalogId}</span>
        <button type="button" onClick={onNext} disabled={nextDisabled} aria-label={nextDisabled ? "No next card" : `Next card: ${nextName}`}><span><small>Next</small><b>{nextDisabled ? "Last card" : nextName}</b></span><span aria-hidden="true">→</span></button>
      </nav>

      <div className="card-inspector-layout">
        <section className="card-inspector-card-stage" aria-label={`${card.name} card image`}>
          <div className="card-inspector-card-wrap">
            <img src={imageUrl} alt={card.name} decoding="async" />
            <button type="button" className={`card-inspector-star${saved ? " is-saved" : ""}`} aria-pressed={saved} aria-label={saved ? `Remove ${card.name} from Dojo Binder` : `Add ${card.name} to Dojo Binder`} title={saved ? "Remove from Dojo Binder" : "Add to Dojo Binder"} onClick={onToggleSaved}>{saved ? "★" : "☆"}</button>
          </div>
          <p>Click the star to {saved ? "remove this card from" : "save this card to"} your Dojo Binder.</p>
        </section>

        <section className="card-inspector-details">
          <header className="card-inspector-title-block">
            <span className="eyebrow">{card.catalogId} · {card.cardType} · {card.subtype}</span>
            <h2 id="universal-card-inspector-title">{card.name}</h2>
            {card.flavorText && <p className="card-inspector-flavor">{card.flavorText}</p>}
          </header>

          <div className="card-inspector-badges"><span>{card.deck}</span>{card.lineage && <span>{card.lineage}</span>}{card.category && <span>{card.category}</span>}</div>

          {(primaryFacts.length > 0 || statPairs.length > 0) && <section className="card-inspector-facts" aria-label="Card statistics">
            {primaryFacts.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            {statPairs.map(([label, value]) => <div key={label}><span>{sentenceCase(label)}</span><strong>{value}</strong></div>)}
          </section>}

          {card.rulesText && <aside className="card-inspector-rules"><span>Printed rules text</span><p>{card.rulesText}</p></aside>}

          <StructuredEffectBreakdown entry={effectEntry} revision={effectRevision} />

          {(card.tags.length > 0 || card.buildPaths.length > 0) && <section className="card-inspector-taxonomy">
            {card.tags.length > 0 && <div><span>Tags</span><p>{card.tags.map((tag) => <b key={tag}>{tag}</b>)}</p></div>}
            {card.buildPaths.length > 0 && <div><span>Build paths</span><p>{card.buildPaths.map((path) => <b key={path}>{path}</b>)}</p></div>}
          </section>}

          <DesignNotes card={card} entry={effectEntry} />
        </section>
      </div>
    </article>
  </div>, document.body);
}

export default function CardInspectorBridge() {
  const [legacyState, setLegacyState] = useState<LegacyModalState>(() => typeof document === "undefined" ? { catalogId: null, saved: false, positionLabel: "", previousName: "", nextName: "", previousDisabled: true, nextDisabled: true } : readLegacyModalState());

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readLegacyModalState();
        setLegacyState((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  const card = legacyState.catalogId ? cardsByCatalogId.get(legacyState.catalogId) ?? null : null;
  const effectEntry = card ? effectRegistry.cards?.[card.catalogId] : undefined;
  const imageUrl = useMemo(() => card ? cardImageUrl(card) : cardPlaceholderUrl, [card]);

  useEffect(() => {
    document.body.classList.toggle("ddb-card-inspector-active", Boolean(card));
    return () => document.body.classList.remove("ddb-card-inspector-active");
  }, [card]);

  if (!card) return null;
  return <CardInspector
    card={card}
    imageUrl={imageUrl}
    effectEntry={effectEntry}
    effectRevision={effectRegistry.rulesRevision ?? effectRegistry.rulesVersion}
    saved={legacyState.saved}
    positionLabel={legacyState.positionLabel}
    previousName={legacyState.previousName}
    nextName={legacyState.nextName}
    previousDisabled={legacyState.previousDisabled}
    nextDisabled={legacyState.nextDisabled}
    onToggleSaved={() => clickLegacyModalControl("binder")}
    onPrevious={() => clickLegacyModalControl("previous")}
    onNext={() => clickLegacyModalControl("next")}
    onClose={() => clickLegacyModalControl("close")}
  />;
}
