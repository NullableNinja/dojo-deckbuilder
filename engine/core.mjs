import { attackPower, chooseAttack, chooseDefense, choosePractice, choosePurchase, cost, focus, guard } from "./bots.mjs";

export class Rng {
  constructor(seed = 1) { this.seed = Number(seed) || 1; this.state = this.seed >>> 0; }
  next() { this.state = (1664525 * this.state + 1013904223) >>> 0; return this.state / 2 ** 32; }
  pick(array) { return array.length ? array[Math.floor(this.next() * array.length)] : undefined; }
  shuffle(array) { for (let index = array.length - 1; index > 0; index -= 1) { const other = Math.floor(this.next() * (index + 1)); [array[index], array[other]] = [array[other], array[index]]; } return array; }
}

const num = (value) => Number.parseInt(String(value ?? 0), 10) || 0;
const remove = (array, value) => { const index = array.indexOf(value); if (index >= 0) array.splice(index, 1); };
const isAttack = (card) => attackPower(card) > 0;
const isDefense = (card) => guard(card) > 0;
const cardType = (card) => card.subtype === "Kata" ? "Kata" : isAttack(card) ? "Attack" : card.subtype;
const zones = ["High", "Mid", "Low"];

export class Game {
  constructor(data, { seed = 1, strategies = ["balanced", "balanced"], characters = [] } = {}) {
    this.data = data;
    this.definition = data.definition;
    this.effects = data.cardEffectById ?? new Map();
    this.seed = Number(seed) || 1;
    this.rng = new Rng(this.seed);
    this.cardSerial = 0;
    this.round = 1; this.turns = 0; this.winner = null; this.reason = "";
    this.events = []; this.cardStats = new Map(); this.marketPurchasedThisRound = false;
    this.phase = this.definition.turn.phases[0]; this.activePlayer = 0; this.pendingChoice = null; this.status = "active";
    this.telemetry = { attacks: 0, hits: 0, blocks: 0, totalDamage: 0, damagePrevented: 0, cardsPlayed: 0, cardsAcquired: 0, focusGenerated: 0, focusSpent: 0, defensePractice: 0, promotions: 0, unsupportedEffects: 0 };
    const charactersCatalog = data.cards.filter((card) => card.cardType === "Character");
    this.players = [0, 1].map((id) => this.makePlayer(id, characters[id] ?? charactersCatalog[id], strategies[id] ?? "balanced"));
    this.marketDeck = this.rng.shuffle(data.cards.filter((card) => this.definition.economy.market.decks.includes(card.deck)).map((card) => this.cardInstance(card)));
    this.marketDiscard = []; this.market = []; this.refillMarket(true);
  }

  cardInstance(card) { const instance = structuredClone(card); instance.instanceId = `${card.catalogId}#${++this.cardSerial}`; return instance; }

  makePlayer(id, character, strategy) {
    const deck = [];
    for (const entry of this.definition.starterDeck) for (let copy = 0; copy < entry.copies; copy += 1) deck.push(this.cardInstance(this.data.byId.get(entry.catalogId)));
    this.rng.shuffle(deck);
    const player = { id, name: `Player ${id + 1}`, character, strategy, hp: this.definition.mode.startingHp, maxHp: this.definition.mode.startingHp, atk: num(character?.stats?.ATK), def: num(character?.stats?.DEF), speed: num(character?.stats?.Speed), deck, hand: [], discard: [], destroyed: [], played: [], equipment: [], exhaustedEquipment: [], statuses: [], focus: 0, xp: 0, beltIndex: 0, tempo: true, purchases: 0, plays: 0, openingPurchase: false, badHabitFocusUsed: false, practiceUsed: false, attackCount: 0, nextAttackPower: 0, tempSpeed: 0, turnStats: { zones: new Set(), attacked: false, hit: false, blocked: false } };
    this.draw(player, this.definition.turn.handSize);
    const required = this.definition.openingMulligan.requiredTypes;
    if (required.length && !required.some((type) => new Set(player.hand.map(cardType)).has(type))) { player.deck.push(...player.hand); player.hand = []; this.rng.shuffle(player.deck); this.draw(player, this.definition.turn.handSize); }
    return player;
  }

  emit(event) {
    this.events.push({ ...event, round: event.round ?? this.round });
    if (event.type === "attack") {
      this.telemetry.attacks += 1; this.telemetry.totalDamage += event.damage;
      if (event.damage > 0) this.telemetry.hits += 1;
      if (event.defense && event.damage === 0) this.telemetry.blocks += 1;
      this.telemetry.damagePrevented += Math.max(0, event.block - event.attack + event.damage);
    }
  }

  draw(player, amount) {
    for (let count = 0; count < amount; count += 1) {
      if (!player.deck.length && player.discard.length) player.deck = this.rng.shuffle(player.discard.splice(0));
      const card = player.deck.pop(); if (!card) break; player.hand.push(card); this.track(card, "drawn", player);
    }
  }

  playerZones(player) { return ["deck", "hand", "discard", "destroyed", "played"]; }

  cardOwner(card) {
    return this.players.find((player) => this.playerZones(player).some((zone) => player[zone].includes(card)));
  }

  removeFromPlayerZones(player, card) {
    for (const zone of this.playerZones(player)) remove(player[zone], card);
    remove(player.equipment, card);
    remove(player.exhaustedEquipment, card.instanceId);
  }

  moveCard(player, card, destination) {
    if (!player || !card || !this.playerZones(player).includes(destination)) return false;
    this.removeFromPlayerZones(player, card);
    player[destination].push(card);
    return true;
  }

  discardCard(player, card) { return this.moveCard(player, card, "discard"); }

  destroyCard(player, card) {
    if (!this.moveCard(player, card, "destroyed")) return false;
    this.emit({ type: "card-destroyed", player: player.id, card: card.catalogId });
    return true;
  }

  equipmentIsExhausted(player, card) { return player.exhaustedEquipment.includes(card.instanceId); }

  setEquipmentReady(player, card, ready) {
    if (!card || !player.equipment.includes(card)) return false;
    if (ready) remove(player.exhaustedEquipment, card.instanceId);
    else if (!this.equipmentIsExhausted(player, card)) player.exhaustedEquipment.push(card.instanceId);
    this.emit({ type: ready ? "equipment-ready" : "equipment-exhaust", player: player.id, card: card.catalogId });
    return true;
  }

  addStatus(player, status) {
    player.statuses.push({ ...status, id: status.id ?? `${status.action ?? "status"}:${player.statuses.length + 1}` });
  }

  statusValue(player, action, { consumeDuration = null } = {}) {
    let total = consumeDuration ? this.consumeStatuses(player, action, consumeDuration) : 0;
    for (const status of player.statuses) {
      if (status.action !== action || status.consumed) continue;
      if (status.duration === "whileEquipped" && status.sourceId && !player.equipment.some((card) => card.instanceId === status.sourceId)) continue;
      total += num(status.amount);
    }
    return total;
  }

  consumeStatuses(player, action, duration, context = {}) {
    let total = 0;
    for (const status of player.statuses) {
      if (status.action !== action || status.duration !== duration) continue;
      if (status.sourceId && context.sourceId && status.sourceId !== context.sourceId) continue;
      total += num(status.amount);
      if (duration === "nextAttack" || duration === "nextDefense" || duration === "nextDamage" || duration === "nextHonor") status.consumed = true;
    }
    player.statuses = player.statuses.filter((status) => !status.consumed);
    return total;
  }

  expireStatuses(player, duration) {
    player.statuses = player.statuses.filter((status) => status.duration !== duration);
  }

  refillMarket(full = false) {
    const size = this.definition.economy.market.rowSize;
    if (full) { this.marketDiscard.push(...this.market); this.market = []; }
    while (this.market.length < size) {
      if (!this.marketDeck.length && this.marketDiscard.length) this.marketDeck = this.rng.shuffle(this.marketDiscard.splice(0));
      const next = this.marketDeck.pop(); if (!next) break; this.market.push(next); this.track(next, "offered");
    }
  }

  track(card, key, player) {
    const stats = this.cardStats.get(card.catalogId) ?? { id: card.catalogId, name: card.name, offered: 0, drawn: 0, purchased: 0, played: 0, winnerOwned: 0 };
    stats[key] = (stats[key] ?? 0) + 1; if (player) (player._used ??= new Set()).add(card.catalogId); this.cardStats.set(card.catalogId, stats);
    if (key === "played") this.telemetry.cardsPlayed += 1; if (key === "purchased") this.telemetry.cardsAcquired += 1;
  }

  cardEffects(card, trigger) { return (this.effects.get(card.catalogId)?.effects ?? []).filter((effect) => effect.trigger === trigger); }

  evaluateConditions(effect, context) {
    const values = {
      isFastest: context.player.speed + context.player.tempSpeed > context.opponent.speed + context.opponent.tempSpeed,
      firstAttackThisTurn: context.player.attackCount === 1,
      attackNumber: context.player.attackCount,
      defenderPlayedDefense: Boolean(context.defensePlayed),
      targetHpAtMost: context.opponent.hp,
      hasTempo: Boolean(context.player.tempo),
      targetPermanentEquipmentCount: context.opponent.equipment.length,
      hasFewerCardsThanTarget: context.player.hand.length < context.opponent.hand.length,
      alternateZone: context.zone,
      attackZone: context.zone,
      attackZones: context.zone,
      incomingZones: context.zone,
      incomingAttackTargetsSelf: Boolean(context.targetsSelf ?? true),
      sourceExhausted: Boolean(context.sourceCard && context.player && this.equipmentIsExhausted(context.player, context.sourceCard)),
      firstDamageThisRound: (context.player.turnStats.damageTaken ?? 0) === 0,
      blockedThisRound: Boolean(context.player.turnStats.blocked),
      playedDefenseSinceLastTurn: Boolean(context.player.turnStats.playedDefenseSinceLastTurn),
      previousAttackHit: Boolean(context.player.turnStats.previousAttackHit),
      differentZoneFromPreviousAttack: context.player.turnStats.previousZone ? context.player.turnStats.previousZone !== context.zone : false,
      manualActivation: Boolean(context.manualActivation),
    };
    const parse = (condition) => {
      if (typeof condition !== "string") return condition;
      const fields = Object.fromEntries([...condition.matchAll(/([a-zA-Z]+)=([^;}]*)/g)].map((match) => [match[1], match[2]]));
      const value = fields.value === "True" || fields.value === "true" ? true : fields.value === "False" || fields.value === "false" ? false : Number.isNaN(Number(fields.value)) ? fields.value : Number(fields.value);
      return { kind: fields.kind, operator: fields.operator ?? "eq", value };
    };
    const compare = (actual, operator, expected) => {
      if (Array.isArray(expected) && (operator === "eq" || operator === "includes" || operator === "includesAny")) return expected.includes(actual);
      if (operator === "includesAny") return Array.isArray(expected) && expected.some((value) => Array.isArray(actual) && actual.includes(value));
      if (operator === "includes") return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
      if (operator === "notIncludes") return Array.isArray(actual) ? !actual.includes(expected) : !String(actual ?? "").includes(String(expected ?? ""));
      if (operator === "gt") return Number(actual) > Number(expected);
      if (operator === "gte") return Number(actual) >= Number(expected);
      if (operator === "lt") return Number(actual) < Number(expected);
      if (operator === "lte") return Number(actual) <= Number(expected);
      if (operator === "neq") return actual !== expected;
      return actual === expected;
    };
    for (const raw of effect.conditions ?? []) {
      const condition = parse(raw); const kind = String(condition?.kind ?? "");
      if (kind === "always") continue;
      if (!(kind in values)) return { known: false, pass: false };
      if (!compare(values[kind], condition.operator ?? "eq", condition.value)) return { known: true, pass: false };
    }
    return { known: true, pass: true };
  }

  applyPassiveEquipment(player, opponent, context = {}) {
    const result = { player, opponent, ...context };
    for (const equipment of player.equipment) {
      const next = this.applyCardEffects(player, equipment, "passive", { ...result, sourceCard: equipment });
      for (const key of ["attackPowerModifier", "guardModifier", "defenseModifier", "damagePrevention", "piercing"]) if (next[key] !== undefined) result[key] = (result[key] ?? 0) + (next[key] ?? 0);
    }
    return result;
  }

  unsupportedEffect(card, effect) { this.telemetry.unsupportedEffects += 1; this.emit({ type: "unsupported-effect", player: null, card: card.catalogId, effect: effect.id, action: effect.action ?? null }); }

  queueCardChoice(player, targetPlayer, effect, movement, amount = 1) {
    const options = targetPlayer.hand.map((candidate) => ({ id: candidate.instanceId, label: candidate.name }));
    if (!options.length) return false;
    this.pendingChoice = {
      kind: "card-movement", playerId: player.id, targetPlayerId: targetPlayer.id, movement, amount,
      sourceCardId: effect.sourceCardId ?? null, effectId: effect.id ?? null, options,
    };
    return true;
  }

  resolveCardMovementChoice(pending, selected) {
    const targetPlayer = this.players[pending.targetPlayerId];
    const card = targetPlayer.hand.find((candidate) => candidate.instanceId === selected);
    if (!card) return false;
    if (pending.movement === "discard") this.discardCard(targetPlayer, card);
    else if (pending.movement === "destroy") this.destroyCard(targetPlayer, card);
    else return false;
    const remaining = Number(pending.amount ?? 1) - 1;
    this.pendingChoice = null;
    if (remaining > 0 && this.queueCardChoice(this.players[pending.playerId], targetPlayer, pending, pending.movement, remaining)) return true;
    return true;
  }

  applyCardEffects(player, card, trigger, context = {}) {
    const effectContext = { player, opponent: context.opponent ?? this.players[1 - player.id], sourceCard: card, ...context };
    for (const effect of this.cardEffects(card, trigger)) {
      const conditions = this.evaluateConditions(effect, effectContext);
      if (!conditions.known) { this.unsupportedEffect(card, effect); continue; }
      if (!conditions.pass) continue;
      const amount = num(effect.amount); const action = effect.action ?? effect.effect;
      if (action === "gainFocus") { player.focus += amount; this.telemetry.focusGenerated += amount; }
      else if (action === "draw") this.draw(player, Math.max(0, amount));
      else if (action === "discard" || action === "destroy") {
        const targetPlayer = effect.target === "opponent" ? effectContext.opponent : player;
        if (effect.target === "source" && effectContext.sourceCard) {
          if (action === "discard") this.discardCard(player, effectContext.sourceCard); else this.destroyCard(player, effectContext.sourceCard);
        } else if (!this.queueCardChoice(player, targetPlayer, { ...effect, sourceCardId: effectContext.sourceCard?.instanceId }, action, Math.max(1, amount))) {
          continue;
        }
      }
      else if (action === "ready" || action === "exhaust") {
        const targetCard = effect.target === "source" ? effectContext.sourceCard : player.equipment.find((candidate) => candidate.instanceId === effect.cardId);
        if (targetCard && this.setEquipmentReady(player, targetCard, action === "ready")) { /* handled */ }
        else this.unsupportedEffect(card, effect);
      }
      else if (action === "modifyAttackPower") { if (effect.duration === "nextAttack") player.nextAttackPower += amount; else if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.attackPowerModifier = (effectContext.attackPowerModifier ?? 0) + amount; }
      else if (action === "modifySpeed") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else player.tempSpeed += amount; }
      else if (action === "modifyGuard") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.guardModifier = (effectContext.guardModifier ?? 0) + amount; }
      else if (action === "modifyDefense") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.defenseModifier = (effectContext.defenseModifier ?? 0) + amount; }
      else if (action === "preventDamage") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.damagePrevention = (effectContext.damagePrevention ?? 0) + amount; }
      else if (action === "heal") player.hp = Math.min(player.maxHp, player.hp + amount);
      else if (action === "dealDamage") effectContext.opponent.hp -= Math.max(0, amount);
      else if (action === "minimumSpeed") player.speed = Math.max(player.speed, amount);
      else if (action === "piercing") { if (effect.duration && effect.duration !== "immediate") this.addStatus(player, { action, amount, duration: effect.duration, sourceId: card.instanceId }); else effectContext.piercing = (effectContext.piercing ?? 0) + amount; }
      else if (action === "custom" && effect.resolver === "starter.gainFocusIfFastest") { if (player.speed + player.tempSpeed > effectContext.opponent.speed + effectContext.opponent.tempSpeed) { player.focus += amount; this.telemetry.focusGenerated += amount; } }
      else if (action === "chooseZone" && effectContext.allowChoice) effectContext.choice = { kind: "attack-zone", options: zones };
      else this.unsupportedEffect(card, effect);
    }
    return effectContext;
  }

  resolveAttack(attacker, defender, card, { useTempo = true, defenseCard, zone } = {}) {
    if (!card || !attacker.hand.includes(card)) return null;
    remove(attacker.hand, card); attacker.played.push(card); attacker.focus += focus(card); this.telemetry.focusGenerated += focus(card); attacker.plays += 1; attacker.attackCount += 1; attacker.turnStats.attacked = true; attacker.turnStats.zones.add(zone ?? (card.zone === "Any" ? "Mid" : card.zone)); this.track(card, "played", attacker);
    const context = this.applyCardEffects(attacker, card, "onAttackDeclared", this.applyPassiveEquipment(attacker, defender, { zone, attackPowerModifier: this.statusValue(attacker, "modifyAttackPower", { consumeDuration: "nextAttack" }), piercing: this.statusValue(attacker, "piercing", { consumeDuration: "nextAttack" }), allowChoice: false }));
    if (defenseCard) { remove(defender.hand, defenseCard); defender.discard.push(defenseCard); defender.focus += focus(defenseCard); this.telemetry.focusGenerated += focus(defenseCard); this.track(defenseCard, "played", defender); }
    const defenseContext = defenseCard ? this.applyCardEffects(defender, defenseCard, "onDefenseDeclared", this.applyPassiveEquipment(defender, attacker, { opponent: attacker, defensePlayed: true, zone, guardModifier: this.statusValue(defender, "modifyGuard", { consumeDuration: "nextDefense" }), defenseModifier: this.statusValue(defender, "modifyDefense", { consumeDuration: "nextDefense" }), damagePrevention: this.statusValue(defender, "preventDamage", { consumeDuration: "nextDefense" }) })) : this.applyPassiveEquipment(defender, attacker, { zone, damagePrevention: this.statusValue(defender, "preventDamage", { consumeDuration: "nextDefense" }) });
    const tempo = useTempo && attacker.tempo ? this.definition.turn.tempoAttackPower : 0; if (tempo) attacker.tempo = false;
    const attack = attackPower(card) + attacker.atk + tempo + attacker.nextAttackPower + this.statusValue(attacker, "modifyAttackPower") + (context.attackPowerModifier ?? 0); attacker.nextAttackPower = 0;
    const block = Math.max(0, defender.def + (defenseCard ? guard(defenseCard) : 0) + this.statusValue(defender, "modifyGuard") + this.statusValue(defender, "modifyDefense") + (defenseContext.guardModifier ?? 0) + (defenseContext.defenseModifier ?? 0) - (context.piercing ?? 0) - this.statusValue(attacker, "piercing")); const damage = Math.max(this.definition.combat.damageFloor, attack - block - (defenseContext.damagePrevention ?? 0) - this.statusValue(defender, "preventDamage")); defender.hp -= damage;
    if (damage > 0) { attacker.xp += this.definition.progression.attackXpOnHit; attacker.turnStats.hit = true; defender.turnStats.damageTaken = (defender.turnStats.damageTaken ?? 0) + damage; } else if (defenseCard) { defender.xp += this.definition.progression.defenseXpOnBlock; defender.turnStats.blocked = true; }
    attacker.turnStats.previousAttackHit = damage > 0; attacker.turnStats.previousZone = zone;
    if (defenseCard) defender.turnStats.playedDefenseSinceLastTurn = true;
    if (damage > 0) this.applyCardEffects(attacker, card, "onHit", { opponent: defender, damage, attack, block, zone });
    else if (defenseCard) this.applyCardEffects(defender, defenseCard, "onBlock", { opponent: attacker, damage, attack, block, zone, defensePlayed: true });
    this.applyCardEffects(attacker, card, "afterResolve", { opponent: defender, damage, attack, block, zone });
    this.emit({ type: "attack", attacker: attacker.id, defender: defender.id, card: card.catalogId, defense: defenseCard?.catalogId ?? null, attack, block, damage, defenseFocus: focus(defenseCard) }); this.checkWinner();
    return { attack, block, damage, defense: defenseCard };
  }

  practice(player, card) {
    if (this.definition.economy.defensePractice.usesPerTurn < 1 || player.practiceUsed || !card || !isDefense(card) || !player.hand.includes(card)) return false;
    remove(player.hand, card); player.played.push(card); player.focus += focus(card); this.telemetry.focusGenerated += focus(card); this.telemetry.defensePractice += 1; player.practiceUsed = true; player.turnStats.playedDefenseSinceLastTurn = true; this.track(card, "played", player); this.emit({ type: "defense-practice", player: player.id, card: card.catalogId, focus: focus(card) }); return true;
  }

  cashBadHabit(player) {
    const rule = this.definition.economy.badHabitFocus; if (!rule || rule.usesPerTurn < 1 || player.badHabitFocusUsed) return false;
    const card = player.hand.find((candidate) => candidate?.catalogId === rule.catalogId); if (!card) return false; remove(player.hand, card); player.discard.push(card); player.focus += Number(rule.focusGain) || 0; this.telemetry.focusGenerated += Number(rule.focusGain) || 0; player.badHabitFocusUsed = true; this.emit({ type: "bad-habit-focus", player: player.id, card: card.catalogId, focus: Number(rule.focusGain) || 0 }); return true;
  }

  playCard(player, card) {
    const combatTechnique = card?.cardType === "Technique" || card?.cardType === "Starter";
    if (!card || !player.hand.includes(card) || combatTechnique && (isAttack(card) || isDefense(card))) return false;
    remove(player.hand, card); player.played.push(card); player.focus += focus(card); this.telemetry.focusGenerated += focus(card); player.plays += 1; const equipment = ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype); if (equipment) player.equipment.push(card); this.track(card, "played", player); this.applyCardEffects(player, card, "onPlay", { opponent: this.players[1 - player.id] }); if (equipment) this.applyCardEffects(player, card, "onEquip", { opponent: this.players[1 - player.id] }); return true;
  }

  buy(player, card) {
    if (!card || !this.market.includes(card) || cost(card) > player.focus) return false;
    player.focus -= cost(card); this.telemetry.focusSpent += cost(card); remove(this.market, card); player.discard.push(card); player.purchases += 1; this.marketPurchasedThisRound = true; if (this.round === 1) player.openingPurchase = true; this.track(card, "purchased", player); this.applyCardEffects(player, card, "onPurchase", { opponent: this.players[1 - player.id] }); this.refillMarket(false); this.emit({ type: "purchase", player: player.id, card: card.catalogId, cost: cost(card), focusRemaining: player.focus }); return true;
  }

  getPendingChoice() { return this.pendingChoice ? structuredClone(this.pendingChoice) : null; }

  getLegalActions(playerId = this.activePlayer) {
    if (this.winner !== null || this.status !== "active") return [];
    if (this.pendingChoice) return [{ type: "resolve-choice", playerId: this.pendingChoice.playerId, choiceId: this.pendingChoice.kind, options: this.pendingChoice.options }];
    if (playerId !== this.activePlayer) return [];
    const player = this.players[playerId];
    if (this.phase === "Honor") return [{ type: "pass", playerId }];
    if (this.phase === "Initiate") return [{ type: "pass", playerId }, ...player.hand.filter((card) => ["Weapon", "Gear", "Defense Equipment"].includes(card.subtype)).map((card) => ({ type: "play-card", playerId, cardId: card.instanceId }))];
    if (this.phase === "Yell") return [...player.hand.filter(isAttack).map((card) => ({ type: "play-attack", playerId, cardId: card.instanceId })), ...player.hand.filter((card) => !isAttack(card) && !isDefense(card)).map((card) => ({ type: "play-card", playerId, cardId: card.instanceId })), ...(this.definition.economy.defensePractice.usesPerTurn > 0 && !player.practiceUsed ? player.hand.filter(isDefense).map((card) => ({ type: "practice", playerId, cardId: card.instanceId })) : []), { type: "pass", playerId }];
    if (this.phase === "Ascend") return [...this.market.filter((card) => cost(card) <= player.focus).map((card) => ({ type: "purchase", playerId, cardId: card.instanceId })), { type: "pass", playerId }];
    if (this.phase === "Hide") return [{ type: "hide", playerId }];
    return [];
  }

  cardByInstance(playerId, instanceId) { const player = this.players[playerId]; return [...player.hand, ...player.played, ...player.deck, ...player.discard].find((card) => card.instanceId === instanceId); }

  beginAttack(playerId, card, action = {}) {
    if (!card) return false;
    const defenderId = 1 - playerId;
    if (card.zone === "Any" && !action.zone) { this.pendingChoice = { kind: "attack-zone", playerId, cardId: card.instanceId, options: zones.map((zone) => ({ id: zone, label: zone })) }; return true; }
    const defender = this.players[defenderId]; this.pendingChoice = { kind: "defense", playerId: defenderId, attackerId: playerId, cardId: card.instanceId, zone: action.zone ?? card.zone, options: [{ id: "pass", label: "Take the hit" }, ...defender.hand.filter(isDefense).map((candidate) => ({ id: candidate.instanceId, label: candidate.name }))] }; return true;
  }

  resolveChoice(choice) {
    if (!this.pendingChoice) return false;
    const pending = this.pendingChoice; const selected = choice?.optionId ?? choice?.id ?? choice; if (!pending.options.some((option) => option.id === selected)) return false;
    if (pending.kind === "card-movement") return this.resolveCardMovementChoice(pending, selected);
    if (pending.kind === "attack-zone") { const card = this.cardByInstance(pending.playerId, pending.cardId); this.pendingChoice = null; return this.beginAttack(pending.playerId, card, { zone: selected }); }
    const attacker = this.players[pending.attackerId]; const defender = this.players[pending.playerId]; const card = this.cardByInstance(pending.attackerId, pending.cardId); const defense = selected === "pass" ? null : defender.hand.find((candidate) => candidate.instanceId === selected); this.pendingChoice = null; return Boolean(this.resolveAttack(attacker, defender, card, { defenseCard: defense, zone: pending.zone }));
  }

  applyAction(action) {
    if (!action || this.winner !== null || this.status !== "active") return false;
    if (this.pendingChoice) return action.type === "resolve-choice" && this.resolveChoice(action.choice ?? action.optionId);
    if (action.playerId !== undefined && action.playerId !== this.activePlayer) return false;
    const player = this.players[this.activePlayer];
    if (action.type === "pass") { if (this.phase === "Honor") this.phase = "Initiate"; else if (this.phase === "Initiate") { for (const card of player.equipment) this.applyCardEffects(player, card, "onInitiate", { opponent: this.players[1 - player.id] }); this.phase = "Yell"; } else if (this.phase === "Yell") this.phase = "Ascend"; else if (this.phase === "Ascend") this.phase = "Hide"; else if (this.phase === "Hide") { this.hide(player); this.finishTurn(); } return true; }
    if (action.type === "hide" && this.phase === "Hide") { this.hide(player); this.finishTurn(); return true; }
    if (action.type === "practice" && this.phase === "Yell") return this.practice(player, player.hand.find((card) => card.instanceId === action.cardId));
    if (action.type === "play-card" && (this.phase === "Yell" || this.phase === "Initiate")) return this.playCard(player, player.hand.find((card) => card.instanceId === action.cardId));
    if (action.type === "play-attack" && this.phase === "Yell") return this.beginAttack(this.activePlayer, player.hand.find((card) => card.instanceId === action.cardId), action);
    if (action.type === "purchase" && this.phase === "Ascend") return this.buy(player, this.market.find((card) => card.instanceId === action.cardId));
    return false;
  }

  advanceAutomaticEvents() {
    if (this.winner !== null || this.pendingChoice || this.phase !== "Honor") return false;
    for (const player of this.players) { if (player.hp > 0) player.xp += this.definition.progression.xpPerHonor; player.tempo = true; player.practiceUsed = false; player.attackCount = 0; this.expireStatuses(player, "nextHonor"); player.turnStats = { zones: new Set(), attacked: false, hit: false, blocked: false, damageTaken: 0, playedDefenseSinceLastTurn: false, previousAttackHit: false, previousZone: null }; }
    const living = this.players.filter((player) => player.hp > 0).sort((left, right) => (right.speed + right.tempSpeed) - (left.speed + left.tempSpeed) || left.id - right.id); if (living.length) this.activePlayer = living[0].id; this.phase = "Initiate"; this.emit({ type: "honor", players: this.players.map((player) => ({ id: player.id, xp: player.xp })) }); return true;
  }

  finishTurn() { this.turns += 1; this.expireStatuses(this.players[this.activePlayer], "endOfTurn"); const next = this.activePlayer === 0 ? 1 : 0; if (next === 0) { this.round += 1; for (const player of this.players) this.expireStatuses(player, "endOfRound"); if (!this.marketPurchasedThisRound) this.refillMarket(true); this.marketPurchasedThisRound = false; this.phase = "Honor"; } else this.phase = "Initiate"; this.activePlayer = next; this.checkWinner(); }

  hide(player) { for (const card of new Set([...player.played, ...player.equipment])) this.applyCardEffects(player, card, "onHide", { opponent: this.players[1 - player.id] }); player.discard.push(...player.hand, ...player.played.filter((card) => !player.equipment.includes(card))); player.hand = []; player.played = player.equipment.slice(); player.focus = 0; player.badHabitFocusUsed = false; player.practiceUsed = false; player.nextAttackPower = 0; player.tempSpeed = 0; this.expireStatuses(player, "endOfTurn"); this.draw(player, this.definition.turn.handSize + (player.xp >= 28 ? 1 : 0)); this.emit({ type: "hide", player: player.id, handSize: player.hand.length }); }

  checkWinner() { const alive = this.players.filter((player) => player.hp > 0); if (alive.length === 1) { this.winner = alive[0].id; this.reason = "knockout"; } else if (this.round > this.definition.mode.maxRounds) { this.winner = this.players[0].hp === this.players[1].hp ? this.rng.pick([0, 1]) : this.players[0].hp > this.players[1].hp ? 0 : 1; this.reason = "round-limit"; } if (this.winner !== null) this.status = "complete"; return this.winner !== null; }

  defaultAction(legal) {
    const player = this.players[this.activePlayer];
    if (this.phase === "Yell") { const attack = chooseAttack(player.hand, player.strategy); const attackAction = attack && legal.find((action) => action.type === "play-attack" && action.cardId === attack.instanceId); if (attackAction) return attackAction; const practice = choosePractice(player.hand, player.strategy); const practiceAction = practice && legal.find((action) => action.type === "practice" && action.cardId === practice.instanceId); if (practiceAction && !player.practiceUsed) return practiceAction; const cardAction = legal.find((action) => action.type === "play-card"); if (cardAction) return cardAction; }
    if (this.phase === "Ascend") { const purchase = choosePurchase(this.market, player.focus, player.strategy); const purchaseAction = purchase && legal.find((action) => action.type === "purchase" && action.cardId === purchase.instanceId); if (purchaseAction) return purchaseAction; }
    return legal.find((action) => action.type === "pass" || action.type === "hide") ?? legal[0];
  }

  defaultChoice() {
    if (this.pendingChoice?.kind === "attack-zone" || this.pendingChoice?.kind === "card-movement") return { optionId: this.pendingChoice.options[0].id };
    const defender = this.players[this.pendingChoice.playerId]; const defense = chooseDefense(defender.hand); return { optionId: defense?.instanceId ?? "pass" };
  }

  run({ policy = null, maxSteps = 100000 } = {}) {
    const controller = policy ?? { chooseAction: (game, legal) => game.defaultAction(legal), chooseChoice: (game) => game.defaultChoice() }; let steps = 0;
    while (this.winner === null && steps < maxSteps) { steps += 1; this.advanceAutomaticEvents(); if (this.pendingChoice) { const choice = controller.chooseChoice ? controller.chooseChoice(this, this.getPendingChoice()) : this.defaultChoice(); if (!this.resolveChoice(choice)) throw new Error(`Policy selected illegal choice at seed ${this.seed}`); continue; } const legal = this.getLegalActions(); if (!legal.length) throw new Error(`No legal actions in ${this.phase} for player ${this.activePlayer} at seed ${this.seed}`); const action = controller.chooseAction ? controller.chooseAction(this, legal) : this.defaultAction(legal); if (!this.applyAction(action)) throw new Error(`Policy selected illegal action at seed ${this.seed}: ${JSON.stringify(action)}`); }
    if (this.winner === null) throw new Error(`Game exceeded ${maxSteps} steps at seed ${this.seed}`);
    for (const player of this.players) for (const id of player._used ?? []) if (player.id === this.winner) this.cardStats.get(id).winnerOwned += 1; return this.result();
  }

  botTurn(index) {
    const player = this.players[index]; const defender = this.players[1 - index]; player.tempo = true; this.practice(player, choosePractice(player.hand, player.strategy)); this.cashBadHabit(player); let attackNumber = 0;
    while (defender.hp > 0) { const attack = chooseAttack(player.hand, player.strategy); if (!attack) break; this.resolveAttack(player, defender, attack, { useTempo: attackNumber === 0 }); attackNumber += 1; }
    for (const card of [...player.hand]) if (["Kata", "Consumable", "Gear", "Weapon", "Defense Equipment"].includes(card.subtype)) this.playCard(player, card);
    while (true) { const purchase = choosePurchase(this.market, player.focus, player.strategy); if (!purchase || !this.buy(player, purchase)) break; }
    this.emit({ type: "turn-snapshot", player: player.id, xp: player.xp, focus: player.focus, hp: player.hp, purchases: player.purchases }); this.hide(player); this.turns += 1; this.checkWinner();
  }

  checkInvariants() {
    const failures = []; if (!Number.isInteger(this.round) || this.round < 1) failures.push("round must be a positive integer"); if (!Number.isInteger(this.activePlayer) || !this.players[this.activePlayer]) failures.push("activePlayer must identify a player");
    for (const player of this.players) { if (player.hp > player.maxHp) failures.push(`${player.name} exceeds max HP`); if (player.focus < 0) failures.push(`${player.name} has negative Focus`); const seen = new Set(); for (const zone of ["deck", "hand", "discard", "destroyed", "played"]) for (const card of player[zone]) { if (!card.instanceId) failures.push(`${player.name} contains a card without instanceId`); else if (seen.has(card.instanceId)) failures.push(`${player.name} contains ${card.instanceId} in multiple zones`); else seen.add(card.instanceId); } for (const card of player.equipment) if (!player.played.includes(card)) failures.push(`${player.name} equipment ${card.catalogId} is not in play`); for (const instanceId of player.exhaustedEquipment) if (!player.equipment.some((card) => card.instanceId === instanceId)) failures.push(`${player.name} has exhausted equipment outside equipment`); }
    return failures;
  }

  getState() {
    const cardIds = (cards) => cards.map((card) => card.instanceId ?? card.catalogId);
    return { schemaVersion: 2, rulesVersion: this.definition.rulesVersion, seed: this.seed, round: this.round, turns: this.turns, phase: this.phase, activePlayer: this.activePlayer, winner: this.winner, reason: this.reason, pendingChoice: this.getPendingChoice(), market: cardIds(this.market), marketDeck: cardIds(this.marketDeck), marketDiscard: cardIds(this.marketDiscard), players: this.players.map((player) => ({ id: player.id, hp: player.hp, maxHp: player.maxHp, atk: player.atk, def: player.def, speed: player.speed, focus: player.focus, xp: player.xp, beltIndex: player.beltIndex, tempo: player.tempo, exhaustedEquipment: [...player.exhaustedEquipment], statuses: structuredClone(player.statuses), cardZones: { deck: cardIds(player.deck), hand: cardIds(player.hand), discard: cardIds(player.discard), destroyed: cardIds(player.destroyed), played: cardIds(player.played), equipment: cardIds(player.equipment) } })) };
  }

  result() { return { seed: this.seed, winner: this.winner, reason: this.reason, rounds: this.round, turns: this.turns, phase: this.phase, players: this.players.map((player) => ({ id: player.id, strategy: player.strategy, hp: player.hp, xp: player.xp, beltIndex: player.beltIndex, purchases: player.purchases, plays: player.plays, openingPurchase: player.openingPurchase })), cards: [...this.cardStats.values()], telemetry: { ...this.telemetry }, invariantFailures: this.checkInvariants(), unsupportedEffects: this.telemetry.unsupportedEffects, events: this.events, state: this.getState() }; }
}

export const createGame = (data, config = {}) => new Game(data, config);
export const getLegalActions = (game, playerId) => game.getLegalActions(playerId);
export const applyAction = (game, action) => game.applyAction(action);
export const resolveChoice = (game, choice) => game.resolveChoice(choice);
export const advanceAutomaticEvents = (game) => game.advanceAutomaticEvents();
export const isGameOver = (game) => game.winner !== null;
export const getWinner = (game) => game.winner;
