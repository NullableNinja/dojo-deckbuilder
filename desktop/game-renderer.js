const $ = (id) => document.getElementById(id);
let view = null;
let actionStore = [];
const assets = "assets";
const safe = (value) => String(value ?? "");
const art = (card) => card?.image ? `${assets}${card.image}` : `${assets}/art/card-placeholder-v2.webp`;
const stat = (card, key) => card?.stats?.[key] ?? "—";
const cardName = (id) => [...(view?.player?.hand ?? []), ...(view?.market ?? []), ...(view?.player?.equipment ?? [])].find((card) => card.id === id)?.name ?? id;

function cardHtml(card) {
  return `<article class="card"><img src="${art(card)}" alt="${safe(card.name)}"><b>${safe(card.name)}</b><small>${safe(card.subtype || card.cardType)} · ${safe(card.zone || "")}</small>${card.rulesText ? `<div class="rules">${safe(card.rulesText)}</div>` : ""}</article>`;
}

function actionLabel(action) {
  if (action.type === "pass") return view.phase === "Honor" ? "Begin round" : `Continue ${view.phase}`;
  if (action.type === "hide") return "Hide — end turn";
  if (action.type === "practice") return `Practice ${cardName(action.cardId)}`;
  if (action.type === "play-card") return `Play ${cardName(action.cardId)}`;
  if (action.type === "play-attack") return `Attack with ${cardName(action.cardId)}`;
  if (action.type === "purchase") return `Buy ${cardName(action.cardId)}`;
  if (action.type === "learn-combo") return `Learn ${cardName(action.cardId)}`;
  if (action.type === "decline-combo") return "Decline Combo";
  if (action.type === "promote") return "Promote Belt";
  if (action.type === "recover-training-stripe") return "Recover with Stripe";
  if (action.type === "tag") return `Tag to ${action.characterId}`;
  return action.type;
}

function render() {
  if (!view || view.screen === "menu") return;
  $("menu").classList.add("hidden"); $("game").classList.remove("hidden");
  const bossMode = view.mode === "boss-blitz"; const enemy = view.opponent; const player = view.player;
  $("mode-label").textContent = bossMode ? "Solo Boss Blitz" : "Quick Duel";
  $("game-title").textContent = view.winner !== null ? (view.winner === 0 ? "Victory" : "Defeat") : bossMode ? `${view.boss.stageName} awaits` : "Your turn";
  $("phase").textContent = view.winner !== null ? `${view.reason} · seed ${safe($("seed").value)}` : `${view.phase} phase · ${view.activePlayer === 0 ? "Your action" : "Computer action"}`;
  $("round").textContent = `Round ${view.round} · Turn ${view.turns}`;
  $("opponent-eyebrow").textContent = bossMode ? `${view.boss.stageName} · ${view.boss.profile?.name ?? "Boss Profile"}` : "Computer opponent";
  $("opponent-name").textContent = enemy.character?.name ?? enemy.name; $("opponent-art").src = art(bossMode ? view.boss.stage : enemy.character); $("opponent-art").alt = enemy.character?.name ?? enemy.name;
  $("opponent-hp").textContent = `${enemy.hp}/${enemy.maxHp}`; $("opponent-atk").textContent = enemy.atk; $("opponent-def").textContent = enemy.def; $("opponent-speed").textContent = enemy.speed;
  $("opponent-rules").textContent = bossMode ? (view.boss.profile?.rulesText ?? view.boss.stage?.rulesText ?? "") : (enemy.character?.rulesText ?? "");
  $("guard").innerHTML = bossMode && view.boss.guard ? `<p class="rules-note">Boss Guard: <b>${safe(view.boss.guard.card.name)}</b> · ${safe(view.boss.guard.zone)} · ${view.boss.guard.guard} Guard</p>` : "";
  $("player-hp").textContent = `${player.hp}/${player.maxHp}`; $("player-focus").textContent = player.focus; $("player-xp").textContent = player.xp; $("player-belt").textContent = player.beltName;
  $("roster").innerHTML = bossMode ? `<h3>Roster</h3><div class="roster">${player.roster.map((fighter) => `<div class="fighter ${fighter.character.catalogId === player.character?.catalogId ? "active" : ""} ${fighter.hp <= 0 ? "ko" : ""}"><b>${safe(fighter.character.name)}</b><br>${fighter.hp}/${fighter.maxHp} HP</div>`).join("")}</div>` : `<h3>${safe(player.character?.name)}</h3>`;
  $("hand").innerHTML = player.hand.map(cardHtml).join("") || `<p class="muted">No cards in hand.</p>`;
  actionStore = view.legalActions ?? [];
  $("actions").innerHTML = view.winner !== null ? `<h3>${view.winner === 0 ? "You won the game." : "The computer won."}</h3>` : actionStore.map((action, index) => `<button class="action" data-action-index="${index}">${safe(actionLabel(action))}</button>`).join("");
  const pending = view.pendingChoice; $("choice").classList.toggle("hidden", !pending); $("choice").innerHTML = pending ? `<h3>${safe(pending.kind)}</h3><p class="muted">Choose an option to continue.</p><div class="actions">${pending.options.map((option) => `<button class="action" data-choice="${safe(option.id)}">${safe(option.label || option.id)}</button>`).join("")}</div>` : "";
  const boss = view.boss; $("boss-summary").innerHTML = bossMode ? `<p class="rules-note">Stage ${boss.stageIndex + 1}/3 · ${boss.stats.bossAttacks} Boss attacks · ${boss.stats.bossGuardUses} Guard uses · ${boss.stats.enrageTurns} Enrage turns</p>` : `<p class="rules-note">The computer is controlled by the same legal-action engine.</p>`;
  $("market").innerHTML = view.market.map(cardHtml).join(""); $("log").textContent = (view.events ?? []).slice().reverse().map((event) => `${event.type}${event.card ? ` · ${event.card}` : ""}${event.stageName ? ` · ${event.stageName}` : ""}`).join("\n");
}

async function send(message) {
  $("error").textContent = "";
  const response = await window.dojoGame.command(message);
  if (!response.ok) { $("error").textContent = response.error; if (response.view) { view = response.view; render(); } return; }
  view = response.view; render();
}

document.querySelectorAll(".mode").forEach((button) => button.addEventListener("click", () => send({ type: "start", mode: button.dataset.mode, seed: $("seed").value })));
$("new-game").addEventListener("click", () => { send({ type: "reset" }); view = null; $("game").classList.add("hidden"); $("menu").classList.remove("hidden"); });
document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action-index]");
  if (actionButton) send({ type: "action", action: actionStore[Number(actionButton.dataset.actionIndex)] });
  const choiceButton = event.target.closest("[data-choice]");
  if (choiceButton) send({ type: "choice", choice: { optionId: choiceButton.dataset.choice } });
});
