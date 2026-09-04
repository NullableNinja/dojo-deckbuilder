from pathlib import Path

root = Path('.')
playtest_path = root / 'app/playtest.tsx'
css_path = root / 'app/playtest-board-v4.css'
playtest = playtest_path.read_text()
css = css_path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global playtest
    count = playtest.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    playtest = playtest.replace(old, new, 1)

# Teach Ascend as a procedure instead of exposing a premature End Turn button.
complete_turn_anchor = '''  const completeTurn = () => {
    setDeskView(null);
    setMatch((current) => {
      if (!current || current.phase !== "player-ascend") return current;
      const nextPlayer = playAreaCleanup(current.player);
      const hidden = write(current, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer });
      if (current.turnIndex === 0) return write(hidden, "The computer is second in this round's initiative order.", { phase: "ai-ready", turnIndex: 1 });
      return advanceRound(hidden, settings.locations, "Both fighters have completed the round.");
    });
  };

  const runAiTurn'''
complete_turn_replacement = '''  const completeTurn = () => {
    setDeskView(null);
    setMatch((current) => {
      if (!current || current.phase !== "player-ascend") return current;
      const nextPlayer = playAreaCleanup(current.player);
      const hidden = write(current, "Hide: unspent Focus clears and your next hand is drawn.", { player: nextPlayer });
      if (current.turnIndex === 0) return write(hidden, "The computer is second in this round's initiative order.", { phase: "ai-ready", turnIndex: 1 });
      return advanceRound(hidden, settings.locations, "Both fighters have completed the round.");
    });
  };

  const advanceAscendReview = () => {
    if (match?.phase !== "player-ascend") return;
    if (deskView === "market" || !deskView) setDeskView("combo");
    else if (deskView === "combo") setDeskView("belt");
    else completeTurn();
  };

  const runAiTurn'''
replace_once(complete_turn_anchor, complete_turn_replacement, 'Ascend progression helper')

coach_anchor = '''  const activePhaseIndex = match.phase === "player-initiate" ? 1 : match.phase === "player-yell" || match.phase === "defense-window" || match.phase === "reversal-window" || match.phase === "ai-ready" ? 2 : 3;
  const turnCoach = match.winner'''
coach_replacement = '''  const activePhaseIndex = match.phase === "player-initiate" ? 1 : match.phase === "player-yell" || match.phase === "defense-window" || match.phase === "reversal-window" || match.phase === "ai-ready" ? 2 : 3;
  const ascendStepIndex = deskView === "combo" ? 1 : deskView === "belt" ? 2 : 0;
  const ascendStepTitle = deskView === "combo" ? "Combo Docket" : deskView === "belt" ? "Belt Check" : "Shared Market";
  const ascendStepHelp = deskView === "combo"
    ? "Review the face-up Combo. Learn it if you can and want it, or pass it to the bottom of the docket. Then check your Belt."
    : deskView === "belt"
      ? "Check your XP and Belt Exam requirement. Promote if you qualify. This is the final review before Hide clears unspent Focus."
      : "Spend Focus on any number of Market cards you want. When shopping is finished, continue to the Combo Docket before you Hide.";
  const ascendNextLabel = deskView === "combo" ? "Continue to Belt Check →" : deskView === "belt" ? "Finish Ascend → Hide" : "Continue to Combo Docket →";
  const turnCoach = match.winner'''
replace_once(coach_anchor, coach_replacement, 'Ascend guide state')

old_ascend_coach = '''      : match.phase === "player-ascend"
        ? (canPromote ? `Your ${nextBelt?.name} Belt exam is complete. Promote before you Hide.` : player.focus > 0 ? "Spend Focus in the Market. Affordable cards are awake; the rest are judging you." : "No Focus remains. Hide to clean up, redraw, and hand the clipboard to the computer.")'''
new_ascend_coach = '''      : match.phase === "player-ascend"
        ? (deskView === "combo" ? "Ascend step 2: inspect the Combo offer. Learning is optional; reviewing it is not. Your remaining Focus can still buy it." : deskView === "belt" ? (canPromote ? `Ascend step 3: your ${nextBelt?.name} Belt certification is ready. Promote before Hide if you want the reward now.` : "Ascend step 3: review your XP and exam progress. After this check, Hide ends the turn and clears unspent Focus.") : `Ascend step 1: shop the Market with ${player.focus} Focus. When you are done buying, continue to the Combo Docket.`)'''
replace_once(old_ascend_coach, new_ascend_coach, 'Decision coach Ascend copy')

old_header = '''        <header className="ascend-desk-header">
          <div><span className="eyebrow">{match.phase === "player-ascend" ? "Ascend desk · purchasing authorized" : "Reference desk · inspection only"}</span><h2 id="ascend-desk-title">{deskView === "market" ? "Shared Market" : deskView === "combo" ? "Combo Docket" : "Certification Ledger"}</h2></div>
          <div className="ascend-desk-balance"><span>Available Focus</span><b>{player.focus}</b><small>{affordableNow} of {match.market.length} Market cards in reach</small></div>
          <button className="modal-close" onClick={() => setDeskView(null)} aria-label="Close Ascend Desk">×</button>
        </header>
        <nav className="ascend-desk-tabs" aria-label="Ascend desk sections">
          <button type="button" className={deskView === "market" ? "is-active" : ""} aria-current={deskView === "market" ? "page" : undefined} onClick={() => setDeskView("market")}><i aria-hidden="true">▤</i><span>Shared Market</span><b>{affordableNow}/{match.market.length}</b><small>affordable · open section</small></button>
          <button type="button" className={deskView === "combo" ? "is-active" : ""} aria-current={deskView === "combo" ? "page" : undefined} onClick={() => setDeskView("combo")}><i aria-hidden="true">∞</i><span>Combo Docket</span><b>{player.learnedCombos.length}/2</b><small>learned · open section</small></button>
          <button type="button" className={deskView === "belt" ? "is-active" : ""} aria-current={deskView === "belt" ? "page" : undefined} onClick={() => setDeskView("belt")}><i aria-hidden="true">★</i><span>Belt Ledger</span><b>{belts[player.belt].name}</b><small>{player.xp} XP · open section</small></button>
        </nav>
        <div className="ascend-desk-body">'''
new_header = '''        <header className="ascend-desk-header">
          <div><span className="eyebrow">{match.phase === "player-ascend" ? `Ascend review · step ${ascendStepIndex + 1} of 3` : "Reference desk · inspection only"}</span><h2 id="ascend-desk-title">{ascendStepTitle}</h2><p>{match.phase === "player-ascend" ? ascendStepHelp : "Inspect this station without advancing the turn."}</p></div>
          <div className="ascend-desk-balance"><span>Available Focus</span><b>{player.focus}</b><small>{affordableNow} of {match.market.length} Market cards in reach</small></div>
          <button className="modal-close" onClick={() => setDeskView(null)} aria-label="Close Ascend Desk">×</button>
        </header>
        {match.phase === "player-ascend" && <section className="ascend-guide" aria-label="Ascend review path">
          <div className="ascend-guide-kicker"><span>Do these in order</span><b>Shop → Combo → Belt → Hide</b></div>
          <ol>
            <li className={ascendStepIndex === 0 ? "is-current" : ascendStepIndex > 0 ? "is-complete" : ""}><b>1</b><div><span>Shared Market</span><small>Spend Focus · buy any number</small></div></li>
            <li className={ascendStepIndex === 1 ? "is-current" : ascendStepIndex > 1 ? "is-complete" : ""}><b>2</b><div><span>Combo Docket</span><small>Learn or pass once</small></div></li>
            <li className={ascendStepIndex === 2 ? "is-current" : ""}><b>3</b><div><span>Belt Check</span><small>XP + exam + reward</small></div></li>
            <li><b>4</b><div><span>Hide</span><small>Clear Focus · redraw</small></div></li>
          </ol>
        </section>}
        <div className="ascend-desk-body">
          {match.phase === "player-ascend" && <aside className={`ascend-step-coach step-${ascendStepIndex + 1}`}><b>STEP {ascendStepIndex + 1}</b><span>{ascendStepHelp}</span></aside>}'''
replace_once(old_header, new_header, 'Replace Ascend tabs with guided path')

old_footer = '''        <footer className="ascend-desk-footer"><details><summary>Recent fight filings</summary><ol>{match.log.slice(0, 6).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></details>{match.phase === "player-ascend" && <button className="button primary" onClick={completeTurn}>Hide · End turn →</button>}</footer>'''
new_footer = '''        <footer className="ascend-desk-footer"><details><summary>Recent fight filings</summary><ol>{match.log.slice(0, 6).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></details>{match.phase === "player-ascend" && <div className="ascend-guide-actions">{deskView !== "market" && <button className="button ghost" onClick={() => setDeskView(deskView === "belt" ? "combo" : "market")}>← Previous review</button>}<div><small>{deskView === "belt" ? "Last stop. Hide clears any unspent Focus." : `Next: ${deskView === "combo" ? "check Belt progress" : "review the Combo offer"}.`}</small><button className="button primary ascend-next" onClick={advanceAscendReview}>{ascendNextLabel}</button></div></div>}</footer>'''
replace_once(old_footer, new_footer, 'Guided Ascend footer')

old_dock_button = '''      {match.phase === "player-ascend" && <button onClick={completeTurn}>Hide · End turn →</button>}'''
new_dock_button = '''      {match.phase === "player-ascend" && <button onClick={() => setDeskView(deskView ?? "market")}>{deskView === "belt" ? "Resume Belt Check" : deskView === "combo" ? "Resume Combo Review" : "Resume Ascend Review"} →</button>}'''
replace_once(old_dock_button, new_dock_button, 'Remove premature Hide dock action')

old_dock_summary = '''match.phase === "player-ascend" ? `${player.focus} Focus available`'''
new_dock_summary = '''match.phase === "player-ascend" ? `${player.focus} Focus · Market → Combo → Belt`'''
replace_once(old_dock_summary, new_dock_summary, 'Ascend dock summary')

playtest_path.write_text(playtest)

marker = '/* Guided Ascend + Paper-Fu visual overhaul */'
if marker not in css:
    css += r'''

/* Guided Ascend + Paper-Fu visual overhaul */
.playtest-shell--live {
  --mat-ink: rgba(232, 244, 235, .08);
  --paper-edge: rgba(245, 220, 157, .24);
}

/* Turn the arena into one coherent paper fight surface instead of stacked dashboards. */
.playtest-arena {
  position: relative;
  padding: 8px 10px 16px;
  border: 1px solid rgba(245, 179, 34, .15);
  background:
    linear-gradient(90deg, transparent 0 49.7%, rgba(245,179,34,.055) 49.7% 50.3%, transparent 50.3%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 26px),
    rgba(6, 19, 13, .28);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.025), 0 12px 32px rgba(0,0,0,.15);
}

.battle-versus-hud {
  min-height: 58px !important;
  padding: 8px 10px !important;
  background: linear-gradient(180deg, rgba(12,29,20,.98), rgba(5,17,11,.98)) !important;
  border-bottom: 2px solid rgba(245,179,34,.38) !important;
  box-shadow: 0 8px 22px rgba(0,0,0,.28);
}
.battle-versus-hud .versus-fighter > div:first-child { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.battle-versus-hud .versus-fighter b { font-size: clamp(16px, 1.2vw, 24px) !important; text-shadow: 0 2px 0 rgba(0,0,0,.28); }
.battle-versus-hud .versus-fighter span { font-weight: 800; }
.battle-versus-hud .versus-health { height: 13px !important; margin-top: 5px; border: 2px solid rgba(255,255,255,.22); background: rgba(0,0,0,.45); box-shadow: inset 0 2px 4px rgba(0,0,0,.38); }
.battle-versus-hud .versus-health > span { box-shadow: inset 0 -3px 0 rgba(0,0,0,.18); }
.versus-center { transform: translateY(1px); filter: drop-shadow(0 3px 4px rgba(0,0,0,.28)); }

.playtest-location {
  border: 1px solid rgba(245,179,34,.28) !important;
  border-left: 5px solid var(--gold) !important;
  background: linear-gradient(90deg, rgba(245,179,34,.11), rgba(255,255,255,.025) 34%, rgba(255,255,255,.015)) !important;
  box-shadow: 4px 5px 0 rgba(0,0,0,.12);
}
.playtest-location::before {
  content: "STAGE";
  position: absolute;
  transform: translate(-7px,-20px) rotate(-2deg);
  padding: 2px 7px;
  background: var(--gold);
  color: #182019;
  font-size: 7px;
  font-weight: 1000;
  letter-spacing: .13em;
}

.fighter-dossier {
  position: relative;
  border: 1px solid rgba(255,255,255,.13) !important;
  background: linear-gradient(155deg, rgba(255,255,255,.045), transparent 38%), rgba(18,46,31,.94) !important;
  box-shadow: 5px 7px 0 rgba(0,0,0,.16) !important;
}
.fighter-dossier::before {
  content: "";
  position: absolute;
  width: 58px;
  height: 12px;
  top: -5px;
  left: 22px;
  transform: rotate(-2deg);
  background: rgba(233,214,161,.16);
  border: 1px solid rgba(255,255,255,.05);
  pointer-events: none;
}
.fighter-dossier.is-enemy::before { left: auto; right: 22px; transform: rotate(2deg); }
.fighter-dossier .fighter-panel-art { border: 1px solid rgba(255,255,255,.18) !important; box-shadow: 2px 3px 0 rgba(0,0,0,.18); }
.fighter-dossier .fighter-stats--combat > b { background: rgba(0,0,0,.16); border: 1px solid rgba(255,255,255,.09); }
.fighter-loadout-launch:hover { background: rgba(245,179,34,.14); transform: translateY(-1px); }

.playtest-combat-desk {
  border: 1px solid rgba(245,179,34,.2) !important;
  background:
    repeating-linear-gradient(90deg, transparent 0 74px, var(--mat-ink) 74px 75px),
    repeating-linear-gradient(0deg, transparent 0 74px, var(--mat-ink) 74px 75px),
    radial-gradient(circle at 50% 46%, rgba(245,179,34,.06), transparent 46%),
    rgba(16,43,29,.88) !important;
  box-shadow: inset 0 0 36px rgba(0,0,0,.18), 6px 8px 0 rgba(0,0,0,.16) !important;
}
.live-mat-heading { padding-bottom: 7px; border-bottom: 1px dashed rgba(255,255,255,.14); }
.mat-lane {
  border: 1px solid rgba(255,255,255,.11) !important;
  background: rgba(5,20,13,.34) !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.015);
}
.mat-lane > header span { letter-spacing: .1em; text-transform: uppercase; }
.mat-lane-cards > button { border: 1px solid rgba(255,255,255,.1) !important; background: rgba(255,255,255,.035) !important; box-shadow: 2px 3px 0 rgba(0,0,0,.13); }
.mat-lane-cards > button.is-active { outline: 2px solid rgba(245,179,34,.8); outline-offset: -2px; }

.combat-meters > * {
  min-height: 58px;
  border: 1px solid rgba(255,255,255,.12) !important;
  background: rgba(4,18,12,.54) !important;
  box-shadow: inset 0 3px 0 rgba(255,255,255,.025);
}
.combat-meters > * small { letter-spacing: .1em; }
.combat-desk-links button {
  min-height: 52px;
  border-width: 1px 1px 4px !important;
  box-shadow: 0 3px 0 rgba(0,0,0,.16);
}
.combat-desk-links button:hover { transform: translateY(-2px); }
.combat-zone-board { border-top: 1px dashed rgba(255,255,255,.12); padding-top: 7px !important; }

.hand-panel {
  border-top: 3px solid rgba(245,179,34,.32) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.025), transparent 88px), rgba(17,45,30,.96) !important;
  box-shadow: 5px 7px 0 rgba(0,0,0,.14) !important;
}
.play-card-row .play-card { transition: transform .16s ease, filter .16s ease; }
.play-card-row .play-card:hover { transform: translateY(-6px); filter: drop-shadow(0 10px 7px rgba(0,0,0,.2)); }

/* Ascend is a guided filing path, not three tabs and a trap-door End Turn button. */
.ascend-desk {
  width: min(1480px, 96vw) !important;
  max-height: 94vh !important;
  border: 1px solid rgba(245,179,34,.26) !important;
  background:
    linear-gradient(90deg, rgba(245,179,34,.035) 0 1px, transparent 1px) 0 0 / 26px 100%,
    rgba(14,39,26,.985) !important;
  box-shadow: 0 28px 80px rgba(0,0,0,.48), 8px 10px 0 rgba(0,0,0,.18) !important;
}
.ascend-desk-header {
  display: grid !important;
  grid-template-columns: minmax(0,1fr) auto 34px !important;
  gap: 18px !important;
  align-items: center !important;
  padding-bottom: 14px !important;
  border-bottom: 1px solid rgba(255,255,255,.12);
}
.ascend-desk-header > div:first-child p { max-width: 760px; margin: 5px 0 0; font-size: 12px; line-height: 1.45; opacity: .78; }
.ascend-desk-header h2 { margin-bottom: 0 !important; }
.ascend-desk-balance { min-width: 145px; padding: 8px 12px !important; border: 1px solid rgba(245,179,34,.28); background: rgba(245,179,34,.06); }
.ascend-desk-balance b { font-size: 30px !important; }

.ascend-desk-tabs { display: none !important; }
.ascend-guide {
  display: grid;
  grid-template-columns: 190px minmax(0,1fr);
  gap: 14px;
  align-items: stretch;
  padding: 13px 0 12px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.ascend-guide-kicker { display: flex; flex-direction: column; justify-content: center; padding: 7px 12px; border-left: 4px solid var(--gold); background: rgba(245,179,34,.055); }
.ascend-guide-kicker span { font-size: 8px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
.ascend-guide-kicker b { margin-top: 4px; font-size: 12px; }
.ascend-guide ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; counter-reset: none; }
.ascend-guide li { position: relative; display: grid; grid-template-columns: 30px minmax(0,1fr); align-items: center; gap: 8px; min-width: 0; padding: 8px; border: 1px solid rgba(255,255,255,.09); background: rgba(0,0,0,.14); opacity: .55; }
.ascend-guide li::after { content: "→"; position: absolute; right: -8px; z-index: 2; opacity: .45; }
.ascend-guide li:last-child::after { display: none; }
.ascend-guide li > b { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 50%; border: 2px solid rgba(255,255,255,.22); font-size: 12px; }
.ascend-guide li span, .ascend-guide li small { display: block; min-width: 0; }
.ascend-guide li span { font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: .04em; }
.ascend-guide li small { margin-top: 2px; font-size: 8px; opacity: .68; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ascend-guide li.is-current { opacity: 1; border-color: rgba(245,179,34,.58); background: rgba(245,179,34,.09); box-shadow: inset 0 -3px 0 rgba(245,179,34,.42); }
.ascend-guide li.is-current > b { border-color: var(--gold); color: var(--gold); }
.ascend-guide li.is-complete { opacity: .82; }
.ascend-guide li.is-complete > b { border-color: rgba(118,207,145,.58); }
.ascend-guide li.is-complete > b::after { content: "✓"; position: absolute; transform: translate(9px,-9px); display: grid; width: 13px; height: 13px; place-items: center; border-radius: 50%; background: rgba(57,120,76,.96); font-size: 7px; }

.ascend-desk-body { padding-top: 12px !important; }
.ascend-step-coach { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px 12px; border: 1px dashed rgba(245,179,34,.34); background: rgba(245,179,34,.045); }
.ascend-step-coach b { padding: 4px 7px; background: var(--gold); color: #192019; font-size: 9px; letter-spacing: .1em; }
.ascend-step-coach span { font-size: 11px; line-height: 1.45; }
.ascend-market, .ascend-combo, .ascend-belt { animation: ascend-sheet-in .16s ease-out; }
@keyframes ascend-sheet-in { from { opacity: .25; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

.ascend-market-grid { padding: 4px 2px 14px !important; gap: 12px !important; }
.ascend-market-grid .play-card { box-shadow: 3px 5px 0 rgba(0,0,0,.14); }
.ascend-combo .combo-offer { border: 1px solid rgba(245,179,34,.22); background: rgba(0,0,0,.14); padding: 12px; }
.ascend-belt .belt-panel, .ascend-belt { max-width: none !important; }
.belt-ledger-list article.is-current { outline: 2px solid rgba(245,179,34,.38); outline-offset: -2px; }

.ascend-desk-footer {
  position: sticky;
  bottom: 0;
  z-index: 4;
  margin: 14px -4px -4px !important;
  padding: 12px 4px 4px !important;
  border-top: 1px solid rgba(255,255,255,.11);
  background: linear-gradient(180deg, rgba(14,39,26,.45), rgba(14,39,26,.99) 24%);
}
.ascend-guide-actions { flex: 1; display: flex; align-items: end; justify-content: flex-end; gap: 8px; }
.ascend-guide-actions > div { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.ascend-guide-actions small { font-size: 9px; opacity: .66; }
.ascend-next { min-width: 250px; min-height: 44px; font-weight: 950 !important; letter-spacing: .02em; box-shadow: 0 4px 0 rgba(0,0,0,.22); }
.ascend-next:hover { transform: translateY(-1px); box-shadow: 0 5px 0 rgba(0,0,0,.2); }

/* While Ascend is active the dock is a reminder to resume the review, never a premature end-turn escape hatch. */
.playtest-action-dock.dock-player-ascend { border-top-color: rgba(245,179,34,.55) !important; }
.playtest-action-dock.dock-player-ascend > div b { color: var(--gold); }

:root[data-theme="light"] .playtest-arena,
:root[data-theme="light"] .playtest-combat-desk,
:root[data-theme="light"] .hand-panel,
:root[data-theme="light"] .fighter-dossier,
:root[data-theme="light"] .ascend-desk { color: var(--ink); }
:root[data-theme="light"] .playtest-combat-desk { --mat-ink: rgba(31,50,40,.065); background-color: rgba(238,236,214,.86) !important; }
:root[data-theme="light"] .mat-lane, :root[data-theme="light"] .combat-meters > * { background: rgba(255,255,255,.48) !important; }

@media (max-width: 1180px) {
  .ascend-guide { grid-template-columns: 1fr; }
  .ascend-guide ol { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .ascend-guide li:nth-child(2)::after { display: none; }
  .ascend-guide-actions { flex-wrap: wrap; }
}
'''
    css_path.write_text(css)

(root / 'tests/ascend-guidance-ui.test.mjs').write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Ascend teaches Market then Combo then Belt before Hide", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /Shop → Combo → Belt → Hide/);
  assert.match(source, /Continue to Combo Docket/);
  assert.match(source, /Continue to Belt Check/);
  assert.match(source, /Finish Ascend → Hide/);
  assert.match(source, /advanceAscendReview/);
  assert.doesNotMatch(source, /className="ascend-desk-tabs"/);
});

test("the persistent action dock cannot prematurely Hide during Ascend", async () => {
  const source = await readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8");
  assert.match(source, /Resume Ascend Review/);
  assert.doesNotMatch(source, /match\.phase === "player-ascend" && <button onClick=\{completeTurn\}>Hide/);
});

test("visual overhaul keeps every major Quick Duel surface represented", async () => {
  const css = await readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8");
  for (const selector of [".battle-versus-hud", ".playtest-location", ".fighter-dossier", ".playtest-combat-desk", ".hand-panel", ".ascend-guide", ".ascend-step-coach"]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});
''')

(root / 'scripts/deploy_patch_message.txt').write_text('Guide Ascend flow and overhaul Quick Duel visuals\n')
