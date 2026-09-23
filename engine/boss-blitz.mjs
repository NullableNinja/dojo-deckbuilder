import { Game } from "./core.mjs";
import { attackPower, chooseAttack, chooseDefense, choosePractice, choosePurchase, cost, focus, guard } from "./bots.mjs";

const BOSS_SUBTYPES = new Set(["Boss Attack", "Boss Defense", "Boss Technique"]);
const EQUIPMENT_SUBTYPES = new Set(["Weapon", "Gear", "Defense Equipment"]);
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const remove = (list, value) => { const index = list.indexOf(value); if (index >= 0) list.splice(index, 1); };

/**
 * Solo Dojo Drama: Boss Blitz.
 *
 * This is an engine mode, not a simulator rule overlay. The player side uses
 * the normal Game lifecycle and combat resolver; this class supplies only the
 * canonical Boss ladder, Boss Arsenal, Boss Guard, and Boss turn lifecycle.
 */
export class BossBlitzGame extends Game {
  constructor(data, { seed = 1, strategies = ["balanced"], characters = [], bossProfiles = null, interactive = false } = {}) {
    const catalogCharacters = data.cards.filter((card) => card.cardType === "Character");
    const roster = (characters.length ? characters : catalogCharacters.slice(0, 3)).map((entry) => typeof entry === "string" ? data.byId.get(entry) : entry).filter(Boolean).slice(0, 3);
    if (roster.length !== 3) throw new Error("Boss Blitz requires exactly three canonical Characters");
    super(data, { seed, strategies: [strategies[0] ?? "balanced", "boss"], characters: [roster[0], roster[1]] });
    this.modeId = "boss-blitz";
    this.bossConfig = this.definition.mode.bossBlitz;
    if (!this.bossConfig) throw new Error("boss-blitz is missing its canonical bossBlitz definition");
    this.bossProfiles = bossProfiles;
    this.interactive = Boolean(interactive);
    this.pendingBossAttack = null;
    this.bossTurnInProgress = false;
    this.bossTurnAttackIndex = 0;
    this.bossTurnAttackCount = 0;
    this.bossStageIndex = 0;
    this.bossStagePending = false;
    this.bossGuard = null;
    this.bossArsenal = [];
    this.bossArsenalDiscard = [];
    this.bossAttackPowerBonus = 0;
    this.bossStats = { stages: 0, arsenalRevealed: 0, bossAttacks: 0, bossHits: 0, bossBlocks: 0, bossDamage: 0, bossDamagePrevented: 0, bossGuardUses: 0, stageTransitions: 0 };
    this.scenarioVictory = false;
    this._bossEventSerial = 0;
    this.telemetry.boss = { stages: 0, stageTransitions: 0, arsenalRevealed: 0, bossAttacks: 0, bossHits: 0, bossBlocks: 0, bossDamage: 0, bossDamagePrevented: 0, guardUses: 0, enrageTurns: 0 };

    const player = this.players[0];
    player.name = "Dojo Team";
    player.roster = roster.map((character) => ({ character, hp: this.definition.mode.startingHp, maxHp: this.definition.mode.startingHp, atk: num(character.stats?.ATK), def: num(character.stats?.DEF), speed: num(character.stats?.Speed), equipment: [], exhaustedEquipment: [], statuses: [] }));
    player.activeCharacterIndex = 0;
    player.taggedThisTurn = false;
    player.scenario = "boss-blitz";
    this.saveActiveFighter(player);

    this.players[1] = this.makeBossSide();
    this.turnOrder = [0];
    this.turnOrderPosition = 0;
    this.activePlayer = 0;
    this.phase = "Honor";
    this.beginBossStage(0);
  }

  makeBossSide() {
    return {
      id: 1, name: "Boss", strategy: "boss", character: null, hp: 1, maxHp: 1, atk: 0, def: 0, speed: 0,
      deck: [], hand: [], discard: [], destroyed: [], played: [], equipment: [], exhaustedEquipment: [], statuses: [], revealed: [],
      learnedCombos: [], comboOffered: null, comboAttemptedThisTurn: false, comboTriggeredTurn: [], comboTriggeredRound: [], comboTriggeredThisGame: false,
      comboFacts: this.emptyComboFacts(), examProgress: { zones: [], purchasedTypes: [], koWhileBrown: false }, honorStats: { attacked: false, blocked: false },
      completedTasks: [], trainingStripes: { held: 0, awarded: 0, provisional: false, spentTurnKey: null, spendsThisTurn: 0 }, beltCheckActionUsed: false,
      effectUsage: { turn: {}, round: {}, game: {} }, lastTurnWasHit: false, lastTurnWasBlocked: false, lastTurnAttacked: false, promotionHistory: [],
      focus: 0, xp: 0, beltIndex: 0, tempo: false, purchases: 0, plays: 0, openingPurchase: false, badHabitFocusUsed: false,
      practiceUsed: false, attackCount: 0, nextAttackPower: 0, nextAttackFlow: false, tempSpeed: 0,
      turnStats: { zones: new Set(), attacked: false, hit: false, blocked: false, damageTaken: 0, hitCount: 0, incomingAttackCount: 0, kataCount: 0, focusGenerated: 0, playedDefenseSinceLastTurn: false, previousAttackHit: false, previousAttackBlocked: false, previousCardType: null, previousZone: null, flowDrawUsed: false, boughtCardThisTurn: false, boughtCardThisAscend: false, usedConsumableThisRound: false, consumableCount: 0, completedBeltExamThisRound: false, playsThisTurn: 0, attacksThisTurn: 0, beltCheckActionUsed: false },
    };
  }

  stageCard(stageIndex) { return this.data.byId.get(this.bossConfig.stageCards[stageIndex]); }

  gainXp(player, amount, source = "effect") {
    if (player?.id === 1) return 0;
    return super.gainXp(player, amount, source);
  }

  chooseProfile(stageIndex) {
    const stageName = this.bossConfig.stageNames[stageIndex];
    const eligible = this.data.cards.filter((card) => card.subtype === "Boss Profile" && (card.tags ?? []).includes(stageName));
    if (!eligible.length) throw new Error(`No canonical Boss Profile is eligible for ${stageName}`);
    const requested = this.bossProfiles?.[stageIndex];
    const chosen = requested ? this.data.byId.get(requested) : this.rng.pick(eligible);
    if (!chosen || chosen.subtype !== "Boss Profile" || !(chosen.tags ?? []).includes(stageName)) throw new Error(`Invalid canonical Boss Profile for ${stageName}`);
    return this.cardInstance(chosen);
  }

  beginBossStage(stageIndex) {
    const stage = this.cardInstance(this.stageCard(stageIndex));
    const profile = this.chooseProfile(stageIndex);
    const boss = this.players[1];
    const stats = stage.stats ?? {};
    const profileStats = profile.stats ?? {};
    boss.character = profile;
    boss.bossStage = stage;
    boss.bossProfile = profile;
    boss.hp = num(stats.HP, stageIndex === 0 ? 30 : stageIndex === 1 ? 45 : 60);
    boss.maxHp = boss.hp;
    boss.atk = num(profileStats.ATK);
    boss.def = num(profileStats.DEF);
    boss.speed = num(profileStats.Speed);
    boss.tempSpeed = 0;
    boss.hand = [];
    boss.played = [];
    boss.statuses = [];
    boss.effectUsage = { turn: {}, round: {}, game: {} };
    this.bossStageIndex = stageIndex;
    this.bossGuard = null;
    this.bossAttackPowerBonus = 0;
    this.bossArsenal = this.rng.shuffle(this.data.cards.filter((card) => card.deck === this.bossConfig.arsenalDeck && BOSS_SUBTYPES.has(card.subtype)).map((card) => this.cardInstance(card)));
    this.bossArsenalDiscard = [];
    this.bossStagePending = false;
    this.bossStats.stages += 1;
    this.telemetry.boss.stages += 1;
    this.emit({ type: "boss-stage-start", stage: stageIndex, stageName: this.bossConfig.stageNames[stageIndex], stageCard: stage.catalogId, profile: profile.catalogId, hp: boss.hp, attackBonus: num(stats["Boss ATK Bonus"]) });
  }

  saveActiveFighter(player) {
    const fighter = player?.roster?.[player.activeCharacterIndex];
    if (!fighter) return;
    fighter.hp = player.hp; fighter.maxHp = player.maxHp; fighter.atk = player.atk; fighter.def = player.def; fighter.speed = player.speed;
    fighter.equipment = player.equipment; fighter.exhaustedEquipment = player.exhaustedEquipment; fighter.statuses = player.statuses;
  }

  syncActiveFighter(player) {
    const fighter = player.roster?.[player.activeCharacterIndex];
    if (!fighter) return;
    player.character = fighter.character; player.hp = fighter.hp; player.maxHp = fighter.maxHp; player.atk = fighter.atk; player.def = fighter.def; player.speed = fighter.speed;
    player.equipment = fighter.equipment; player.exhaustedEquipment = fighter.exhaustedEquipment; player.statuses = fighter.statuses;
  }

  consciousBench(player) { return player.roster?.map((fighter, index) => ({ fighter, index })).filter(({ fighter, index }) => index !== player.activeCharacterIndex && fighter.hp > 0) ?? []; }

  tagTo(player, index) {
    const candidate = player.roster?.[index];
    if (!candidate || candidate.hp <= 0 || index === player.activeCharacterIndex) return false;
    const outgoingEquipment = player.equipment;
    this.saveActiveFighter(player);
    player.played = player.played.filter((card) => !outgoingEquipment.includes(card));
    player.activeCharacterIndex = index;
    this.syncActiveFighter(player);
    for (const card of player.equipment) if (!player.played.includes(card)) player.played.push(card);
    player.taggedThisTurn = true;
    this.emit({ type: "tag", player: player.id, character: candidate.character.catalogId, characterIndex: index });
    return true;
  }

  handlePlayerKnockout(player) {
    if (!player?.roster || player.hp > 0) return false;
    this.saveActiveFighter(player);
    const replacement = this.consciousBench(player)[0];
    if (replacement) {
      this.tagTo(player, replacement.index);
      this.emit({ type: "boss-team-replacement", player: player.id, character: player.character.catalogId, characterIndex: replacement.index });
      return true;
    }
    this.winner = 1;
    this.reason = "all-characters-ko";
    this.status = "complete";
    this.pendingChoice = null;
    this.lastPresentedChoice = null;
    return true;
  }

  get currentBossStageName() { return this.bossConfig.stageNames[this.bossStageIndex]; }
  get currentBossStageStats() { return this.players[1].bossStage?.stats ?? {}; }

  currentBossAttackCount() {
    const base = num(this.currentBossStageStats["Base Attacks / Turn"], 1);
    const threshold = num(this.currentBossStageStats["Enrage Threshold"], this.bossConfig.soloFinalEnrageThreshold);
    const enraged = this.bossStageIndex === 2 && threshold > 0 && this.players[1].hp <= threshold;
    if (enraged) this.telemetry.boss.enrageTurns += 1;
    return enraged ? num(this.currentBossStageStats["Enraged Attacks / Turn"], this.bossConfig.soloFinalEnragedAttackCount) : base;
  }

  oncePerRound(effect) { return !this.hasUsedEffect(this.players[1], effect, "round"); }
  markBossEffect(effect) { this.markUsedEffect(this.players[1], effect); }

  applyBossSpeedPenalty(player, amount, source) {
    const penalty = num(amount);
    if (!penalty) return;
    const restore = player.speed;
    this.addStatus(player, { action: "speedRestore", amount: restore, duration: "nextHonor", sourceId: source?.id ?? `boss:${++this._bossEventSerial}` });
    player.speed += penalty;
  }

  discardFromHand(player, amount = 1) {
    for (let index = 0; index < amount; index += 1) {
      const card = player.hand[0];
      if (!card) return false;
      this.discardCard(player, card);
    }
    return true;
  }

  profileEffects(event) {
    // Boss Profiles are authored with the canonical trigger vocabulary
    // (passive/onInitiate/onAttackDeclared). Runtime events are more specific,
    // so map them here instead of duplicating profile rules in the simulator.
    const triggers = event === "boss-turn-start"
      ? ["onInitiate", "passive"]
      : event === "player-attack-declared"
        ? ["onAttackDeclared", "passive"]
        : ["passive"];
    return triggers.flatMap((trigger) => this.cardEffects(this.players[1].bossProfile, trigger));
  }

  cardEffects(card, trigger) {
    if (this._suppressBossStructuredEffects && card?.cardType === "Boss") return [];
    return super.cardEffects(card, trigger);
  }

  applyBossProfileEvent(event, context = {}) {
    const player = this.players[0];
    const boss = this.players[1];
    for (const effect of this.profileEffects(event)) {
      if (effect.conditions?.some((condition) => condition.kind === "oncePerRound") && !this.oncePerRound(effect)) continue;
      const resolver = effect.resolver;
      if (resolver === "boss.profile.kataDefense" && event === "kata-played") this.addStatus(boss, { action: "modifyDefense", amount: num(effect.amount), duration: effect.duration ?? "nextHonor", sourceId: effect.id });
      else if (resolver === "boss.profile.zoneChangeAttackPenalty" && event === "player-attack-declared" && context.zoneChanged) context.attackPowerModifier = (context.attackPowerModifier ?? 0) + num(effect.amount);
      else if (resolver === "boss.profile.exhaustDiscard" && event === "equipment-exhausted") this.discardFromHand(player, num(effect.amount, 1));
      else if (resolver === "boss.profile.zoneSpeedPenalty" && event === "player-zone-changed") this.applyBossSpeedPenalty(player, num(effect.amount), effect);
      else if (resolver === "boss.profile.equipAttackPenalty" && event === "item-equipped") this.addStatus(player, { action: "modifyAttackPower", amount: num(effect.amount), duration: effect.duration ?? "nextAttack", sourceId: effect.id });
      else if (resolver === "boss.profile.readyEquipmentPower" && event === "equipment-readied") this.bossAttackPowerBonus += num(effect.amount);
      else if (resolver === "boss.profile.blockSpeedPenalty" && event === "boss-attack-blocked") this.applyBossSpeedPenalty(player, num(effect.amount), effect);
      else if (resolver === "boss.profile.consumableHeal" && event === "consumable-played") boss.hp = Math.min(boss.maxHp, boss.hp + num(effect.amount));
      else if (resolver === "boss.profile.blockDefense" && event === "boss-attack-blocked") this.addStatus(boss, { action: "modifyDefense", amount: num(effect.amount), duration: effect.duration ?? "nextHonor", sourceId: effect.id });
      else if (resolver === "boss.profile.startTurnDiscardOrPower" && event === "boss-turn-start") { if (!this.discardFromHand(player, num(effect.amount, 1))) this.bossAttackPowerBonus += num(context.fallbackAttackPower, 1); }
      else continue;
      if (effect.conditions?.some((condition) => condition.kind === "oncePerRound")) this.markBossEffect(effect);
      this.track(boss.bossProfile, "effectApplications", boss);
      this.telemetry.effectApplications += 1;
    }
    return context;
  }

  applyBossTechnique(card) {
    const boss = this.players[1];
    for (const effect of this.cardEffects(card, "onPlay")) {
      const resolver = effect.resolver;
      if (resolver === "boss.technique.conditionalNextAttackPower") {
        const condition = (effect.conditions ?? []).find((candidate) => candidate.kind === "targetHpAtMost");
        const threshold = num(condition?.value, this.bossConfig.soloFinalEnrageThreshold);
        const eligible = condition?.operator === "gt" ? boss.hp > threshold : boss.hp <= threshold;
        if (eligible) this.bossAttackPowerBonus += num(effect.amount) || (boss.hp <= threshold ? 2 : 1);
      } else if (resolver === "boss.technique.heal") boss.hp = Math.min(boss.maxHp, boss.hp + num(effect.amount));
      else if (resolver === "boss.technique.nextAttackPenalty") this.addStatus(this.players[0], { action: "modifyAttackPower", amount: num(effect.amount), duration: effect.duration ?? "nextAttack", sourceId: effect.id });
      else if (resolver === "boss.technique.nextAttackPower") this.bossAttackPowerBonus += num(effect.amount);
      else if (resolver === "boss.technique.nextDefense") this.addStatus(boss, { action: "modifyDefense", amount: num(effect.amount), duration: effect.duration ?? "nextHonor", sourceId: effect.id });
      else if (resolver === "boss.technique.nextSpeed") boss.tempSpeed += num(effect.amount);
      else if (resolver === "boss.technique.revealNextArsenal") { /* the arsenal loop reveals until an Attack */ }
      else { this.unsupportedEffect(card, effect); continue; }
      this.track(card, "effectApplications", boss);
      this.telemetry.effectApplications += 1;
    }
    this.emit({ type: "boss-technique", card: card.catalogId, boss: boss.character.catalogId });
  }

  applyBossAttackEffects(card, trigger, { damage = 0, blocked = false } = {}) {
    const player = this.players[0];
    for (const effect of this.cardEffects(card, trigger)) {
      const resolver = effect.resolver;
      if (resolver === "boss.attack.hitSpeedPenalty") this.applyBossSpeedPenalty(player, num(effect.amount), effect);
      else if (resolver === "boss.attack.hitDiscard") this.discardFromHand(player, num(effect.amount, 1));
      else if (resolver === "boss.attack.hitNextAttackPenalty") this.addStatus(player, { action: "modifyAttackPower", amount: num(effect.amount), duration: effect.duration ?? "nextAttack", sourceId: effect.id });
      else if (resolver === "boss.attack.hitDefensePenalty") this.addStatus(player, { action: "modifyGuard", amount: num(effect.amount), duration: effect.duration ?? "nextDefense", sourceId: effect.id });
      else if (resolver === "boss.attack.hitTempoLock") player.tempo = false;
      else if (resolver === "boss.attack.blockNextPower") this.bossAttackPowerBonus += num(effect.amount);
      else { this.unsupportedEffect(card, effect); continue; }
      this.track(card, "effectApplications", this.players[1]);
      this.telemetry.effectApplications += 1;
    }
  }

  drawBossArsenal() {
    if (!this.bossArsenal.length && this.bossArsenalDiscard.length) this.bossArsenal = this.rng.shuffle(this.bossArsenalDiscard.splice(0));
    const card = this.bossArsenal.pop();
    if (!card) throw new Error(`Boss Arsenal exhausted without a discard pile at seed ${this.seed}`);
    this.bossStats.arsenalRevealed += 1;
    this.telemetry.boss.arsenalRevealed += 1;
    this.emit({ type: "boss-arsenal-reveal", card: card.catalogId, stage: this.bossStageIndex });
    return card;
  }

  revealBossAttack() {
    let attack = null;
    while (!attack) {
      const card = this.drawBossArsenal();
      if (card.subtype === "Boss Technique") this.applyBossTechnique(card);
      else if (card.subtype === "Boss Defense") {
        if (this.bossGuard) this.bossArsenalDiscard.push(this.bossGuard.card);
        this.bossGuard = { card, zone: card.zone, guard: num(card.stats?.Guard) };
        this.emit({ type: "boss-guard-set", card: card.catalogId, zone: card.zone, guard: num(card.stats?.Guard) });
      } else if (card.subtype === "Boss Attack") attack = card;
      else this.unsupportedEffect(card, { id: `boss-card:${card.catalogId}`, resolver: "unknown-boss-arsenal-subtype" });
    }
    return attack;
  }

  resolveBossAttack() {
    const boss = this.players[1];
    const player = this.players[0];
    const card = this.revealBossAttack();
    boss.hand.push(card);
    const stageBonus = num(this.currentBossStageStats["Boss ATK Bonus"]);
    boss.nextAttackPower = stageBonus + this.bossAttackPowerBonus;
    this.bossAttackPowerBonus = 0;
    if (this.interactive) {
      this.pendingBossAttack = { card };
      if (!this.beginAttack(1, card, { zone: card.zone })) throw new Error(`Boss attack could not be presented at seed ${this.seed}`);
      return null;
    }
    const defense = chooseDefense(player.hand);
    const result = this.executeBossAttack(card, defense);
    return this.finalizeBossAttack(card, result, defense);
  }

  executeBossAttack(card, defense) {
    this._suppressBossStructuredEffects = true;
    let result;
    try {
      result = super.resolveAttack(this.players[1], this.players[0], card, { useTempo: false, defenseCard: defense, zone: card.zone });
    } finally {
      this._suppressBossStructuredEffects = false;
    }
    return result;
  }

  finalizeBossAttack(card, result, defense) {
    const boss = this.players[1];
    remove(boss.played, card);
    this.bossArsenalDiscard.push(card);
    const blocked = Boolean(result?.damage === 0 && defense);
    this.bossStats.bossAttacks += 1;
    this.telemetry.boss.bossAttacks += 1;
    if (result?.damage > 0) { this.bossStats.bossHits += 1; this.bossStats.bossDamage += result.damage; this.telemetry.boss.bossHits += 1; this.telemetry.boss.bossDamage += result.damage; this.applyBossAttackEffects(card, "onHit", { damage: result.damage, blocked: false }); }
    if (blocked) { this.bossStats.bossBlocks += 1; this.telemetry.boss.bossBlocks += 1; this.applyBossAttackEffects(card, "onBlock", { damage: 0, blocked: true }); }
    this.applyBossProfileEvent(blocked ? "boss-attack-blocked" : "boss-attack-resolved");
    this.emit({ type: "boss-attack", attacker: boss.id, defender: this.players[0].id, card: card.catalogId, stage: this.bossStageIndex, zone: card.zone, defense: defense?.catalogId ?? null, attack: result?.attack ?? null, block: result?.block ?? null, damage: result?.damage ?? 0, blocked });
    return result;
  }

  resolveBossPendingChoices() {
    while (this.pendingChoice) {
      if (["card-movement", "cycle-discard-draw"].includes(this.pendingChoice.kind)) {
        const currentPending = this.pendingChoice;
        const target = this.players[currentPending.targetPlayerId ?? currentPending.playerId];
        const cards = currentPending.kind === "card-movement"
          ? (currentPending.sourceZones ?? ["hand"]).flatMap((zone) => target?.[zone] ?? [])
          : (target?.hand ?? []);
        const options = currentPending.kind === "cycle-discard-draw"
          ? [{ id: "skip", label: "Skip" }, ...cards.map((card) => ({ id: card.instanceId, label: card.name }))]
          : cards.map((card) => ({ id: card.instanceId, label: card.name }));
        if (options.length) this.pendingChoice.options = options;
        else { this.pendingChoice = null; this.lastPresentedChoice = null; continue; }
      }
      if (this.interactive && this.pendingChoice.playerId === 0) return;
      const pending = this.getPendingChoice();
      if (this.lastPresentedChoice !== this.pendingChoice) {
        this.telemetry.choicesPresented += 1;
        this.lastPresentedChoice = this.pendingChoice;
      }
      const choice = this.currentPolicy?.chooseChoice
        ? this.currentPolicy.chooseChoice(this, pending)
        : this.defaultChoice();
      this.decisions.push({ step: this.decisions.length + 1, kind: "choice", pendingKind: pending.kind, choice: structuredClone(choice), source: "boss-turn" });
      if (!this.resolveChoice(choice)) throw new Error(`Policy selected illegal choice during Boss Turn at seed ${this.seed}`);
      this.assertInvariants(this.decisions.length);
    }
  }

  runBossTurn() {
    if (this.winner !== null || this.bossStagePending) return false;
    this.bossTurnInProgress = true;
    this.bossTurnAttackIndex = 0;
    this.bossTurnAttackCount = this.currentBossAttackCount();
    this.applyBossProfileEvent("boss-turn-start", { fallbackAttackPower: 1 });
    this.continueBossTurn();
    return true;
  }

  continueBossTurn() {
    if (!this.bossTurnInProgress || this.winner !== null || this.bossStagePending) return;
    this.resolveBossPendingChoices();
    if (this.pendingChoice) return;
    while (this.bossTurnAttackIndex < this.bossTurnAttackCount && this.winner === null && this.players[0].hp > 0) {
      this.resolveBossAttack();
      if (this.pendingChoice) return;
      this.resolveBossPendingChoices();
      if (this.pendingChoice) return;
      this.bossTurnAttackIndex += 1;
    }
    this.bossTurnInProgress = false;
    this.completeTurnAfterBoss();
  }

  advanceBossAfterKo() {
    const player = this.players[0];
    this.gainXp(player, num(this.bossConfig.koXp, 5), "boss-ko");
    player.hp = Math.min(player.maxHp, player.hp + num(this.bossConfig.activeCharacterHealAfterKo, 8));
    this.saveActiveFighter(player);
    this.emit({ type: "boss-ko", stage: this.bossStageIndex, stageName: this.currentBossStageName, xp: num(this.bossConfig.koXp, 5), healed: num(this.bossConfig.activeCharacterHealAfterKo, 8) });
    if (this.bossStageIndex >= this.bossConfig.stageNames.length - 1) {
      player.examProgress.koWhileBrown = player.beltIndex >= 7;
      this.checkBeltExam(player);
      if (player.beltIndex === 7 && player.xp >= 35 && this.beltExamComplete(player)) this.promote(player, { ignorePhase: true });
      this.scenarioVictory = true;
      this.winner = 0;
      this.reason = "final-boss-ko";
      this.status = "complete";
      this.pendingChoice = null;
      this.lastPresentedChoice = null;
      this.emit({ type: "boss-victory", player: 0, styleVictory: player.beltIndex >= 8 });
      return;
    }
    this.bossStagePending = true;
    this.bossStageIndex += 1;
    this.bossStats.stageTransitions += 1;
    this.telemetry.boss.stageTransitions += 1;
    this.refillMarket(true);
    this.emit({ type: "boss-ladder-advance", nextStage: this.bossConfig.stageNames[this.bossStageIndex] });
  }

  checkWinner() {
    const player = this.players[0];
    if (player.roster && player.hp <= 0 && this.winner === null) this.handlePlayerKnockout(player);
    if (this.players[1]?.hp <= 0 && !this.bossStagePending && this.winner === null) this.advanceBossAfterKo();
    return this.winner !== null;
  }

  advanceAutomaticEvents() {
    if (this.winner !== null || this.pendingChoice || this.phase !== "Honor") return false;
    if (this.bossStagePending) this.beginBossStage(this.bossStageIndex);
    const player = this.players[0];
    this.sceneChangedThisRound = false;
    this.revealLocation();
    if (player.hp > 0) this.gainXp(player, this.definition.progression.xpPerHonor, "honor");
    player.effectUsage.turn = {}; player.effectUsage.round = {}; player.tempo = true; player.practiceUsed = false; player.attackCount = 0; player.comboTriggeredRound = []; player.honorStats = { attacked: false, blocked: false };
    this.expireStatuses(player, "nextHonor"); this.expireStatuses(this.players[1], "nextHonor"); this.players[1].tempSpeed = 0;
    player.taggedThisTurn = false;
    player.turnStats = { zones: new Set(), attacked: false, hit: false, blocked: false, damageTaken: 0, defenseCount: 0, incomingAttackCount: 0, kataCount: 0, focusGenerated: 0, playedDefenseSinceLastTurn: false, previousAttackHit: false, previousAttackBlocked: false, previousCardType: null, previousAttackTags: [], previousOpponentId: null, previousZone: null, flowDrawUsed: false, boughtCardThisTurn: false, boughtCardThisAscend: false, usedConsumableThisRound: false, consumableCount: 0, completedBeltExamThisRound: false, playsThisTurn: 0, attacksThisTurn: 0, beltCheckActionUsed: false };
    this.turnOrder = [0]; this.turnOrderPosition = 0; this.activePlayer = 0; this.phase = "Initiate";
    this.emit({ type: "honor", players: [{ id: 0, xp: player.xp }, { id: 1, hp: this.players[1].hp }], turnOrder: [0], bossStage: this.bossStageIndex });
    return true;
  }

  finishTurn() {
    this.saveActiveFighter(this.players[0]);
    this.turns += 1;
    this.expireStatuses(this.players[0], "endOfTurn");
    this.players[0].effectUsage.turn = {};
    const bossTurnRan = this.runBossTurn();
    if (this.winner !== null || this.pendingChoice || this.bossTurnInProgress || bossTurnRan) return;
    this.completeTurnAfterBoss();
  }

  completeTurnAfterBoss() {
    if (this.winner !== null) return;
    this.saveActiveFighter(this.players[0]);
    this.round = Math.min(this.round + 1, this.definition.mode.maxRounds);
    this.roundLimitReached = this.round >= this.definition.mode.maxRounds;
    this.players[0].effectUsage.round = {};
    this.players[1].effectUsage.round = {};
    this.expireStatuses(this.players[0], "endOfRound"); this.expireStatuses(this.players[1], "endOfRound");
    if (!this.marketPurchasedThisRound && !this.bossStagePending) this.refillMarket(true);
    this.marketPurchasedThisRound = false;
    if (this.roundLimitReached) { this.winner = 1; this.reason = "round-limit"; this.status = "complete"; return; }
    this.phase = "Honor";
    this.checkWinner();
  }

  playCard(player, card) {
    const result = super.playCard(player, card);
    if (!result || player.id !== 0) return result;
    if (card?.subtype === "Kata") this.applyBossProfileEvent("kata-played");
    if (card && EQUIPMENT_SUBTYPES.has(card.subtype) && card.cardType === "Item") this.applyBossProfileEvent("item-equipped");
    if (card?.subtype === "Consumable") this.applyBossProfileEvent("consumable-played");
    this.saveActiveFighter(player);
    return result;
  }

  setEquipmentReady(player, card, ready) {
    const result = super.setEquipmentReady(player, card, ready);
    if (result && player.id === 0) {
      if (!ready) this.applyBossProfileEvent("equipment-exhausted");
      else if (this.phase !== "Initiate") this.applyBossProfileEvent("equipment-readied");
      this.saveActiveFighter(player);
    }
    return result;
  }

  beginAttack(playerId, card, action = {}) {
    if (this.players[1].bossProfile && action.zone && card?.zone === "Any" && action.zone !== card.zone) action.zoneChanged = true;
    return super.beginAttack(playerId, card, action);
  }

  resolveChoice(choice) {
    const result = super.resolveChoice(choice);
    if (result && this.interactive && this.bossTurnInProgress && !this.pendingChoice && !this.pendingBossAttack && this.winner === null) this.continueBossTurn();
    return result;
  }

  resolveAttack(attacker, defender, card, options = {}) {
    const isInteractiveBossAttack = this.interactive && attacker?.id === 1 && defender?.id === 0 && this.pendingBossAttack?.card?.instanceId === card?.instanceId;
    if (isInteractiveBossAttack) {
      const defense = options.defenseCard ?? null;
      const result = this.executeBossAttack(card, defense);
      this.pendingBossAttack = null;
      this.finalizeBossAttack(card, result, defense);
      if (this.winner === null) {
        this.bossTurnAttackIndex += 1;
        this.continueBossTurn();
      }
      this.saveActiveFighter(this.players[0]);
      return result;
    }
    const isPlayerAgainstBoss = attacker?.id === 0 && defender?.id === 1;
    if (isPlayerAgainstBoss) {
      const changed = card?.zone === "Any" && options.zone && options.zone !== card.zone;
      const profileContext = this.applyBossProfileEvent("player-attack-declared", { zoneChanged: changed });
      options = { ...options, reactionAttackModifier: (options.reactionAttackModifier ?? 0) + num(profileContext.attackPowerModifier) };
      if (changed) this.applyBossProfileEvent("player-zone-changed");
    }
    let bossGuardValue = 0;
    if (isPlayerAgainstBoss && this.bossGuard && this.bossGuard.zone === (options.zone ?? card.zone)) {
      const guardCard = this.bossGuard.card;
      bossGuardValue = this.bossGuard.guard;
      defender.hand.push(guardCard);
      options = { ...options, defenseCard: guardCard };
      this.bossGuard = null;
      this.bossStats.bossGuardUses += 1;
      this.telemetry.boss.guardUses += 1;
    }
    const result = super.resolveAttack(attacker, defender, card, options);
    if (isPlayerAgainstBoss) {
      if (bossGuardValue > 0) {
        this.bossStats.bossDamagePrevented += bossGuardValue;
        this.telemetry.boss.bossDamagePrevented += bossGuardValue;
      }
      if (result?.damage > 0) this.applyBossProfileEvent("player-attack-hit", { damage: result.damage });
      if (this.players[1].hp <= 0 && !this.bossStagePending && this.winner === null) this.advanceBossAfterKo();
    }
    this.saveActiveFighter(this.players[0]);
    return result;
  }

  getLegalActions(playerId = this.activePlayer) {
    const actions = super.getLegalActions(playerId);
    if (this.phase === "Initiate" && playerId === 0 && !this.players[0].taggedThisTurn) {
      return [...actions, ...this.consciousBench(this.players[0]).map(({ index, fighter }) => ({ type: "tag", playerId: 0, characterIndex: index, characterId: fighter.character.catalogId }))];
    }
    return actions;
  }

  applyAction(action) {
    if (action?.type === "tag" && this.phase === "Initiate" && action.playerId === 0 && !this.players[0].taggedThisTurn) return this.tagTo(this.players[0], action.characterIndex);
    return super.applyAction(action);
  }

  defaultAction(legal) {
    const player = this.players[0];
    if (this.phase === "Initiate") {
      const bench = this.consciousBench(player);
      if (player.hp <= Math.floor(player.maxHp / 3) && bench.length) return legal.find((action) => action.type === "tag") ?? legal.find((action) => action.type === "pass");
    }
    if (this.phase === "Yell") {
      const setup = this.comboSetupCard(player); const setupAction = setup && legal.find((action) => action.type === "play-card" && action.cardId === setup.instanceId); if (setupAction) return setupAction;
      const attack = chooseAttack(player.hand, player.strategy); const attackAction = attack && legal.find((action) => action.type === "play-attack" && action.cardId === attack.instanceId); if (attackAction) return attackAction;
      const practice = choosePractice(player.hand, player.strategy); const practiceAction = practice && legal.find((action) => action.type === "practice" && action.cardId === practice.instanceId); if (practiceAction && !player.practiceUsed) return practiceAction;
    }
    if (this.phase === "Ascend") { const purchase = choosePurchase(this.market, player.focus, player.strategy); const purchaseAction = purchase && legal.find((action) => action.type === "purchase" && action.cardId === purchase.instanceId); if (purchaseAction) return purchaseAction; }
    return super.defaultAction(legal);
  }

  checkInvariants() {
    const failures = super.checkInvariants();
    const player = this.players[0]; const boss = this.players[1];
    if (!player.roster || player.roster.length !== 3) failures.push("Boss Blitz player must have three Characters");
    if (player.roster?.filter((fighter) => fighter.hp < 0 || fighter.hp > fighter.maxHp).length) failures.push("Boss Blitz roster contains impossible HP");
    if (!boss.bossStage || !boss.bossProfile) failures.push("Boss Blitz must have an active Stage and Profile");
    if (this.bossGuard && (!this.bossGuard.card || !["High", "Mid", "Low"].includes(this.bossGuard.zone))) failures.push("Boss Guard is malformed");
    if (this.bossArsenal.some((card) => !BOSS_SUBTYPES.has(card.subtype)) || this.bossArsenalDiscard.some((card) => !BOSS_SUBTYPES.has(card.subtype))) failures.push("Boss Arsenal contains a non-Boss card");
    return failures;
  }

  getState() {
    const base = super.getState();
    return { ...base, schemaVersion: 4, mode: this.modeId, boss: { stageIndex: this.bossStageIndex, stageName: this.currentBossStageName, stagePending: this.bossStagePending, profile: this.players[1].bossProfile?.catalogId ?? null, stageCard: this.players[1].bossStage?.catalogId ?? null, hp: this.players[1].hp, maxHp: this.players[1].maxHp, guard: this.bossGuard ? { card: this.bossGuard.card.catalogId, zone: this.bossGuard.zone, guard: this.bossGuard.guard } : null, arsenal: this.bossArsenal.map((card) => card.instanceId), arsenalDiscard: this.bossArsenalDiscard.map((card) => card.instanceId), stats: structuredClone(this.bossStats) }, roster: this.players[0].roster?.map((fighter) => ({ character: fighter.character.catalogId, hp: fighter.hp, maxHp: fighter.maxHp })) };
  }

  result() {
    const result = super.result();
    result.mode = this.modeId;
    result.scenario = { id: this.modeId, stage: this.bossStageIndex, stageName: this.currentBossStageName, profile: this.players[1].bossProfile?.catalogId ?? null, bossStats: structuredClone(this.bossStats), victory: this.scenarioVictory };
    result.players[0].roster = this.players[0].roster?.map((fighter) => ({ character: fighter.character.catalogId, hp: fighter.hp, maxHp: fighter.maxHp }));
    result.players[1].isBoss = true;
    return result;
  }
}

export function createBossBlitzGame(data, config = {}) { return new BossBlitzGame(data, config); }
