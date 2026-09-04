from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Could not find expected source while patching {label}")
    return text.replace(old, new, 1)


playtest_path = Path("app/playtest.tsx")
playtest = playtest_path.read_text()

# Coach is now a modal utility rather than a persistent side panel.
playtest = replace_once(
    playtest,
    '  const [logOpen, setLogOpen] = useState(false);\n  const [deskView, setDeskView] = useState<DeskView | null>(() => {',
    '  const [logOpen, setLogOpen] = useState(false);\n  const [coachOpen, setCoachOpen] = useState(false);\n  const [deskView, setDeskView] = useState<DeskView | null>(() => {',
    "coach state",
)
playtest = replace_once(
    playtest,
    '    if (!inspectedId && !deskView && !logOpen) return;',
    '    if (!inspectedId && !deskView && !logOpen && !coachOpen) return;',
    "modal escape guard",
)
playtest = replace_once(
    playtest,
    '      else if (deskView) setDeskView(null);\n      else setLogOpen(false);',
    '      else if (deskView) setDeskView(null);\n      else if (logOpen) setLogOpen(false);\n      else setCoachOpen(false);',
    "modal escape priority",
)
playtest = replace_once(
    playtest,
    '  }, [inspectedId, deskView, logOpen]);',
    '  }, [inspectedId, deskView, logOpen, coachOpen]);',
    "modal escape dependencies",
)

# Winner data feeds the certificate presentation.
return_anchor = '  return <main className={`playtest-shell playtest-shell--live ${settings.guided ? "playtest-shell--guided" : ""} ${match.winner ? "playtest-shell--finished" : ""} shell`}><MobilePlaytestNotice />'
playtest = replace_once(
    playtest,
    return_anchor,
    '  const winnerFighter = match.winner === "ai" ? aiFighter : playerFighter;\n  const winnerArt = artistUrl(winnerFighter);\n\n' + return_anchor,
    "winner presentation data",
)

# The fighter-name HUD owns the top bar now; utilities move to the bottom edge.
top_actions = '      <div className="playtest-actions"><span className={`rules-sync rules-sync--${rulesSync.status}`}>{rulesSync.status === "update-available" ? `Rules ${rulesSync.latestVersion} ready` : rulesSync.status === "offline" ? "Rules offline" : "Rules synced"}</span>{rulesSync.status === "update-available" && <button onClick={() => window.location.reload()}>Reload</button>}<button onClick={() => setMatch(null)}>New Duel</button><button onClick={() => goTo("rules")}>Rules</button><button onClick={() => goTo("cards")}>Cards</button></div>\n'
playtest = replace_once(playtest, top_actions, '', "top utility controls")

# Replace the flat results panel with a Paper-Fu victory certificate and fighter celebration.
victory_pattern = re.compile(r'    \{match\.winner && <section className="match-result paper-stack">.*?</section>\}', re.S)
victory_replacement = '''    {match.winner && <section className={`match-result paper-stack ${match.winner === "player" ? "is-victory" : "is-defeat"}`}>
      {match.winner === "player" && <div className="victory-confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 8) * .11}s`, animationDuration: `${2.45 + (index % 5) * .2}s` }} key={index} />)}</div>}
      <div className="victory-certificate">
        <div className="victory-stamp"><span>{match.winner === "player" ? "VICTORY" : "CLOSED"}</span><b>{match.winner === "player" ? "CERTIFIED" : "FIELD TEST"}</b></div>
        <div className="victory-fighter">
          <div className="victory-art-frame">{winnerArt ? <img src={winnerArt} alt={winnerFighter.name} /> : <NativeCardArt card={winnerFighter} />}<span>{match.winner === "player" ? "OFFICIAL WINNER" : "OFFICIAL PROBLEM"}</span></div>
          <div className="victory-copy"><span className="eyebrow">Department of Questionably Regulated Martial Arts</span><h2>{match.winner === "player" ? `${winnerFighter.name} remains standing!` : `${winnerFighter.name} wins the field test.`}</h2><p>{match.winner === "player" ? "Confetti has been authorized, the clipboard has been impressed against its will, and your victory has been filed in triplicate." : "The result has been stamped, disputed, and filed beneath a suspicious vending-machine receipt. An immediate rematch remains irresponsibly available."}</p><strong>{match.winner === "player" ? "CERTIFICATE OF EXCESSIVE COMPETENCE" : "NOTICE OF TEMPORARY MARTIAL INCONVENIENCE"}</strong></div>
        </div>
        <div className="match-report"><b>{match.round}<small>ROUNDS</small></b><b>{player.damageDealt}<small>DAMAGE DEALT</small></b><b>{player.cardsBought}<small>CARDS BOUGHT</small></b><b>{player.learnedCombos.length}<small>COMBOS LEARNED</small></b></div>
        <div className="victory-certificate-footer"><div className="victory-signature"><span>Certified by</span><b>Assistant Deputy Sensei, Filing Division</b><small>No one verified this signature.</small></div><div className="match-result-actions"><button className="button primary" onClick={() => begin(player.fighterId)}>Instant rematch →</button><button className="button ghost" onClick={() => setMatch(null)}>Choose another fighter</button></div></div>
      </div>
    </section>}'''
playtest, count = victory_pattern.subn(victory_replacement, playtest, count=1)
if count != 1:
    raise RuntimeError("Could not replace the match result screen")

# Keep only decision-specific controls by the hand. Primary actions live in one floating dock.
old_hand_actions = '''        {match.phase === "player-initiate" && <button className="button primary" onClick={beginYell}>Finish Initiate → Yell</button>}
        {match.phase === "defense-window" && <button className="button ghost" onClick={() => resolveDefense(null)}>Pass the reaction window</button>}
        {match.phase === "reversal-window" && <div className="reversal-actions"><div><span>One counterattack · no printed Focus</span>{pendingAttack?.zone?.includes("Any") && <fieldset className="zone-picker"><legend>Reversal zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset>}</div><button className="button primary" disabled={!pendingAttack} onClick={resolveReversal}>{pendingAttack ? `Reverse with ${pendingAttack.name} →` : "Choose an Attack"}</button><button className="button ghost" onClick={declineReversal}>Decline Reversal</button></div>}
        {match.phase === "player-yell" && !match.pendingDiscard && <div className="playtest-yell-actions">{pendingAttack && <><fieldset className="zone-picker"><legend>Declare zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} disabled={!pendingAttack.zone?.includes("Any") && !(playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin"))} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset><button className="button primary" onClick={declareAttack}>Declare {pendingAttack.name} →</button></>}<button className="button ghost" onClick={enterAscend}>Finish Yell → Ascend</button></div>}'''
new_hand_actions = '''        {match.phase === "reversal-window" && pendingAttack?.zone?.includes("Any") && <div className="hand-context-strip"><span>Choose reversal zone</span><fieldset className="zone-picker"><legend className="sr-only">Reversal zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}
        {match.phase === "player-yell" && !match.pendingDiscard && pendingAttack && (pendingAttack.zone?.includes("Any") || (playerFighter.name === "Whirlwind Wynn" && player.attacksThisTurn === 0 && hasTag(pendingAttack, "Spin"))) && <div className="hand-context-strip"><span>Declare zone for {pendingAttack.name}</span><fieldset className="zone-picker"><legend className="sr-only">Attack zone</legend>{["High", "Mid", "Low"].map((zone) => <button type="button" className={match.selectedZone === zone ? "is-selected" : ""} onClick={() => setMatch((current) => current ? { ...current, selectedZone: zone } : current)} key={zone}>{zone}</button>)}</fieldset></div>}'''
playtest = replace_once(playtest, old_hand_actions, new_hand_actions, "single hand action surface")

# Remove the always-present coach/log panel. Those utilities move into the bottom bar.
utility_pattern = re.compile(r'\n\s*<aside className="combat-utility-panel paper-stack">.*?</aside>', re.S)
playtest, count = utility_pattern.subn('', playtest, count=1)
if count != 1:
    raise RuntimeError("Could not remove persistent combat utility panel")

# Make the floating action dock the one primary action surface.
old_yell_dock = '      {match.phase === "player-yell" && !match.pendingDiscard && (pendingAttack ? <button onClick={declareAttack}>Declare Attack →</button> : <button onClick={enterAscend}>Proceed to Ascend →</button>)}'
new_yell_dock = '      {match.phase === "player-yell" && !match.pendingDiscard && <div className="dock-action-group">{pendingAttack && <button onClick={declareAttack}>Declare Attack →</button>}<button className={pendingAttack ? "dock-secondary" : ""} onClick={enterAscend}>{pendingAttack ? "Skip selected card · Ascend" : "Proceed to Ascend →"}</button></div>}'
playtest = replace_once(playtest, old_yell_dock, new_yell_dock, "Yell dock actions")
old_reversal_dock = '      {match.phase === "reversal-window" && (pendingAttack ? <button onClick={resolveReversal}>Launch Reversal →</button> : <button onClick={declineReversal}>Decline Reversal</button>)}'
new_reversal_dock = '      {match.phase === "reversal-window" && <div className="dock-action-group">{pendingAttack && <button onClick={resolveReversal}>Launch Reversal →</button>}<button className={pendingAttack ? "dock-secondary" : ""} onClick={declineReversal}>Decline Reversal</button></div>}'
playtest = replace_once(playtest, old_reversal_dock, new_reversal_dock, "Reversal dock actions")

# Bottom utility strip: coach/log on the left, navigation/status on the right.
footer_anchor = '''    </nav>}
    {deskView && <div className="ascend-desk-backdrop"'''
footer_replacement = '''    </nav>}
    <footer className="playtest-utility-dock" aria-label="Quick Duel utilities">
      <div className="playtest-utility-group"><button type="button" className={`utility-coach ${settings.guided ? "" : "is-off"}`} onClick={() => { if (!settings.guided) setSettings({ ...settings, guided: true }); setCoachOpen(true); }}>{settings.guided ? "Decision Coach" : "Coach Off · Re-enable"}</button><button type="button" onClick={() => setLogOpen(true)}>Fight Log <b>{match.log.length}</b></button></div>
      <div className="playtest-utility-group playtest-utility-group--nav"><span className={`rules-sync rules-sync--${rulesSync.status}`}>{rulesSync.status === "update-available" ? `Rules ${rulesSync.latestVersion} ready` : rulesSync.status === "offline" ? "Rules offline" : "Rules synced"}</span>{rulesSync.status === "update-available" && <button onClick={() => window.location.reload()}>Reload</button>}<button onClick={() => setMatch(null)}>New Duel</button><button onClick={() => goTo("rules")}>Rules</button><button onClick={() => goTo("cards")}>Cards</button></div>
    </footer>
    {deskView && <div className="ascend-desk-backdrop"'''
playtest = replace_once(playtest, footer_anchor, footer_replacement, "bottom utility bar")

# Coach becomes a focused pop-up rather than a permanent column.
log_anchor = '    {logOpen && <div className="playtest-inspector-backdrop"'
coach_modal = '''    {coachOpen && !match.winner && <div className="playtest-inspector-backdrop coach-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCoachOpen(false)}><section className="coach-dialog paper-stack" role="dialog" aria-modal="true" aria-labelledby="coach-dialog-title"><button className="modal-close" onClick={() => setCoachOpen(false)} aria-label="Close Decision Coach">×</button><span className="eyebrow">Decision coach · optional guidance</span><h2 id="coach-dialog-title">What should I do now?</h2><div className={`turn-coach turn-coach--${match.phase}`} aria-live="polite"><span>Recommended next step</span><p>{turnCoach}</p></div><div className="coach-dialog-actions"><button className="button primary" onClick={() => setCoachOpen(false)}>Back to the mat →</button><button className="button ghost" onClick={() => { setSettings({ ...settings, guided: false }); setCoachOpen(false); }}>Turn coach off</button></div><small>You can re-enable the Coach from the utility bar at any time.</small></section></div>}
'''
playtest = replace_once(playtest, log_anchor, coach_modal + log_anchor, "coach modal")

playtest_path.write_text(playtest)

# Visual polish is appended as high-specificity overrides so it safely supersedes older field-test layers.
css_path = Path("app/playtest-board-v4.css")
css = css_path.read_text()
marker = "/* Quick Duel polish pass — single action surface, stable hand, modal coach, certificate finish */"
if marker not in css:
    css += r'''

/* Quick Duel polish pass — single action surface, stable hand, modal coach, certificate finish */

/* Give fighter names the whole versus HUD. Navigation no longer lives on top of HP. */
.playtest-shell--live { padding-bottom: 108px !important; }
.playtest-shell--live .battle-versus-hud {
  grid-template-columns: minmax(0, 1fr) 84px minmax(0, 1fr) !important;
  padding-right: 10px !important;
}
.playtest-shell--live .battle-versus-hud .versus-fighter > div:first-child { min-width: 0; }
.playtest-shell--live .battle-versus-hud .versus-fighter b { font-size: clamp(16px, 1.2vw, 23px) !important; }
.playtest-shell--live .battle-versus-hud .versus-fighter span { flex: 0 0 auto; }

/* A little more room for the opponent dossier without stealing the mat. */
.playtest-shell--live .playtest-table {
  grid-template-columns: clamp(230px, 16vw, 292px) minmax(600px, 1fr) clamp(260px, 18vw, 332px) !important;
}
.playtest-shell--live .fighter-column--enemy .fighter-panel.fighter-dossier {
  grid-template-columns: 92px minmax(0, 1fr) !important;
}
.playtest-shell--live .fighter-column--enemy .fighter-panel-art { width: 92px !important; }
.playtest-shell--live .fighter-column--enemy .fighter-dossier-name { font-size: clamp(16px, 1.08vw, 21px) !important; }

/* Learned Combos stay beside the fighter, but their own rack scrolls instead of getting crushed. */
.playtest-shell--live .fighter-combo-rack { max-height: 252px; overflow: hidden !important; }
.playtest-shell--live .fighter-combo-rack .active-combo-grid {
  max-height: 194px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 5px;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
.playtest-shell--live .fighter-combo-rack .active-combo-card b { white-space: normal; line-height: 1.15; }
.playtest-shell--live .fighter-combo-rack .active-combo-card span { -webkit-line-clamp: 3; }

/* Stable hand geometry: card size is viewport-driven, never hand-count-driven. */
.playtest-shell--live .playtest-workspace--hand { padding-bottom: 2px !important; }
.playtest-shell--live .play-card-row {
  justify-content: flex-start !important;
  align-items: flex-start !important;
  min-height: 0 !important;
  padding-bottom: 8px !important;
}
.playtest-shell--live .play-card-row .play-card {
  flex: 0 0 clamp(148px, 9.5vw, 172px) !important;
  width: clamp(148px, 9.5vw, 172px) !important;
  min-width: clamp(148px, 9.5vw, 172px) !important;
  max-width: clamp(148px, 9.5vw, 172px) !important;
}
.playtest-shell--live .play-card-row .play-card-main { height: clamp(198px, 24dvh, 238px) !important; }
.hand-context-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: fit-content;
  margin: 4px auto 0;
  border: 1px dashed rgba(245,179,34,.38);
  padding: 5px 9px;
  background: rgba(245,179,34,.055);
}
.hand-context-strip > span { color: var(--gold); font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.hand-context-strip .zone-picker { margin: 0; }

/* One primary action surface. Secondary choices live inside the same floating dock. */
.playtest-shell--live .playtest-action-dock { bottom: 48px !important; }
.playtest-action-dock .dock-action-group { display: flex; align-items: stretch; gap: 7px; }
.playtest-action-dock .dock-action-group > button {
  min-height: 42px;
  border: 0;
  border-radius: 12px 4px 13px 5px;
  padding: 0 14px;
  color: #fff;
  background: var(--battle-red);
  box-shadow: 3px 4px 0 var(--battle-gold);
  font-size: 9px;
  font-weight: 900;
  cursor: pointer;
}
.playtest-action-dock .dock-action-group > button.dock-secondary {
  border: 1px solid rgba(255,255,255,.32);
  background: rgba(255,255,255,.08);
  box-shadow: none;
}

/* Utility navigation belongs at the very bottom edge, not over a fighter's name. */
.playtest-utility-dock {
  position: fixed;
  z-index: 96;
  right: 0;
  bottom: 0;
  left: 78px;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid rgba(245,179,34,.25);
  padding: 5px 12px;
  color: #dce8df;
  background: rgba(8,22,15,.96);
  box-shadow: 0 -8px 24px rgba(0,0,0,.22);
  backdrop-filter: blur(12px);
}
.playtest-utility-group { display: flex; align-items: center; gap: 6px; min-width: 0; }
.playtest-utility-group--nav { justify-content: flex-end; }
.playtest-utility-dock button {
  min-height: 27px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 999px;
  padding: 0 10px;
  color: #e7f0e9;
  background: rgba(255,255,255,.055);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .035em;
  cursor: pointer;
}
.playtest-utility-dock button:hover { border-color: var(--gold); background: rgba(245,179,34,.11); }
.playtest-utility-dock .utility-coach { border-color: rgba(245,179,34,.55); color: #ffe28b; }
.playtest-utility-dock .utility-coach.is-off { border-style: dashed; opacity: .72; }
.playtest-utility-dock .rules-sync { margin: 0 4px 0 0; white-space: nowrap; font-size: 7px; }
.playtest-utility-dock button b { margin-left: 4px; color: var(--gold); }
.playtest-shell--live .combat-utility-panel { display: none !important; }

/* Coach is now an optional pop-up: visible when wanted, gone when playing. */
.coach-backdrop { z-index: 126 !important; }
.coach-dialog {
  position: relative;
  width: min(650px, calc(100vw - 40px));
  max-height: min(78dvh, 650px);
  overflow: auto;
  border-top: 8px solid var(--gold);
  padding: 28px;
  color: var(--ink);
  background: var(--paper-light);
}
.coach-dialog h2 { margin: 4px 0 18px; font-family: var(--display); font-size: clamp(32px, 4vw, 48px); line-height: 1; }
.coach-dialog .turn-coach { border: 1px solid rgba(35,87,76,.25); border-left: 7px solid var(--green); padding: 18px; background: rgba(35,87,76,.07); }
.coach-dialog .turn-coach > span { color: var(--green); font-size: 8px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
.coach-dialog .turn-coach p { margin: 8px 0 0; font-size: 15px; line-height: 1.6; }
.coach-dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.coach-dialog > small { display: block; margin-top: 14px; opacity: .65; }
:root[data-theme="dark"] .coach-dialog { color: #edf4ef; background: #20342a; }
:root[data-theme="dark"] .coach-dialog .turn-coach { background: rgba(245,179,34,.055); }
:root[data-theme="dark"] .coach-dialog .turn-coach > span { color: #f2c95f; }

/* Inspector rebuild: card-sized visual, contained fallback artwork, and a true card-only zoom state. */
.playtest-inspector-backdrop { align-items: center !important; padding: 20px !important; overflow: hidden; }
.playtest-inspector {
  width: min(1080px, 94vw) !important;
  max-width: none !important;
  max-height: 88dvh !important;
  overflow: auto !important;
  padding: clamp(16px, 2vw, 24px) !important;
}
.playtest-inspector .inspector-heading {
  grid-template-columns: minmax(240px, 330px) minmax(0, 1fr) !important;
  align-items: start !important;
  gap: 22px !important;
}
.playtest-inspector .inspector-card-visual {
  width: min(330px, 100%) !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 330px !important;
  max-height: min(56dvh, 462px) !important;
  aspect-ratio: 63 / 88;
  justify-self: start;
  overflow: hidden !important;
}
.playtest-inspector .inspector-card-visual > img {
  width: 100% !important;
  height: 100% !important;
  max-height: none !important;
  object-fit: contain !important;
}
.playtest-inspector .inspector-card-visual > .native-card-art {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  grid-template-rows: auto 64px auto 1fr auto !important;
}
.playtest-inspector .inspector-copy { align-self: center; padding: 0 !important; }
.playtest-inspector .inspector-copy h2 { font-size: clamp(27px, 3vw, 44px) !important; line-height: 1 !important; }
.playtest-inspector.is-fighter-dossier { width: min(1180px, 94vw) !important; }
.playtest-inspector.is-fighter-dossier .inspector-heading { grid-template-columns: minmax(220px, 290px) minmax(0, 1fr) !important; }
.playtest-inspector.is-fighter-dossier .inspector-card-visual { max-width: 290px !important; max-height: 405px !important; }
.playtest-inspector.is-fighter-dossier .fighter-inspector-stats { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; margin: 12px 0 !important; }
.playtest-inspector .inspector-loadout { margin-top: 12px !important; padding-top: 12px !important; }
.playtest-inspector .inspector-loadout-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  max-height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 5px;
  scrollbar-gutter: stable;
}
.playtest-inspector .equipment-slot { min-height: 92px !important; }
.playtest-inspector.is-zoomed {
  width: min(650px, 92vw) !important;
  max-height: 94dvh !important;
  overflow: auto !important;
}
.playtest-inspector.is-zoomed .inspector-heading { grid-template-columns: 1fr !important; justify-items: center; }
.playtest-inspector.is-zoomed .inspector-copy,
.playtest-inspector.is-zoomed > dl,
.playtest-inspector.is-zoomed > .inspector-rules,
.playtest-inspector.is-zoomed > .inspector-loadout,
.playtest-inspector.is-zoomed > footer { display: none !important; }
.playtest-inspector.is-zoomed .inspector-card-visual {
  width: min(520px, 76vw) !important;
  max-width: 520px !important;
  max-height: 82dvh !important;
  aspect-ratio: 63 / 88;
  cursor: zoom-out;
}

/* Victory is now a Paper-Fu event instead of a spreadsheet with a rematch button. */
.playtest-shell--finished .playtest-arena,
.playtest-shell--finished .playtest-workspace--hand { display: none !important; }
.playtest-shell--finished .match-result {
  position: relative;
  grid-column: 2;
  grid-row: 2 / 4;
  min-width: 0;
  min-height: 0;
  height: 100%;
  margin: 0 !important;
  overflow: hidden;
  display: grid !important;
  place-items: center;
  border: 1px solid rgba(245,179,34,.2) !important;
  padding: clamp(18px, 3vw, 48px) !important;
  background: radial-gradient(circle at 50% 42%, rgba(245,179,34,.12), transparent 38%), rgba(9,28,18,.92) !important;
}
.victory-certificate {
  position: relative;
  z-index: 2;
  width: min(1120px, 96%);
  max-height: 96%;
  overflow: auto;
  border: 2px solid #2d4537;
  outline: 8px solid rgba(244,226,184,.18);
  padding: clamp(20px, 2.6vw, 38px);
  color: #20382d;
  background: repeating-linear-gradient(0deg, rgba(80,61,29,.025) 0 1px, transparent 1px 5px), #f4e2b8;
  box-shadow: 10px 13px 0 rgba(0,0,0,.2), 0 26px 70px rgba(0,0,0,.34);
  transform: rotate(-.35deg);
}
.victory-certificate::before,
.victory-certificate::after { content: ""; position: absolute; width: 86px; height: 22px; top: -9px; background: rgba(228,204,139,.7); box-shadow: 0 2px 4px rgba(70,48,20,.13); }
.victory-certificate::before { left: 12%; transform: rotate(-5deg); }
.victory-certificate::after { right: 13%; transform: rotate(4deg); }
.victory-stamp {
  position: absolute;
  z-index: 4;
  top: 18px;
  right: 20px;
  display: grid;
  place-items: center;
  width: 118px;
  height: 118px;
  border: 5px double #b8422f;
  border-radius: 50%;
  color: #b8422f;
  text-align: center;
  text-transform: uppercase;
  transform: rotate(11deg);
  opacity: .82;
}
.victory-stamp span { font-size: 10px; font-weight: 1000; letter-spacing: .18em; }
.victory-stamp b { font-family: var(--display); font-size: 18px; }
.is-defeat .victory-stamp { color: #6a4c47; border-color: #6a4c47; }
.victory-fighter { display: grid; grid-template-columns: minmax(210px, 290px) minmax(0, 1fr); gap: clamp(22px, 4vw, 58px); align-items: center; padding-right: 112px; }
.victory-art-frame {
  position: relative;
  min-height: 300px;
  display: grid;
  place-items: end center;
  overflow: hidden;
  border: 1px solid rgba(36,65,49,.32);
  background: radial-gradient(circle at 50% 65%, rgba(200,70,46,.18), transparent 42%), rgba(255,255,255,.28);
  box-shadow: 5px 7px 0 rgba(60,45,24,.13);
  transform: rotate(1.3deg);
}
.victory-art-frame img { width: 100%; height: 100%; max-height: 320px; object-fit: contain; object-position: center bottom; }
.victory-art-frame > .native-card-art { position: relative !important; inset: auto !important; width: 100%; height: 300px; }
.victory-art-frame > span:last-child:not(.native-card-art) { position: absolute; right: 8px; bottom: 8px; border: 1px solid #253e31; padding: 4px 7px; color: #f9efd5; background: #253e31; font-size: 7px; font-weight: 1000; letter-spacing: .1em; }
.victory-copy .eyebrow { color: #a53d2d !important; }
.playtest-shell--finished .victory-copy h2 { max-width: 760px; margin: 5px 0 12px !important; color: #20382d; font-family: var(--display); font-size: clamp(38px, 4.5vw, 68px) !important; line-height: .96; letter-spacing: -.035em; }
.victory-copy p { max-width: 720px; margin: 0 0 18px !important; color: #526157 !important; font-size: 14px; line-height: 1.65; }
.victory-copy > strong { display: inline-block; border-bottom: 3px solid #b8422f; padding-bottom: 4px; color: #b8422f; font-size: 10px; letter-spacing: .14em; }
.playtest-shell--finished .match-report { margin: 24px 0 20px; }
.playtest-shell--finished .match-report b { border-color: rgba(39,68,52,.35); color: #244435; background: rgba(255,255,255,.28); }
.victory-certificate-footer { display: flex; align-items: end; justify-content: space-between; gap: 20px; border-top: 1px dashed rgba(37,62,49,.35); padding-top: 16px; }
.victory-signature { display: grid; gap: 2px; transform: rotate(-1deg); }
.victory-signature span { color: #826f4e; font-size: 7px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
.victory-signature b { font-family: cursive; font-size: 20px; }
.victory-signature small { color: #7a725f; font-size: 7px; }
.match-result-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.victory-confetti { position: absolute; z-index: 3; inset: 0; overflow: hidden; pointer-events: none; }
.victory-confetti i { position: absolute; top: -34px; width: 9px; height: 19px; background: #e0573f; box-shadow: 1px 1px 0 rgba(0,0,0,.16); animation: ddb-confetti-fall 2.8s linear infinite; }
.victory-confetti i:nth-child(3n) { background: #e7bc43; }
.victory-confetti i:nth-child(3n + 1) { background: #65b28a; }
.victory-confetti i:nth-child(4n) { width: 15px; height: 8px; }
.victory-confetti i:nth-child(5n) { border-radius: 50%; }
@keyframes ddb-confetti-fall {
  0% { translate: 0 -20px; rotate: 0deg; opacity: 0; }
  10% { opacity: 1; }
  100% { translate: 24px 115vh; rotate: 680deg; opacity: .9; }
}

@media (max-width: 1260px) {
  .playtest-shell--live .playtest-table { grid-template-columns: 215px minmax(550px, 1fr) 238px !important; }
  .playtest-shell--live .fighter-column--enemy .fighter-panel.fighter-dossier { grid-template-columns: 74px minmax(0, 1fr) !important; }
  .playtest-shell--live .fighter-column--enemy .fighter-panel-art { width: 74px !important; }
  .playtest-utility-dock { left: 70px; }
}
@media (max-width: 1050px) {
  .playtest-utility-dock .rules-sync { display: none; }
  .playtest-utility-dock button { padding-inline: 7px; font-size: 7px; }
}
@media (prefers-reduced-motion: reduce) {
  .victory-confetti i { animation: none; display: none; }
}
'''
    css_path.write_text(css)

# Add regression coverage for the exact problems from this pass.
test_path = Path("tests/content-integrity.test.mjs")
tests = test_path.read_text()
test_marker = 'test("Quick Duel polish keeps the HUD clear and the primary action surface singular"'
if test_marker not in tests:
    tests += r'''

test("Quick Duel polish keeps the HUD clear and the primary action surface singular", async () => {
  const [playtest, styles] = await Promise.all([
    readFile(new URL("../app/playtest.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/playtest-board-v4.css", import.meta.url), "utf8"),
  ]);
  assert.match(playtest, /className="playtest-utility-dock"/);
  assert.match(playtest, /className="coach-dialog paper-stack"/);
  assert.match(playtest, /victory-certificate/);
  assert.match(playtest, /className="hand-context-strip"/);
  assert.doesNotMatch(playtest, /className="combat-utility-panel paper-stack"/);
  assert.doesNotMatch(playtest, /className="playtest-yell-actions"/);
  assert.match(styles, /Stable hand geometry/);
  assert.match(styles, /fighter-combo-rack \.active-combo-grid \{[\s\S]*overflow-y: auto/);
  assert.match(styles, /playtest-inspector \.inspector-card-visual > \.native-card-art \{[\s\S]*position: relative !important/);
  assert.match(styles, /victory-confetti/);
});
'''
    test_path.write_text(tests)

Path("scripts/deploy_patch_message.txt").write_text("Polish Quick Duel HUD, inspector, coach, and victory\n")
