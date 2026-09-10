import { useMemo, useState } from "react";
import cardsJson from "./data/cards.json";
import rulesJson from "./data/rules.json";
import effectsJson from "./data/effects.json";
import cardEffectsJson from "./data/card-effects.json";

type Card = { catalogId: string; name: string; cardType: string; deck: string; subtype: string; timing?: string | null; zone?: string | null; fpCost?: string | number | null; image?: string | null; tags: string[] };
type Effect = { id?: string; category?: string; name?: string; description?: string; triggers?: string[]; targets?: string[]; durations?: string[]; [key: string]: unknown };
type RuleChapter = { id: string; number: number; title: string; sections: { id: string; title: string }[] };

const cards = (cardsJson as { cards: Card[]; version: string; total: number }).cards;
const catalog = cardsJson as { version: string; total: number; counts: Record<string, number>; decks: string[] };
const rules = rulesJson as { version: string; chapters: RuleChapter[]; glossary: { term: string; meaning: string }[]; officialRulings: unknown[]; houseRules: { category?: string }[] };
const registry = cardEffectsJson as { rulesRevision?: string; cards?: Record<string, { effects?: unknown[] }> };
const vocabulary = effectsJson as unknown as { effects?: Record<string, Effect> | Effect[]; reusableEffects?: Effect[]; version?: string };

const tally = (items: string[]) => items.filter(Boolean).reduce<Record<string, number>>((result, item) => ({ ...result, [item]: (result[item] ?? 0) + 1 }), {});
const sortedTally = (items: string[]) => Object.entries(tally(items)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const asList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const effectList = Array.isArray(vocabulary.effects) ? vocabulary.effects : Object.entries(vocabulary.effects ?? {}).map(([id, effect]) => ({ id, ...effect })) ?? vocabulary.reusableEffects ?? [];

export function ReferenceDesk({ goTo }: { goTo: (view: "cards" | "rules" | "glossary" | "rulings" | "house-rules") => void }) {
  const [mechanicQuery, setMechanicQuery] = useState("");
  const [notice, setNotice] = useState("");
  const structuredCards = useMemo(() => Object.values(registry.cards ?? {}).filter((entry) => entry.effects?.length).length, []);
  const filteredEffects = useMemo(() => {
    const needle = mechanicQuery.trim().toLocaleLowerCase();
    return effectList.filter((effect) => !needle || JSON.stringify(effect).toLocaleLowerCase().includes(needle));
  }, [mechanicQuery]);
  const focusBands = sortedTally(cards.map((card) => Number.isFinite(Number(card.fpCost)) ? `${card.fpCost} Focus` : "No Focus cost"));
  const copyChecklist = async () => {
    const text = `Dojo Deckbuilder ${catalog.version} table checklist\n1. Choose a mode and fighters.\n2. Set HP, XP, Focus, and Tempo.\n3. Prepare Starter Decks, Market, Combo, and Location decks.\n4. Resolve Honor once, then I.Y.A.H. for each fighter.\n5. Use the current rules and printed card text for disputes.`;
    try { await navigator.clipboard.writeText(text); setNotice("Table checklist copied."); } catch { setNotice("Your browser blocked clipboard access. Select the checklist from the printable sheet instead."); }
  };
  return <main className="page-shell shell reference-desk-page">
    <header className="reference-hero paper-stack"><span className="eyebrow">Canonical reference desk</span><h1>One filing cabinet. Fewer arguments.</h1><p>Live catalog, rules, glossary, rulings, and executable-effect coverage are summarized here from the generated JSON runtime data—without creating a second rules database.</p><div className="reference-actions"><button className="button primary" onClick={() => window.print()}>Print table sheet</button><button className="button ghost" onClick={copyChecklist}>Copy setup checklist</button></div>{notice && <p className="reference-notice" role="status">{notice}</p>}</header>
    <section className="reference-metrics" aria-label="Canonical data status"><article><b>{catalog.total}</b><span>registered cards</span></article><article><b>{structuredCards}</b><span>cards with structured effects</span></article><article><b>{rules.chapters.length}</b><span>rules chapters</span></article><article><b>{rules.glossary.length}</b><span>defined terms</span></article></section>
    <section className="reference-grid">
      <article className="reference-panel paper-stack"><span className="eyebrow">01 · Catalog map</span><h2>Browse by card family</h2><div className="reference-bars">{Object.entries(catalog.counts).sort((a,b) => b[1] - a[1]).map(([label, count]) => <div key={label}><span>{label}</span><b>{count}</b><i style={{ width: `${Math.max(8, count / catalog.total * 100)}%` }} /></div>)}</div><button className="text-link" onClick={() => goTo("cards")}>Open Card Library →</button></article>
      <article className="reference-panel paper-stack"><span className="eyebrow">02 · Deck composition</span><h2>What is in the box?</h2><ul className="reference-list">{sortedTally(cards.map((card) => card.deck)).map(([label, count]) => <li key={label}><span>{label}</span><b>{count}</b></li>)}</ul><p className="reference-caption">Deck labels come from the canonical catalog, including content outside the 500-card main pool.</p></article>
      <article className="reference-panel paper-stack"><span className="eyebrow">03 · Cost curve</span><h2>Focus at a glance</h2><ul className="reference-list">{focusBands.map(([label, count]) => <li key={label}><span>{label}</span><b>{count}</b></li>)}</ul></article>
      <article className="reference-panel paper-stack"><span className="eyebrow">04 · Combat index</span><h2>Zones and timing</h2><div className="reference-split"><div><strong>Zones</strong>{sortedTally(cards.map((card) => card.zone ?? "Unzoned")).slice(0, 6).map(([label,count]) => <span key={label}>{label} <b>{count}</b></span>)}</div><div><strong>Timing</strong>{sortedTally(cards.map((card) => card.timing ?? "Unspecified")).slice(0, 6).map(([label,count]) => <span key={label}>{label} <b>{count}</b></span>)}</div></div></article>
      <article className="reference-panel paper-stack reference-wide"><span className="eyebrow">05 · Mechanic index</span><h2>Search the reusable effect vocabulary</h2><label className="search-box"><span>⌕</span><input value={mechanicQuery} onChange={(event) => setMechanicQuery(event.target.value)} placeholder="Search draw, heal, trigger, duration…" aria-label="Search reusable game effects" /></label><div className="effect-index">{filteredEffects.slice(0, 18).map((effect, index) => <article key={effect.id ?? `${effect.name}-${index}`}><b>{effect.name ?? effect.id ?? "Effect"}</b><p>{effect.description ?? String(effect.category ?? "Reusable effect")}</p><small>{[...asList(effect.triggers), ...asList(effect.targets), ...asList(effect.durations)].join(" · ") || "Canonical vocabulary entry"}</small></article>)}</div><p className="reference-caption">{filteredEffects.length} reusable effect{filteredEffects.length === 1 ? "" : "s"} matched. The Card Inspector exposes each card’s generated effect plan.</p></article>
      <article className="reference-panel paper-stack"><span className="eyebrow">06 · Rulebook directory</span><h2>Jump by chapter</h2><ol className="chapter-directory">{rules.chapters.filter((chapter) => chapter.number > 0).map((chapter) => <li key={chapter.id}><button onClick={() => goTo("rules")}><b>{String(chapter.number).padStart(2,"0")}</b><span>{chapter.title}<small>{chapter.sections.length} sections</small></span></button></li>)}</ol></article>
      <article className="reference-panel paper-stack"><span className="eyebrow">07 · Table authority</span><h2>Resolve, then continue</h2><p>Use a defined term before improvising one; use an official ruling before creating a house rule; and use the printed card when it directly conflicts with a general rule.</p><div className="reference-links"><button onClick={() => goTo("glossary")}>Glossary ({rules.glossary.length})</button><button onClick={() => goTo("rulings")}>Rulings ({rules.officialRulings.length})</button><button onClick={() => goTo("house-rules")}>House rules ({rules.houseRules.length})</button></div><p className="reference-caption">Rules {rules.version} · Effect registry {registry.rulesRevision ?? "current"}.</p></article>
    </section>
  </main>;
}
