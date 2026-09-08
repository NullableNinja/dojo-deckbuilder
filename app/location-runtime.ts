import { locationUsageScopes, type LocationCommand } from "./location-effect-resolvers.ts";

export type LocationTrackedState = {
  locationUsedEffectsThisTurn?: string[];
  locationUsedEffectsThisRound?: string[];
  locationUsedEffectsThisScene?: string[];
  locationNextRoundSpeed?: number;
  locationStandingAttack?: number;
  locationStandingDefense?: number;
  locationReadiedEquipmentPenalty?: number;
  locationChosenCounterZone?: string | null;
  locationChosenCounterRound?: number | null;
  locationComboNumericChoice?: string | null;
  locationEquipmentExhaustCountThisRound?: number;
  locationKataFlowGrantsThisTurn?: number;
  locationNextAttackFlowFromKata?: boolean;
  locationActiveBeltExam?: boolean;
};

export type LocationRuntimeDelta = {
  attackPower: number;
  damage: number;
  guard: number;
  focus: number;
  draw: number;
  speed: number;
  standingAttack: number;
  standingDefense: number;
  defensiveEquipment: number;
  weaponArmorBonus: number;
  readiedEquipmentBonus: number;
  healing: number;
  healingMinimum: number;
  purchaseCost: number;
  purchaseMinimum: number;
  xpGain: number;
  koXp: number;
  comboNumeric: number;
  damageReduction: number;
  kataFocusSet: number | null;
  keepUnboughtMarketCards: boolean;
  loseFocus: number;
  activeBeltExam: boolean;
  choices: { effectId: string; operation: string; metadata: Record<string, unknown>; duration: string }[];
  commands: LocationCommand[];
};

export function createLocationRuntimeDelta(): LocationRuntimeDelta {
  return {
    attackPower: 0,
    damage: 0,
    guard: 0,
    focus: 0,
    draw: 0,
    speed: 0,
    standingAttack: 0,
    standingDefense: 0,
    defensiveEquipment: 0,
    weaponArmorBonus: 0,
    readiedEquipmentBonus: 0,
    healing: 0,
    healingMinimum: 0,
    purchaseCost: 0,
    purchaseMinimum: 0,
    xpGain: 0,
    koXp: 0,
    comboNumeric: 0,
    damageReduction: 0,
    kataFocusSet: null,
    keepUnboughtMarketCards: false,
    loseFocus: 0,
    activeBeltExam: false,
    choices: [],
    commands: [],
  };
}

export function locationRuntimeDelta(commands: LocationCommand[]) {
  const result = createLocationRuntimeDelta();
  result.commands = commands;
  for (const command of commands) {
    if (command.action === "modifyAttackPower") result.attackPower += command.amount;
    else if (command.action === "dealDamage") result.damage += command.amount;
    else if (command.action === "modifyGuard") result.guard += command.amount;
    else if (command.action === "gainFocus") result.focus += command.amount;
    else if (command.action === "draw") result.draw += Math.max(0, command.amount);
    else if (command.action === "modifySpeed") result.speed += command.amount;
    else if (command.action === "chooseZone") result.choices.push({ effectId: command.effectId, operation: command.operation ?? "chooseZone", metadata: command.metadata, duration: command.duration });

    switch (command.operation) {
      case "modifyWeaponAttackBonus": result.attackPower += command.amount; break;
      case "modifyDefensiveEquipmentContribution": result.defensiveEquipment += command.amount; break;
      case "modifyWeaponArmorPrintedBonus": result.weaponArmorBonus += command.amount; break;
      case "modifyReadiedEquipmentPrintedBonus": result.readiedEquipmentBonus += command.amount; break;
      case "modifyStandingAttack": result.standingAttack += command.amount; break;
      case "modifyStandingDefense": result.standingDefense += command.amount; break;
      case "modifyHealing":
        result.healing += command.amount;
        result.healingMinimum = Math.max(result.healingMinimum, Number(command.metadata.minimumFinalValue ?? 0));
        break;
      case "modifyPurchaseCost":
        result.purchaseCost += command.amount;
        result.purchaseMinimum = Math.max(result.purchaseMinimum, Number(command.metadata.minimumFinalValue ?? 0));
        break;
      case "modifyXpGain": result.xpGain += command.amount; break;
      case "modifyKoXp": result.koXp += command.amount; break;
      case "modifyComboPrintedNumericEffect": result.comboNumeric += command.amount; break;
      case "increaseDamageReduction": result.damageReduction += command.amount; break;
      case "setKataFocusGeneration": result.kataFocusSet = Number(command.metadata.fixedValue ?? 0); break;
      case "keepUnboughtMarketCards": result.keepUnboughtMarketCards = true; break;
      case "loseFocusIfAble": result.loseFocus = Math.max(result.loseFocus, Number(command.metadata.maximumLoss ?? Math.abs(command.amount) ?? 1), 1); break;
      case "stateActiveBeltExam": result.activeBeltExam = true; break;
      case "beltExamSpeedOrCycleChoice":
      case "destroyJunkGainFocusLoseHp":
      case "discardForReadyOrDefenseChoice":
      case "discardJunkDrawGainFocus":
      case "drawThenDiscard":
      case "nextCounterAttackChosenZone":
      case "readyEquipmentOrSpeedChoice":
        result.choices.push({ effectId: command.effectId, operation: command.operation, metadata: command.metadata, duration: command.duration });
        break;
    }
  }
  return result;
}

export function locationUsageContext(state: LocationTrackedState, usedLocationEffectsAcrossPlayersThisRound: readonly string[] = []) {
  return {
    usedLocationEffectsThisTurn: state.locationUsedEffectsThisTurn ?? [],
    usedLocationEffectsThisRound: state.locationUsedEffectsThisRound ?? [],
    usedLocationEffectsThisScene: state.locationUsedEffectsThisScene ?? [],
    usedLocationEffectsAcrossPlayersThisRound,
  };
}

export function markLocationCommandsUsed<T extends LocationTrackedState>(state: T, commands: LocationCommand[]): T {
  if (!commands.length) return state;
  const turn = new Set(state.locationUsedEffectsThisTurn ?? []);
  const round = new Set(state.locationUsedEffectsThisRound ?? []);
  const scene = new Set(state.locationUsedEffectsThisScene ?? []);
  for (const command of commands) {
    for (const scope of locationUsageScopes(command)) {
      if (scope === "turn") turn.add(command.effectId);
      if (scope === "round") round.add(command.effectId);
      if (scope === "scene") scene.add(command.effectId);
    }
  }
  return {
    ...state,
    locationUsedEffectsThisTurn: [...turn],
    locationUsedEffectsThisRound: [...round],
    locationUsedEffectsThisScene: [...scene],
  };
}

export function usedAcrossPlayersAfter(commands: LocationCommand[], current: readonly string[] = []) {
  const next = new Set(current);
  for (const command of commands) if (locationUsageScopes(command).includes("acrossPlayersRound")) next.add(command.effectId);
  return [...next];
}

export function resetLocationTurn<T extends LocationTrackedState>(state: T): T {
  return {
    ...state,
    locationUsedEffectsThisTurn: [],
    locationChosenCounterZone: null,
    locationChosenCounterRound: null,
    locationComboNumericChoice: null,
    locationKataFlowGrantsThisTurn: 0,
    locationNextAttackFlowFromKata: false,
  };
}

export function resetLocationRound<T extends LocationTrackedState>(state: T): T {
  const delayedSpeed = Number(state.locationNextRoundSpeed ?? 0);
  return {
    ...state,
    locationUsedEffectsThisTurn: [],
    locationUsedEffectsThisRound: [],
    locationNextRoundSpeed: 0,
    locationStandingAttack: 0,
    locationStandingDefense: 0,
    locationChosenCounterZone: null,
    locationChosenCounterRound: null,
    locationComboNumericChoice: null,
    locationEquipmentExhaustCountThisRound: 0,
    locationKataFlowGrantsThisTurn: 0,
    locationNextAttackFlowFromKata: false,
    ...(delayedSpeed ? { tempSpeed: Number((state as Record<string, unknown>).tempSpeed ?? 0) + delayedSpeed } : {}),
  };
}

export function resetLocationScene<T extends LocationTrackedState>(state: T): T {
  return {
    ...state,
    locationUsedEffectsThisScene: [],
    locationStandingAttack: 0,
    locationStandingDefense: 0,
    locationActiveBeltExam: false,
  };
}
