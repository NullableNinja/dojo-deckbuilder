from pathlib import Path
import re

root = Path('.')
playtest_path = root / 'app/playtest.tsx'
css_path = root / 'app/playtest-board-v4.css'
spatial_test_path = root / 'tests/playtest-spatial-ownership.test.mjs'
board_test_path = root / 'tests/playtest-board-density.test.mjs'

playtest = playtest_path.read_text()
css = css_path.read_text()

# 1) MatLane must expose every filed card, not silently cap at four.
playtest = playtest.replace('  const visible = cardIds.slice(-4);', '  const visible = cardIds;')

# 2) Render the opponent dossier in true mirrored DOM order instead of asking CSS
#    to fake the entire reading direction.
new_fighter_panel = r'''function FighterPanel({ board, label, enemy, onInspect }: { board: Board; label: string; enemy?: boolean; onInspect: (card: CardEntry) => void }) {
  const fighter = cardFor(board.fighterId)!;
  const art = artistUrl(fighter);
  const combatStats: { stat: "ATK" | "DEF" | "SPD"; label: "ATK" | "DEF" | "SPD"; value: number }[] = enemy
    ? [
        { stat: "SPD", label: "SPD", value: fighterStat(board, "Speed") },
        { stat: "DEF", label: "DEF", value: fighterStat(board, "DEF") },
        { stat: "ATK", label: "ATK", value: fighterStat(board, "ATK") },
      ]
    : [
        { stat: "ATK", label: "ATK", value: fighterStat(board, "ATK") },
        { stat: "DEF", label: "DEF", value: fighterStat(board, "DEF") },
        { stat: "SPD", label: "SPD", value: fighterStat(board, "Speed") },
      ];
  const portrait = <button type="button" className="fighter-panel-art" onClick={() => onInspect(fighter)} aria-label={`Open ${fighter.name} fighter dossier`}>
    {art ? <img src={art} alt={fighter.name} /> : <img src={cardPlaceholderUrl} alt="" />}
    <span>Inspect</span>
  </button>;
  const identity = <div className="fighter-panel-copy">
    <span>{label} · {belts[board.belt].name} Belt</span>
    <button className="fighter-dossier-name" onClick={() => onInspect(fighter)}>{fighter.name}</button>
    <p>{fighter.rulesText}</p>
    <div className="fighter-resource-strip"><b>{board.xp}<small>XP</small></b><b>{board.focus}<small>FP</small></b></div>
  </div>;
  return <section className={`fighter-panel fighter-dossier paper-stack ${enemy ? "is-enemy" : ""}`}>
    {enemy ? <>{identity}{portrait}</> : <>{portrait}{identity}</>}
    <div className="fighter-stats fighter-stats--combat" aria-label={`${fighter.name} combat statistics`}>
      {combatStats.map((entry) => <b key={entry.stat}><StatGlyph stat={entry.stat} /><small>{entry.label}</small><span>{entry.value}</span></b>)}
    </div>
    <button type="button" className="fighter-loadout-launch" onClick={() => onInspect(fighter)}>{enemy ? <><small>equipped</small><b>{board.equipment.length}</b><span>Fighter & loadout</span></> : <><span>Fighter & loadout</span><b>{board.equipment.length}</b><small>equipped</small></>}</button>
  </section>;
}

function LearnedComboRack'''
playtest, count = re.subn(r'function FighterPanel\(\{ board, label, enemy, onInspect \}: \{ board: Board; label: string; enemy\?: boolean; onInspect: \(card: CardEntry\) => void \}\) \{.*?\n\}\n\nfunction LearnedComboRack', new_fighter_panel, playtest, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'Could not replace FighterPanel; count={count}')

# 3) Remove the stage banner from above the board. That vertical strip is more
#    valuable to the mat than to a one-line Location summary.
playtest, count = re.subn(
    r'\n    <section className="playtest-location paper-stack"><span>Current stage · Honor \{match\.round\}</span><div><h2>\{currentLocation\?\.name \?\? "Tournament Mat"\}</h2><p>\{currentLocation\?\.rulesText \?\? "The Department finds no reason to intervene\."\}</p></div><button onClick=\{\(\) => currentLocation && setInspectedId\(currentLocation\.id\)\}>Inspect</button></section>',
    '',
    playtest,
    count=1,
)
if count != 1:
    raise SystemExit(f'Could not remove top Location banner; count={count}')

# 4) Use the otherwise-empty opponent rail for the active Stage.
old_enemy = '      <div className="fighter-column fighter-column--enemy"><FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} /></div>'
new_enemy = r'''      <div className="fighter-column fighter-column--enemy">
        <FighterPanel board={ai} label="Computer" enemy onInspect={(card) => setInspectedId(card.id)} />
        <section className="playtest-stage-rail paper-stack" aria-label="Current stage">
          <header><span>Current stage</span><b>Honor {match.round}</b></header>
          <button type="button" onClick={() => currentLocation && setInspectedId(currentLocation.id)}><strong>{currentLocation?.name ?? "Tournament Mat"}</strong><small>Inspect stage rules →</small></button>
          <p>{currentLocation?.rulesText ?? "The Department finds no reason to intervene."}</p>
        </section>
      </div>'''
if old_enemy not in playtest:
    raise SystemExit('Could not find enemy fighter-column anchor')
playtest = playtest.replace(old_enemy, new_enemy, 1)

playtest_path.write_text(playtest)

# 5) Final layout contract. This intentionally lives at the end so legacy media
#    rules cannot silently un-mirror the opponent again.
marker = '/* Board density v5 — stage rail, full mat ledger, structural mirror, contained loadout. */'
addition = r'''

/* Board density v5 — stage rail, full mat ledger, structural mirror, contained loadout. */
.playtest-shell--live .playtest-arena {
  padding-top: 8px !important;
}
.playtest-shell--live .playtest-table {
  width: 100% !important;
  grid-template-columns: clamp(230px, 15.5vw, 300px) minmax(660px, 1fr) clamp(230px, 15.5vw, 300px) !important;
  gap: 12px !important;
}

/* True opponent mirror. The DOM is mirrored too; these areas make the contract
   explicit and protect it from narrower-screen overrides. */
.playtest-shell--live .fighter-panel.fighter-dossier:not(.is-enemy) {
  grid-template-areas:
    "art copy"
    "art copy"
    "stats stats"
    "loadout loadout" !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy {
  grid-template-columns: minmax(0, 1fr) 88px !important;
  grid-template-areas:
    "copy art"
    "copy art"
    "stats stats"
    "loadout loadout" !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier .fighter-panel-art {
  grid-area: art !important;
  grid-column: auto !important;
  grid-row: auto !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier .fighter-panel-copy {
  grid-area: copy !important;
  grid-column: auto !important;
  grid-row: auto !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier .fighter-stats--combat {
  grid-area: stats !important;
  grid-column: auto !important;
  direction: ltr !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier .fighter-loadout-launch {
  grid-area: loadout !important;
  grid-column: auto !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-panel-copy,
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-panel-copy > span,
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-panel-copy p,
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-dossier-name {
  text-align: right !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-resource-strip b {
  flex-direction: row-reverse !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-loadout-launch {
  grid-template-columns: auto auto minmax(0, 1fr) !important;
  text-align: right !important;
}
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-loadout-launch small { grid-column: 1 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-loadout-launch b { grid-column: 2 !important; }
.playtest-shell--live .fighter-panel.fighter-dossier.is-enemy .fighter-loadout-launch span { grid-column: 3 !important; }

/* Location is now a side-stage filing under the opponent. It consumes the rail
   that was visually dead instead of consuming precious vertical mat height. */
.playtest-stage-rail {
  min-width: 0;
  margin: 0 !important;
  border-top: 3px solid rgba(245,179,34,.38) !important;
  padding: 10px !important;
  background: linear-gradient(145deg, rgba(245,179,34,.075), transparent 42%), rgba(19,47,32,.94) !important;
  overflow: hidden;
}
.playtest-stage-rail > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--gold);
  font-size: 8px;
  font-weight: 950;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.playtest-stage-rail > header b { color: #e9f2ec; font-size: 8px; }
.playtest-stage-rail > button {
  width: 100%;
  display: grid;
  gap: 3px;
  border: 1px solid rgba(255,255,255,.13);
  padding: 9px;
  color: inherit;
  background: rgba(5,20,13,.36);
  text-align: right;
  cursor: pointer;
}
.playtest-stage-rail > button strong { font-family: var(--display); font-size: clamp(15px, 1vw, 19px); }
.playtest-stage-rail > button small { color: var(--gold); font-size: 8px; font-weight: 900; text-transform: uppercase; }
.playtest-stage-rail > p {
  margin: 8px 2px 0 !important;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 9px !important;
  line-height: 1.45 !important;
  opacity: .76;
}

/* Every filed card remains on the Live Mat. Lanes scroll horizontally instead
   of creating more vertical rows or silently dropping older cards. */
.playtest-shell--live .playtest-combat-desk {
  min-height: 0 !important;
  grid-template-rows: auto minmax(180px, 1fr) auto auto auto auto !important;
}
.playtest-shell--live .live-mat-play {
  min-height: 180px !important;
}
.playtest-shell--live .mat-lane {
  overflow: hidden !important;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}
.playtest-shell--live .mat-lane-cards {
  display: flex !important;
  flex-wrap: nowrap !important;
  align-items: stretch !important;
  gap: 7px !important;
  min-height: 0 !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding: 1px 2px 8px !important;
  scrollbar-gutter: stable;
  overscroll-behavior-x: contain;
}
.playtest-shell--live .mat-lane-cards > button {
  flex: 0 0 clamp(150px, 11.5vw, 205px) !important;
  width: clamp(150px, 11.5vw, 205px) !important;
  min-width: clamp(150px, 11.5vw, 205px) !important;
  min-height: 102px !important;
  grid-template-columns: 58px minmax(0, 1fr) !important;
}
.playtest-shell--live .mat-card-visual {
  width: 58px !important;
  min-width: 58px !important;
  height: 82px !important;
}
.playtest-shell--live .mat-lane > header b { white-space: nowrap; }

/* Fighter inspector has fixed outer geometry. Equipment scrolls inside the
   right pane and can never stretch the modal itself. */
.playtest-inspector.is-fighter-dossier {
  width: min(1180px, 94vw) !important;
  height: min(760px, 88dvh) !important;
  max-height: 88dvh !important;
  display: grid !important;
  grid-template-columns: minmax(260px, 330px) minmax(0, 1fr) !important;
  grid-template-rows: auto auto minmax(0, 1fr) auto !important;
  gap: 12px 22px !important;
  overflow: hidden !important;
}
.playtest-inspector.is-fighter-dossier .inspector-heading {
  grid-column: 1 !important;
  grid-row: 1 / -1 !important;
  display: flex !important;
  flex-direction: column;
  gap: 12px !important;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}
.playtest-inspector.is-fighter-dossier .inspector-card-visual {
  flex: 0 0 auto;
  width: min(290px, 100%) !important;
  max-width: 290px !important;
  max-height: 405px !important;
}
.playtest-inspector.is-fighter-dossier .inspector-copy { width: 100%; }
.playtest-inspector.is-fighter-dossier .inspector-copy h2 { font-size: clamp(24px, 2.2vw, 36px) !important; }
.playtest-inspector.is-fighter-dossier .fighter-inspector-stats {
  grid-column: 2 !important;
  grid-row: 1 !important;
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  margin: 0 !important;
}
.playtest-inspector.is-fighter-dossier .inspector-rules {
  grid-column: 2 !important;
  grid-row: 2 !important;
  margin: 0 !important;
}
.playtest-inspector.is-fighter-dossier .inspector-loadout {
  grid-column: 2 !important;
  grid-row: 3 !important;
  min-width: 0;
  min-height: 0;
  margin: 0 !important;
  padding-top: 10px !important;
  overflow: hidden;
}
.playtest-inspector.is-fighter-dossier .inspector-loadout > header { margin-bottom: 8px; }
.playtest-inspector.is-fighter-dossier .inspector-loadout-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  height: calc(100% - 42px);
  max-height: none !important;
  min-height: 0;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding-right: 5px;
  scrollbar-gutter: stable;
}
.playtest-inspector.is-fighter-dossier > footer {
  grid-column: 2 !important;
  grid-row: 4 !important;
  margin: 0 !important;
}

/* Native fallback art inside an Equipment slot must stay inside the slot. This
   is the regression that made the inspector explode after equipping a card. */
.playtest-inspector .equipment-slot-art {
  position: relative !important;
  display: block;
  overflow: hidden !important;
  contain: layout paint;
}
.playtest-inspector .equipment-slot-art > .native-card-art {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  display: grid !important;
  grid-template-rows: auto 1fr auto !important;
  overflow: hidden !important;
  transform: none !important;
}
.playtest-inspector .equipment-slot-art > .native-card-art .native-card-ribbon,
.playtest-inspector .equipment-slot-art > .native-card-art > small,
.playtest-inspector .equipment-slot-art > .native-card-art > em { display: none !important; }
.playtest-inspector .equipment-slot-art > .native-card-art > b { font-size: 18px !important; }
.playtest-inspector .equipment-slot-art > .native-card-art > strong {
  padding: 2px !important;
  font-size: 6px !important;
  line-height: 1 !important;
  overflow: hidden;
}

@media (max-width: 1260px) and (min-width: 761px) {
  .playtest-shell--live .playtest-table {
    grid-template-columns: 220px minmax(560px, 1fr) 220px !important;
  }
  .playtest-shell--live .fighter-panel.fighter-dossier.is-enemy {
    grid-template-columns: minmax(0, 1fr) 70px !important;
  }
  .playtest-inspector.is-fighter-dossier {
    grid-template-columns: 270px minmax(0, 1fr) !important;
  }
}
'''
if marker not in css:
    css += addition
css_path.write_text(css)

# Refresh spatial regression coverage to match the intended layout rather than
# obsolete CSS implementation details.
spatial_test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Quick Duel gives Live Mat and hand separate non-overlapping layout ownership", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /Live Mat \/ hand ownership fix/);
  assert.match(css, /grid-template-rows:\s*54px minmax\(0, 1fr\) auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-arena[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.playtest-shell--live \.playtest-combat-desk[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(css, /\.playtest-shell--live \.playtest-workspace--hand[\s\S]*?z-index:\s*12/);
  assert.match(css, /\.play-card-row:empty[\s\S]*?display:\s*none/);
});

test("opponent fighter dossier is a structural mirror and the stage owns the right rail", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(css, /Board density v5/);
  assert.match(css, /fighter-panel\.fighter-dossier\.is-enemy[\s\S]*?grid-template-areas:[\s\S]*?"copy art"/);
  assert.match(source, /enemy \? <>\{identity\}\{portrait\}<\/> : <>\{portrait\}\{identity\}<\/>/);
  assert.match(source, /playtest-stage-rail/);
  assert.doesNotMatch(source, /className="playtest-location paper-stack"/);
});
''')

board_test_path.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Live Mat shows the complete play area in horizontally scrollable ledgers", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(source, /const visible = cardIds;/);
  assert.doesNotMatch(source, /cardIds\.slice\(-4\)/);
  assert.match(css, /\.mat-lane-cards[\s\S]*?display:\s*flex\s*!important[\s\S]*?overflow-x:\s*auto\s*!important/);
});

test("fighter inspector contains fallback Equipment artwork and uses fixed two-pane geometry", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  assert.match(css, /playtest-inspector\.is-fighter-dossier[\s\S]*?height:\s*min\(760px, 88dvh\)/);
  assert.match(css, /equipment-slot-art[\s\S]*?contain:\s*layout paint/);
  assert.match(css, /equipment-slot-art > \.native-card-art[\s\S]*?position:\s*relative\s*!important/);
});
''')

(root / 'scripts/deploy_patch_message.txt').write_text('Reclaim stage rail and stabilize Quick Duel board\n')
