from pathlib import Path
import re

root = Path('.')
playtest_path = root / 'app/playtest.tsx'
playtest = playtest_path.read_text()

# Load the board redesign after the older Playtest/Combo styles so it can deliberately
# override the crowded first-generation layout without destabilizing the companion.
if 'import "./playtest-board-v4.css";' not in playtest:
    playtest = playtest.replace('import "./combo-rack.css";\n', 'import "./combo-rack.css";\nimport "./playtest-board-v4.css";\n', 1)

fighter_block = r'''const LOADOUT_SLOTS = ["Head", "Chest", "Arms", "Legs", "Feet", "Accessory", "Hands"] as const;

function equipmentSlotLabel(card: CardEntry) {
  const raw = String(card.details?.Slot ?? "").trim();
  if (/hand/i.test(raw) || isWeapon(card)) return "Hands";
  const named = LOADOUT_SLOTS.find((slot) => slot.toLocaleLowerCase() === raw.toLocaleLowerCase());
  if (named) return named;
  if (/head|helmet|hat/i.test(`${raw} ${card.name}`)) return "Head";
  if (/chest|body|torso/i.test(`${raw} ${card.name}`)) return "Chest";
  if (/arm|bracer|glove/i.test(`${raw} ${card.name}`)) return "Arms";
  if (/leg|shin|knee/i.test(`${raw} ${card.name}`)) return "Legs";
  if (/feet|foot|shoe|boot/i.test(`${raw} ${card.name}`)) return "Feet";
  return "Accessory";
}

function FighterPanel({ board, label, enemy, onInspect }: { board: Board; label: string; enemy?: boolean; onInspect: (card: CardEntry) => void }) {
  const fighter = cardFor(board.fighterId)!;
  const art = artistUrl(fighter);
  return <section className={`fighter-panel fighter-dossier paper-stack ${enemy ? "is-enemy" : ""}`}>
    <button type="button" className="fighter-panel-art" onClick={() => onInspect(fighter)} aria-label={`Open ${fighter.name} fighter dossier`}>
      {art ? <img src={art} alt={fighter.name} /> : <img src={cardPlaceholderUrl} alt="" />}
      <span>Inspect</span>
    </button>
    <div className="fighter-panel-copy">
      <span>{label} · {belts[board.belt].name} Belt</span>
      <button className="fighter-dossier-name" onClick={() => onInspect(fighter)}>{fighter.name}</button>
      <p>{fighter.rulesText}</p>
      <div className="fighter-resource-strip"><b>{board.xp}<small>XP</small></b><b>{board.focus}<small>FP</small></b></div>
    </div>
    <div className="fighter-stats fighter-stats--combat" aria-label={`${fighter.name} combat statistics`}>
      <b><StatGlyph stat="ATK" /><small>ATK</small><span>{fighterStat(board, "ATK")}</span></b>
      <b><StatGlyph stat="DEF" /><small>DEF</small><span>{fighterStat(board, "DEF")}</span></b>
      <b><StatGlyph stat="SPD" /><small>SPD</small><span>{fighterStat(board, "Speed")}</span></b>
    </div>
    <button type="button" className="fighter-loadout-launch" onClick={() => onInspect(fighter)}><span>Fighter & loadout</span><b>{board.equipment.length}</b><small>equipped</small></button>
  </section>;
}

function LearnedComboRack({ states, onInspect }: { states: { combo: CardEntry; evaluation: ReturnType<typeof evaluateCombo> | null; triggered: boolean }[]; onInspect: (card: CardEntry) => void }) {
  if (!states.length) return null;
  return <section className="active-combo-rack fighter-combo-rack" aria-label="Learned Combos">
    <header><span>∞ Learned Combos</span><small>Face up · always watching</small></header>
    <div className="active-combo-grid">{states.map(({ combo, evaluation, triggered }) => {
      const state = triggered ? "is-triggered" : evaluation?.eligible ? "is-ready" : evaluation && !evaluation.supported ? "is-manual" : "";
      const status = triggered ? "Triggered" : evaluation?.eligible ? "Will trigger" : evaluation && !evaluation.supported ? "Manual resolver" : "Watching";
      return <button type="button" className={`active-combo-card ${state}`} onClick={() => onInspect(combo)} key={combo.id}><i aria-hidden="true">∞</i><b>{combo.name}</b><span>{comboRequirementText(combo)}</span><small>{status}</small></button>;
    })}</div>
  </section>;
}

function ImpactReadout'''

playtest, replaced = re.subn(
    r'function FighterPanel\(\{ board, label, enemy, onInspect \}:.*?\n\}\n\nfunction ImpactReadout',
    fighter_block,
    playtest,
    count=1,
    flags=re.S,
)
if replaced != 1:
    raise SystemExit(f'FighterPanel replacement failed: {replaced}')

# The fighter inspector needs the live board state so it can display the real equipment loadout.
anchor = '  const defenseOptions = match.pendingStrike ? legalDefenseIds(player, match.pendingStrike.zone) : [];\n'
inspected_state = '''  const inspectedBoard = inspected
    ? inspected.id === player.fighterId ? player : inspected.id === ai.fighterId ? ai : null
    : null;\n'''
if inspected_state.strip() not in playtest:
    if anchor not in playtest:
        raise SystemExit('Inspector board-state anchor missing')
    playtest = playtest.replace(anchor, anchor + inspected_state, 1)

# Move learned Combos into the player's fighter column. They no longer consume Live Mat space.
player_panel = '      <FighterPanel board={player} label="You" onInspect={(card) => setInspectedId(card.id)} />'
player_column = '      <div className="fighter-column fighter-column--player"><FighterPanel board={player} label="You" onInspect={(card) => setInspectedId(card.id)} /><LearnedComboRack states={learnedComboStates} onInspect={(card) => setInspectedId(card.id)} /></div>'
if player_panel not in playtest:
    raise SystemExit('Player FighterPanel anchor missing')
playtest = playtest.replace(player_panel, player_column, 1)

ai_panel = '      <FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} />'
ai_column = '      <div className="fighter-column fighter-column--enemy"><FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} /></div>'
if ai_panel not in playtest:
    raise SystemExit('AI FighterPanel anchor missing')
playtest = playtest.replace(ai_panel, ai_column, 1)

# Remove the old Combo block from inside the central combat desk.
playtest, removed = re.subn(
    r'\n        \{learnedComboStates\.length > 0 && <section className="active-combo-rack".*?</section>\}\n        <div className="live-mat-heading">',
    '\n        <div className="live-mat-heading">',
    playtest,
    count=1,
    flags=re.S,
)
if removed != 1:
    raise SystemExit(f'Central Combo rack removal failed: {removed}')

# Replace the generic inspector with a true zoomable card viewer. Fighter cards additionally
# expose current stats and equipment in their actual slots.
inspector = r'''    {inspected && <div className="playtest-inspector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInspectedId(null)}>
      <article className={`playtest-inspector paper-stack ${inspectorZoomed ? "is-zoomed" : ""} ${inspectedBoard ? "is-fighter-dossier" : ""}`} role="dialog" aria-modal="true" aria-labelledby="playtest-inspector-title">
        <button className="modal-close" onClick={() => setInspectedId(null)} aria-label="Close Card Inspector">×</button>
        <div className="inspector-heading">
          <button type="button" className="inspector-card-visual" onClick={() => setInspectorZoomed((current) => !current)} aria-label={`${inspectorZoomed ? "Reduce" : "Magnify"} ${inspected.name}`}>
            {artistUrl(inspected) ? <img src={artistUrl(inspected)} alt={inspected.name} /> : <NativeCardArt card={inspected} />}
            <span>{inspectorZoomed ? "Return to dossier" : "Click card to zoom"}</span>
          </button>
          <div className="inspector-copy"><span className="eyebrow">{inspected.catalogId} · {inspected.cardType} · {inspected.subtype}</span><h2 id="playtest-inspector-title">{inspected.name}</h2><p>{inspected.flavorText}</p></div>
        </div>
        {inspectedBoard ? <dl className="fighter-inspector-stats">
          <div><dt>ATK</dt><dd>{fighterStat(inspectedBoard, "ATK")}</dd></div><div><dt>DEF</dt><dd>{fighterStat(inspectedBoard, "DEF")}</dd></div><div><dt>SPD</dt><dd>{fighterStat(inspectedBoard, "Speed")}</dd></div><div><dt>XP</dt><dd>{inspectedBoard.xp}</dd></div><div><dt>Focus</dt><dd>{inspectedBoard.focus}</dd></div><div><dt>Belt</dt><dd>{belts[inspectedBoard.belt].name}</dd></div>
        </dl> : <dl><div><dt>Focus Cost</dt><dd>{inspected.fpCost ?? "—"}</dd></div><div><dt>Focus Value</dt><dd>{inspected.focusValue ?? "—"}</dd></div><div><dt>Zone</dt><dd>{inspected.zone ?? "—"}</dd></div><div><dt>Timing</dt><dd>{inspected.timing ?? "—"}</dd></div></dl>}
        <section className="inspector-rules"><span>Printed rules text</span><p>{inspected.rulesText ?? "No printed rules text."}</p></section>
        {inspectedBoard && <section className="inspector-loadout"><header><div><span className="eyebrow">Current equipment</span><h3>Fighter loadout</h3></div><small>{inspectedBoard.equipment.length} equipped card{inspectedBoard.equipment.length === 1 ? "" : "s"}</small></header><div className="inspector-loadout-grid">{LOADOUT_SLOTS.map((slot) => { const equipped = inspectedBoard.equipment.map(cardFor).filter((card): card is CardEntry => Boolean(card && equipmentSlotLabel(card) === slot)); return <article className={`equipment-slot ${equipped.length ? "is-filled" : ""}`} key={slot}><span>{slot}</span>{equipped.length ? <div>{equipped.map((item, index) => <button type="button" onClick={() => setInspectedId(item.id)} key={`${item.id}-${index}`}><span className="equipment-slot-art">{artistUrl(item) ? <img src={artistUrl(item)} alt="" /> : <NativeCardArt card={item} />}</span><b>{item.name}</b><small>{item.details?.Slot ? String(item.details.Slot) : item.subtype}</small></button>)}</div> : <em>Empty</em>}</article>; })}</div></section>}
        <footer>{inspectedBoard ? "Click an equipped card to inspect it. " : `${cardEffectNote(inspected)} `}Click the card image to magnify it. Press Escape to close.</footer>
      </article>
    </div>}
  </main>;'''

playtest, inspector_count = re.subn(
    r'    \{inspected && <div className="playtest-inspector-backdrop".*?</article></div>\}\n  </main>;',
    inspector,
    playtest,
    count=1,
    flags=re.S,
)
if inspector_count != 1:
    raise SystemExit(f'Inspector replacement failed: {inspector_count}')

playtest_path.write_text(playtest)

css = r'''/* Quick Duel board v4 — spatial reset.
   The top versus HUD owns HP. Side dossiers own fighter identity/loadout access.
   The center is reserved for the actual mat. */

.playtest-shell--live { --fighter-column: clamp(205px, 16.5vw, 285px); }

/* Mortal-Kombat-style top bars are the single HP display. */
.battle-versus-hud .versus-health { height: 10px; border-radius: 999px; overflow: hidden; }
.battle-versus-hud .versus-fighter > div:first-child span { font-size: 10px; letter-spacing: .04em; }
.fighter-hp-track { display: none !important; }

/* Compact stage banner: readable at a glance, full text behind Inspect. */
.playtest-location {
  min-height: 0 !important;
  margin: 8px 0 10px !important;
  padding: 7px 12px !important;
  display: grid !important;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-left: 4px solid var(--gold);
}
.playtest-location > span { white-space: nowrap; margin: 0 !important; }
.playtest-location > div { min-width: 0; display: flex; align-items: baseline; gap: 12px; }
.playtest-location h2 { flex: 0 0 auto; margin: 0 !important; font-size: clamp(16px, 1.2vw, 21px) !important; }
.playtest-location p { min-width: 0; margin: 0 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .8; }
.playtest-location > button { white-space: nowrap; }

/* Three true columns: fighter / mat / fighter. */
.playtest-table {
  display: grid !important;
  grid-template-columns: var(--fighter-column) minmax(610px, 1fr) var(--fighter-column) !important;
  align-items: start !important;
  gap: 12px !important;
  overflow: visible !important;
}
.fighter-column { min-width: 0; display: grid; gap: 10px; align-content: start; }

/* Fighter dossier: no duplicate HP bar and no miniature equipment pile. */
.fighter-panel.fighter-dossier {
  min-width: 0 !important;
  display: grid !important;
  grid-template-columns: 88px minmax(0, 1fr) !important;
  grid-template-rows: auto auto auto !important;
  gap: 9px 10px !important;
  padding: 10px !important;
  overflow: hidden !important;
  align-content: start;
}
.fighter-dossier .fighter-panel-art {
  grid-row: 1 / span 2;
  width: 88px !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0;
  background: transparent;
  cursor: zoom-in;
  position: relative;
}
.fighter-dossier .fighter-panel-art img { display: block; width: 100% !important; height: auto !important; max-height: none !important; aspect-ratio: 63 / 88; object-fit: contain; }
.fighter-dossier .fighter-panel-art > span { position: absolute; inset: auto 4px 4px; padding: 3px 5px; background: rgba(6,18,13,.84); color: #fff; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.fighter-dossier .fighter-panel-copy { min-width: 0; padding: 0 !important; }
.fighter-dossier .fighter-panel-copy > span { display: block; margin-bottom: 2px; font-size: 8px; letter-spacing: .1em; text-transform: uppercase; opacity: .72; }
.fighter-dossier-name { max-width: 100%; padding: 0 !important; border: 0 !important; background: transparent !important; color: inherit !important; font: inherit; font-size: clamp(15px, 1vw, 20px) !important; font-weight: 900 !important; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.fighter-dossier .fighter-panel-copy p { margin: 5px 0 7px !important; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 10px !important; line-height: 1.35 !important; opacity: .82; }
.fighter-resource-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.fighter-resource-strip b { display: flex; align-items: baseline; justify-content: space-between; padding: 5px 6px; border: 1px solid rgba(255,255,255,.12); font-size: 14px; }
.fighter-resource-strip small { font-size: 8px; letter-spacing: .08em; opacity: .7; }
.fighter-dossier .fighter-stats--combat { grid-column: 1 / -1; display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 5px !important; margin: 0 !important; }
.fighter-dossier .fighter-stats--combat > b { min-width: 0; display: grid !important; grid-template-columns: 20px 1fr auto; align-items: center; gap: 4px; padding: 6px !important; }
.fighter-dossier .fighter-stats--combat svg { width: 18px; height: 18px; }
.fighter-dossier .fighter-stats--combat small { font-size: 8px; }
.fighter-dossier .fighter-stats--combat span { font-size: 17px; font-weight: 900; }
.fighter-loadout-launch { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 5px; width: 100%; padding: 7px 8px; border: 1px solid rgba(245,179,34,.32); background: rgba(245,179,34,.07); color: inherit; text-align: left; cursor: pointer; }
.fighter-loadout-launch span { font-size: 9px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
.fighter-loadout-launch b { color: var(--gold); font-size: 16px; }
.fighter-loadout-launch small { font-size: 8px; opacity: .68; text-transform: uppercase; }
.fighter-equipment-rack { display: none !important; }

/* Combos belong to the fighter, not on top of cards being played. */
.fighter-combo-rack { margin: 0 !important; padding: 9px !important; max-width: 100%; overflow: hidden; }
.fighter-combo-rack > header { align-items: center; margin-bottom: 7px; }
.fighter-combo-rack > header small { display: none; }
.fighter-combo-rack .active-combo-grid { grid-template-columns: 1fr !important; gap: 6px; }
.fighter-combo-rack .active-combo-card { grid-template-columns: 26px minmax(0,1fr); padding: 7px !important; gap: 3px 7px !important; }
.fighter-combo-rack .active-combo-card > i { width: 26px; height: 26px; font-size: 14px; }
.fighter-combo-rack .active-combo-card b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fighter-combo-rack .active-combo-card span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* The central desk is now a mat, not a dumping ground. */
.playtest-combat-desk { min-width: 0 !important; min-height: 500px; padding: 10px !important; overflow: hidden !important; display: grid !important; grid-template-rows: auto minmax(270px, 1fr) auto auto auto auto; align-content: stretch; gap: 8px; }
.live-mat-heading { margin: 0 !important; }
.live-mat-play { min-width: 0; min-height: 270px; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; align-items: stretch; }
.mat-lane { min-width: 0; min-height: 0; padding: 8px !important; overflow: hidden !important; }
.mat-lane > header { margin-bottom: 7px !important; }
.mat-lane-cards { min-width: 0; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 7px !important; align-content: start; position: static !important; overflow: visible !important; }
.mat-lane-cards > button { position: relative !important; inset: auto !important; transform: none !important; width: 100% !important; min-width: 0 !important; min-height: 104px !important; margin: 0 !important; padding: 6px !important; display: grid !important; grid-template-columns: 66px minmax(0, 1fr) !important; align-items: center; gap: 7px; }
.mat-lane-cards > button:hover { transform: translateY(-2px) !important; z-index: 2; }
.mat-card-visual { width: 66px !important; height: 92px !important; min-width: 66px; }
.mat-card-visual img { width: 100% !important; height: 100% !important; object-fit: contain !important; }
.mat-card-copy { min-width: 0; }
.mat-card-copy b { display: block; font-size: 10px; white-space: normal; line-height: 1.2; }
.mat-card-copy small { display: block; margin-top: 4px; font-size: 8px; line-height: 1.3; opacity: .72; }
.combat-zone-board, .combat-meters, .combat-desk-links { position: static !important; transform: none !important; margin: 0 !important; }
.combat-meters { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 5px !important; }
.combat-desk-links { display: grid !important; grid-template-columns: repeat(2, minmax(0,1fr)) !important; gap: 5px !important; }
.impact-readout { margin: 0 !important; }

/* Hand gets its own breathing room below the board. */
.playtest-workspace--hand { margin-top: 12px !important; padding-bottom: 96px !important; align-items: start !important; gap: 12px !important; }
.hand-panel { min-width: 0 !important; overflow: hidden !important; }
.play-card-row { display: flex !important; flex-wrap: nowrap !important; gap: 10px !important; overflow-x: auto !important; overflow-y: visible !important; padding: 4px 2px 14px !important; scroll-snap-type: x proximity; }
.play-card-row .play-card { flex: 0 0 clamp(150px, 10vw, 185px) !important; scroll-snap-align: start; }

/* Inspector: opening a card must make it larger. Zoom must make it larger again. */
.playtest-inspector { width: min(1120px, 94vw) !important; max-width: none !important; max-height: 92vh !important; overflow: auto !important; padding: clamp(16px, 2vw, 26px) !important; }
.playtest-inspector .inspector-heading { display: grid !important; grid-template-columns: minmax(300px, 390px) minmax(0, 1fr) !important; align-items: start; gap: 24px !important; }
.inspector-card-visual { width: 100% !important; min-width: 0 !important; max-width: none !important; padding: 8px !important; cursor: zoom-in; }
.inspector-card-visual img { display: block; width: 100% !important; height: auto !important; max-height: 70vh !important; object-fit: contain !important; }
.inspector-card-visual > span { display: block; margin-top: 6px; font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; text-align: center; }
.playtest-inspector.is-zoomed { width: min(1520px, 98vw) !important; max-height: 97vh !important; }
.playtest-inspector.is-zoomed .inspector-heading { grid-template-columns: minmax(480px, 650px) minmax(0, 1fr) !important; }
.playtest-inspector.is-zoomed .inspector-card-visual { cursor: zoom-out; }
.playtest-inspector.is-zoomed .inspector-card-visual img { max-height: 86vh !important; }
.inspector-copy { min-width: 0; padding-top: 10px; }
.inspector-copy h2 { font-size: clamp(26px, 3vw, 46px); margin: 6px 0 10px; }
.inspector-rules { margin-top: 14px; }

/* Fighter inspection becomes the loadout screen. */
.fighter-inspector-stats { display: grid !important; grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 6px !important; margin: 16px 0 !important; }
.fighter-inspector-stats > div { padding: 10px !important; text-align: center; }
.fighter-inspector-stats dt { font-size: 8px !important; letter-spacing: .1em; text-transform: uppercase; opacity: .7; }
.fighter-inspector-stats dd { margin: 3px 0 0 !important; font-size: 22px !important; font-weight: 900; }
.inspector-loadout { margin-top: 18px !important; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.13); }
.inspector-loadout > header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.inspector-loadout h3 { margin: 2px 0 0; font-size: 20px; }
.inspector-loadout-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.equipment-slot { min-width: 0; min-height: 104px; padding: 8px; border: 1px dashed rgba(255,255,255,.2); background: rgba(255,255,255,.025); }
.equipment-slot > span { display: block; margin-bottom: 6px; color: var(--gold); font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.equipment-slot > em { display: grid; min-height: 68px; place-items: center; opacity: .35; font-size: 10px; }
.equipment-slot.is-filled { border-style: solid; border-color: rgba(245,179,34,.38); background: rgba(245,179,34,.05); }
.equipment-slot > div { display: grid; gap: 5px; }
.equipment-slot button { min-width: 0; display: grid; grid-template-columns: 48px minmax(0,1fr); grid-template-rows: auto auto; gap: 2px 7px; align-items: center; padding: 5px; border: 0; background: rgba(7,20,14,.45); color: inherit; text-align: left; cursor: pointer; }
.equipment-slot-art { grid-row: 1 / span 2; width: 48px; height: 66px; overflow: hidden; }
.equipment-slot-art img { width: 100%; height: 100%; object-fit: contain; }
.equipment-slot button b { min-width: 0; font-size: 10px; white-space: normal; line-height: 1.2; }
.equipment-slot button small { font-size: 8px; opacity: .65; }

@media (max-width: 1450px) {
  .playtest-shell--live { --fighter-column: 220px; }
  .fighter-panel.fighter-dossier { grid-template-columns: 70px minmax(0,1fr) !important; }
  .fighter-dossier .fighter-panel-art { width: 70px !important; }
  .fighter-dossier .fighter-panel-copy p { -webkit-line-clamp: 2; }
  .mat-lane-cards { grid-template-columns: 1fr !important; }
  .mat-lane-cards > button { grid-template-columns: 56px minmax(0,1fr) !important; min-height: 82px !important; }
  .mat-card-visual { width: 56px !important; height: 76px !important; min-width: 56px; }
}

@media (max-width: 1120px) {
  .playtest-table { grid-template-columns: 1fr !important; }
  .fighter-column--player { grid-template-columns: minmax(0, 1fr) minmax(240px, .7fr); }
  .fighter-column--enemy { display: none; }
  .live-mat-play { grid-template-columns: 1fr !important; }
  .inspector-loadout-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}

:root[data-theme="light"] .fighter-resource-strip b,
:root[data-theme="light"] .fighter-dossier .fighter-stats--combat > b,
:root[data-theme="light"] .equipment-slot { border-color: rgba(31,50,40,.22); }
:root[data-theme="light"] .equipment-slot button { background: rgba(31,50,40,.07); }
'''
(root / 'app/playtest-board-v4.css').write_text(css)

regression = r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel board keeps HP in the versus HUD and moves secondary systems off the Live Mat", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fighter-hp-track/);
  assert.match(source, /fighter-column--player/);
  assert.match(source, /LearnedComboRack states=\{learnedComboStates\}/);
  assert.match(source, /fighter-loadout-launch/);
});

test("fighter inspection exposes slotted equipment and a true zoom state", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(source, /LOADOUT_SLOTS/);
  assert.match(source, /inspector-loadout-grid/);
  assert.match(source, /equipmentSlotLabel/);
  assert.match(css, /playtest-inspector\.is-zoomed/);
  assert.match(css, /minmax\(480px, 650px\)/);
});

test("Live Mat cards use a real non-overlapping grid", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /\.mat-lane-cards[\s\S]*display: grid !important/);
  assert.match(css, /\.mat-lane-cards > button[\s\S]*position: relative !important/);
  assert.match(css, /\.playtest-location[\s\S]*text-overflow: ellipsis/);
});
'''
(root / 'tests/playtest-board-layout.test.mjs').write_text(regression)
