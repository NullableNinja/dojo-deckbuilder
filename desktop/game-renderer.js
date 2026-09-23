const $ = (id) => document.getElementById(id);
let view = null;
let actionStore = [];
let artMap = {};
const assets = "assets";

const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const slug = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const art = (card) => card?.image ? `${assets}${card.image}` : artMap[String(card?.catalogId ?? "").toUpperCase()] ?? artMap[`name:${slug(card?.name)}`] ?? `${assets}/art/card-placeholder-v2.webp`;
const cardsInView = () => [
  ...(view?.player?.hand ?? []), ...(view?.player?.equipment ?? []), ...(view?.player?.learnedCombos ?? []),
  ...(view?.market ?? []), ...(view?.opponent?.hand ?? []), ...(view?.opponent?.equipment ?? []),
];
const cardName = (id) => cardsInView().find((card) => card.id === id)?.name ?? id;

function statBox(label, value) {
  return `<div class="stat"><b>${safe(value)}</b><small>${safe(label)}</small></div>`;
}

function cardHtml(card, { actionIndex = null, legal = false } = {}) {
  const attrs = actionIndex === null ? " disabled" : ` data-action-index="${actionIndex}"`;
  return `<article class="card ${legal ? "is-legal" : ""}">
    <button type="button" class="card-main"${attrs}>
      <img src="${safe(art(card))}" alt="${safe(card.name)}">
      <b>${safe(card.name)}</b>
      <small>${safe(card.subtype || card.cardType)}${card.zone ? ` · ${safe(card.zone)}` : ""}</small>
      ${card.rulesText ? `<div class="rules">${safe(card.rulesText)}</div>` : ""}
    </button>
    <button type="button" class="card-inspect" data-inspect-id="${safe(card.id)}">Inspect</button>
  </article>`;
}

function actionLabel(action) {
  if (action.type === "pass") return view.phase === "Honor" ? "Begin round" : `Continue ${view.phase}`;
  if (action.type === "hide") return "Hide · end turn";
  if (action.type === "practice") return `Practice ${cardName(action.cardId)}`;
  if (action.type === "play-card") return `Play ${cardName(action.cardId)}`;
  if (action.type === "play-attack") return `Attack with ${cardName(action.cardId)}`;
  if (action.type === "activate-equipment") return `Exhaust ${cardName(action.cardId)}`;
  if (action.type === "purchase") return `Buy ${cardName(action.cardId)}`;
  if (action.type === "learn-combo") return `Learn ${cardName(action.cardId)}`;
  if (action.type === "decline-combo") return "Pass Combo offer";
  if (action.type === "promote") return "Promote Belt";
  if (action.type === "recover-training-stripe") return "Recover with Stripe";
  if (action.type === "tag") return `Tag to ${action.characterId}`;
  return action.type;
}

function actionIsHandCard(action, player) {
  return ["practice", "play-card", "play-attack"].includes(action.type) && player.hand.some((card) => card.id === action.cardId);
}

function actionIsMarketCard(action) {
  return action.type === "purchase" && view.market.some((card) => card.id === action.cardId);
}

function actionButton(action, index, emphasized = false) {
  return `<button type="button" class="action ${emphasized ? "primary" : ""}" data-action-index="${index}">${safe(actionLabel(action))}</button>`;
}

function renderStats(target, entity, includeResources = false) {
  const values = [statBox("ATK", entity.atk), statBox("DEF", entity.def), statBox("SPD", entity.speed)];
  if (includeResources) values.push(statBox("Focus", entity.focus));
  else values.push(statBox("Belt", entity.beltName));
  $(target).innerHTML = values.join("");
}

function healthBar(target, current, maximum) {
  $(target).style.width = `${Math.max(0, Math.min(100, Number(current) / Math.max(1, Number(maximum)) * 100))}%`;
}

function findCard(id) {
  return cardsInView().find((card) => card.id === id);
}

function openInspector(id) {
  const card = findCard(id);
  if (!card) return;
  $("inspector-art").src = art(card);
  $("inspector-art").alt = card.name;
  $("inspector-type").textContent = `${card.cardType ?? "Card"}${card.subtype ? ` · ${card.subtype}` : ""}`;
  $("inspector-name").textContent = card.name;
  $("inspector-meta").innerHTML = [
    card.zone ? `Zone ${card.zone}` : "",
    card.fpCost !== undefined && card.fpCost !== null ? `Cost ${card.fpCost}` : "",
    card.focusValue ? `Focus +${card.focusValue}` : "",
    card.stats?.Guard ? `Guard ${card.stats.Guard}` : "",
    card.stats?.Damage ? `Damage ${card.stats.Damage}` : "",
  ].filter(Boolean).map((value) => `<span>${safe(value)}</span>`).join("");
  $("inspector-rules").textContent = card.rulesText || "No additional rules text is recorded for this card.";
  $("inspector-flavor").textContent = card.flavorText || "";
  $("inspector-backdrop").classList.remove("hidden");
}

function closeInspector() {
  $("inspector-backdrop").classList.add("hidden");
}

function phaseHint() {
  if (view.winner !== null) return view.winner === 0 ? "Victory recorded. Start another game when you are ready." : "The computer won this bout. Choose Change mode for a rematch.";
  if (view.pendingChoice) return "Resolve the highlighted choice before continuing.";
  if (view.activePlayer !== 0) return "The computer is taking its turn…";
  if (view.phase === "Initiate") return "Equip first, then begin your turn.";
  if (view.phase === "Yell") return "Click a glowing card to play it, attack, or practice defense.";
  if (view.phase === "Ascend") return "Shop the Market, learn an offered Combo, or promote when eligible.";
  if (view.phase === "Hide") return "Finish the turn and draw a fresh hand.";
  if (view.phase === "Defense") return "Choose a legal Defense or let the incoming strike resolve.";
  return "Choose a legal action from the arena controls.";
}

function render() {
  if (!view || view.screen === "menu") return;
  $("menu").classList.add("hidden"); $("game").classList.remove("hidden");
  const bossMode = view.mode === "boss-blitz";
  const enemy = view.opponent;
  const player = view.player;
  const winner = view.winner !== null;
  const legal = view.legalActions ?? [];
  const legalByCard = new Map(legal.filter((action) => action.cardId).map((action, index) => [action.cardId, { action, index }]));

  $("mode-label").textContent = bossMode ? "Solo Boss Blitz" : "Quick Duel";
  $("seed-label").textContent = `Seed ${safe($("seed").value)}`;
  $("round-number").textContent = safe(view.round);
  $("game-title").textContent = winner ? (view.winner === 0 ? "Victory" : "Defeat") : bossMode ? `${view.boss.stageName} awaits` : view.activePlayer === 0 ? "Your turn" : "Computer turn";
  $("phase").textContent = winner ? `${safe(view.reason)} · game complete` : `${safe(view.phase)} phase · ${view.activePlayer === 0 ? "your action" : "computer action"} · ${view.turns} turns`;
  $("combat-status").textContent = phaseHint();
  $("combat-turn").textContent = `Round ${view.round} · Turn ${view.turns}`;
  $("combat-help").textContent = winner ? "The action history remains below for review." : view.activePlayer === 0 ? "Teal cards are legal now. The action dock shows every other legal action." : "The computer is resolving legal actions from the same engine.";

  $("opponent-eyebrow").textContent = bossMode ? `${view.boss.stageName} · ${view.boss.profile?.name ?? "Boss Profile"}` : "Computer opponent";
  $("opponent-name").textContent = enemy.character?.name ?? enemy.name;
  $("opponent-art").src = art(bossMode ? view.boss.stage : enemy.character);
  $("opponent-art").alt = enemy.character?.name ?? enemy.name;
  $("opponent-hp").textContent = `${enemy.hp}/${enemy.maxHp}`;
  healthBar("opponent-health-bar", enemy.hp, enemy.maxHp);
  renderStats("opponent-stats", enemy);
  $("opponent-rules").textContent = bossMode ? (view.boss.profile?.rulesText ?? view.boss.stage?.rulesText ?? "") : (enemy.character?.rulesText ?? "");

  $("player-name").textContent = player.character?.name ?? player.name;
  $("player-belt").textContent = `${safe(player.beltName)} BELT`;
  $("player-hp").textContent = `${player.hp}/${player.maxHp}`;
  healthBar("player-health-bar", player.hp, player.maxHp);
  $("player-art").src = art(player.character);
  $("player-art").alt = player.character?.name ?? player.name;
  renderStats("player-stats", player, true);
  $("roster").innerHTML = bossMode ? player.roster.map((fighter) => `<div class="fighter ${fighter.character.catalogId === player.character?.catalogId ? "active" : ""} ${fighter.hp <= 0 ? "ko" : ""}"><b>${safe(fighter.character.name)}</b><br>${fighter.hp}/${fighter.maxHp} HP</div>`).join("") : `<div class="fighter active"><b>${safe(player.character?.name ?? player.name)}</b><br>${safe(player.beltName)} Belt · ${player.learnedCombos.length} learned Combo${player.learnedCombos.length === 1 ? "" : "s"}</div>`;

  $("scene-name").textContent = bossMode ? `${view.boss.stageName} · Boss Blitz` : "Quick Duel · Tournament Mat";
  $("scene-rule").textContent = bossMode ? `Stage ${view.boss.stageIndex + 1}/3 · ${view.boss.profile?.rulesText ?? ""}` : "The computer uses the same legal-action engine.";
  $("guard").innerHTML = bossMode && view.boss.guard ? `<p class="rules-note"><b>Boss Guard:</b> ${safe(view.boss.guard.card.name)} · ${safe(view.boss.guard.zone)} · ${safe(view.boss.guard.guard)} Guard</p>` : "";

  const handCards = player.hand.map((card) => {
    const match = legalByCard.get(card.id);
    return cardHtml(card, match && actionIsHandCard(match.action, player) ? { actionIndex: match.index, legal: true } : {});
  }).join("");
  $("hand").innerHTML = handCards || `<p class="muted">No cards in hand.</p>`;
  $("hand-title").textContent = view.pendingChoice ? "Resolve the choice in the arena" : view.phase === "Defense" ? "Defend the incoming strike" : view.phase === "Ascend" ? "Your hand · play is paused while you Ascend" : "Choose your next card";
  $("hand-help").textContent = phaseHint();
  $("hand-counters").innerHTML = [`Deck ${player.deckCount}`, `Discard ${player.discardCount}`, `Focus ${player.focus}`, `XP ${player.xp}`, `Combos ${player.learnedCombos.length}`].map((label) => `<span>${safe(label)}</span>`).join("");

  actionStore = legal;
  $("actions").innerHTML = winner ? `<strong>${safe(view.winner === 0 ? "You won the game." : "The computer won this game.")}</strong>` : legal.map((action, index) => actionButton(action, index, ["pass", "hide", "promote", "learn-combo"].includes(action.type))).join("");
  const pending = view.pendingChoice;
  $("choice").classList.toggle("hidden", !pending);
  $("choice").innerHTML = pending ? `<h3>${safe(pending.kind)}</h3><p>Choose an option to continue.</p><div class="actions">${pending.options.map((option) => `<button type="button" class="action" data-choice="${safe(option.id)}">${safe(option.label || option.id)}</button>`).join("")}</div>` : "";

  const market = view.market.map((card) => {
    const match = legalByCard.get(card.id);
    return cardHtml(card, match && actionIsMarketCard(match.action) ? { actionIndex: match.index, legal: true } : {});
  }).join("");
  $("market").innerHTML = market || `<p class="muted">The Market is empty.</p>`;
  const boss = view.boss;
  $("boss-summary").innerHTML = bossMode ? `<p class="rules-note">Stage ${boss.stageIndex + 1}/3 · ${boss.stats.bossAttacks} Boss attacks · ${boss.stats.bossGuardUses} Guard uses · ${boss.stats.enrageTurns} Enrage turns</p>` : `<p class="rules-note">Quick Duel · canonical rules · actions resolve through the shared engine.</p>`;
  $("log").textContent = (view.events ?? []).slice().reverse().map((event) => `${event.type}${event.card ? ` · ${event.card}` : ""}${event.stageName ? ` · ${event.stageName}` : ""}`).join("\n");
}

async function send(message) {
  $("error").textContent = ""; $("menu-error").textContent = "";
  const response = await window.dojoGame.command(message);
  if (!response.ok) {
    if (view?.screen === "game") $("error").textContent = response.error;
    else $("menu-error").textContent = response.error;
    if (response.view) { view = response.view; render(); }
    return;
  }
  view = response.view; render();
}

document.querySelectorAll(".mode").forEach((button) => button.addEventListener("click", () => send({ type: "start", mode: button.dataset.mode, seed: $("seed").value })));
$("new-game").addEventListener("click", async () => { await send({ type: "reset" }); view = null; $("game").classList.add("hidden"); $("menu").classList.remove("hidden"); });
$("inspector-close").addEventListener("click", closeInspector);
$("inspector-backdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeInspector(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeInspector(); });
document.addEventListener("click", (event) => {
  const inspectButton = event.target.closest("[data-inspect-id]");
  if (inspectButton) { openInspector(inspectButton.dataset.inspectId); return; }
  const actionButton = event.target.closest("[data-action-index]");
  if (actionButton) { send({ type: "action", action: actionStore[Number(actionButton.dataset.actionIndex)] }); return; }
  const choiceButton = event.target.closest("[data-choice]");
  if (choiceButton) send({ type: "choice", choice: { optionId: choiceButton.dataset.choice } });
});

window.dojoGame.getArtMap?.().then((map) => { artMap = map ?? {}; if (view) render(); }).catch(() => {});
