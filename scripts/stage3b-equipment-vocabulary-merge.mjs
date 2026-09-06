import { readFile, writeFile } from "node:fs/promises";

const path = "content/effects.json";
const vocabulary = JSON.parse(await readFile(path, "utf8"));

const ensureTrigger = (effectId, trigger) => {
  const definition = vocabulary.effects?.[effectId];
  if (!definition) throw new Error(`Missing canonical effect ${effectId}`);
  definition.allowedTriggers = [...new Set([...(definition.allowedTriggers ?? []), trigger])];
};

ensureTrigger("equipment.ready", "onEquip");
ensureTrigger("core.draw", "onEquip");
ensureTrigger("core.discard", "onEquip");
ensureTrigger("combat.piercing", "onBlock");
ensureTrigger("equipment.exhaust", "onPurchase");

const reusableConditions = {
  oncePerRound: "The effect may successfully resolve no more than once during the current round.",
  oncePerGame: "The effect may successfully resolve no more than once during the current game.",
  minimumBelt: "Metadata condition carrying the minimum Belt rank required for the effect to resolve.",
  equippedThisTurn: "The source Equipment entered the equipped area during the controller's current turn.",
  equippedCardIsSource: "The Equipment currently entering play is the source Equipment itself.",
  equippedCardIsOtherPermanentEquipment: "The Equipment currently entering play is a different permanent Equipment controlled by the source's controller.",
  equippedCardSubtypeIn: "Metadata condition listing Equipment subtypes that qualify for the current equip trigger.",
  sourceActivationArmed: "A prior activation of this source created the pending conditional effect being checked.",
  manualActivation: "The effect resolves only after its controller explicitly activates the ready source Equipment at a legal timing window.",
  attackUsesSourceEquipment: "The current Attack is using or receiving the eligible contribution of the source Weapon/Equipment.",
  attackZones: "Metadata condition listing declared Attack zones to which an offensive Equipment effect applies.",
  attackHasTag: "Metadata condition naming a required tag on the current Attack.",
  attackHasAnyTag: "Metadata condition listing tags of which at least one must be present on the current Attack.",
  nextAttackHasTag: "Metadata condition naming a required tag on the next Attack that consumes the pending effect.",
  defenseHasTag: "Metadata condition naming a required tag on the Defense that created the trigger.",
  hasTwoPairedWeapons: "The controller currently has at least two equipped Weapons with the Paired tag.",
  firstHitThisTurn: "The current Hit is the controller's first Hit this turn.",
  firstHitWithSourceThisTurn: "The current Hit is the first Hit this turn made using the source Equipment.",
  firstHitWithSourceThisRound: "The current Hit is the first Hit this round made using the source Equipment.",
  firstQualifyingHitThisTurn: "The current Hit is the first Hit this turn satisfying the effect's other qualifying conditions.",
  firstCombatDamageWithSourceThisTurn: "The current event is the first time this turn the source Equipment contributed to combat damage dealt.",
  combatDamageDealt: "Exact combat damage dealt by the current Attack after prevention and reduction.",
  firstDifferentZoneSequenceThisTurn: "This is the first time this turn the controller has produced the qualifying different-zone Attack sequence.",
  targetXpHigher: "The targeted opposing fighter/player currently has strictly more XP than the controller.",
  selfIsLowestXp: "The controller is currently tied for or solely has the lowest XP among the compared legal players.",
  targetHasTemporaryNegativeStat: "The target currently has at least one temporary negative ATK, DEF, or Speed modifier.",
  firstAttackAfterKataThisTurn: "The current Attack is the controller's first Attack after playing a Kata this turn.",
  firstAttackWithTagThisTurn: "Metadata condition naming a tag for which the current Attack is the first matching Attack this turn.",
  firstDefenseThisRound: "The current Defense is the controller's first Defense this round.",
  attackedThisTurn: "The controller has already made at least one Attack during the current turn.",
  firstIncomingAttackThisRound: "The current incoming Attack is the first Attack targeting this controller during the round.",
  incomingAttackUsesWeapon: "The current incoming Attack qualifies as a Weapon Attack under the canonical Weapon rules.",
  incomingAttackIsUnarmed: "The current incoming Attack qualifies as Unarmed under the canonical rules.",
  incomingAttackTargetsSelf: "The current incoming Attack legally targets the source Equipment's controller.",
  sameOpponentAsBlockedAttack: "The pending effect applies only against the opponent whose Attack created the Block trigger.",
  didNotAttackPreviousTurn: "The controller made no Attack during their immediately previous turn.",
  hasNotAttackedThisTurn: "The controller has not yet made an Attack during the current turn.",
  sceneChangeOccurred: "A Scene Change has just resolved at the relevant trigger window.",
  nextPurchaseOnly: "The cost modifier is consumed by the next qualifying purchase and does not modify later purchases.",
  nextItemOnly: "The pending modifier is consumed by the next qualifying Item and does not affect later Items.",
  marketEndSlot: "The chosen Market card occupies either end slot of the current Market row.",
  minimumFinalCost: "Metadata condition carrying the minimum final Focus cost after the modifier is applied.",
  scheduledTiming: "Metadata condition naming a delayed expiration or resolution timing handled by the dedicated resolver.",
  resolvedCardType: "Metadata condition naming the card type whose completed resolution created the trigger.",
  examRequirementCompleted: "A legal requirement of the controller's active Belt Exam was just completed.",
  ascendCompleted: "The controller's Ascend phase has just completed.",
  boughtCardThisAscend: "The controller bought at least one card during the current Ascend phase.",
  purchaseCompleted: "A legal Market purchase has just completed.",
  purchasedCardCost: "Printed Focus cost of the card involved in the current purchase event.",
  pendingFromSource: "A prior effect from this source scheduled the current Initiate reward.",
  forcedDiscardEvent: "An opponent-controlled effect is currently forcing the controller to discard one or more cards.",
  defenseOutsideTurn: "The current Defense is being played outside the controller's own turn.",
  armedEquipmentZoneMatched: "The current Attack uses the zone previously chosen by this source Equipment's armed effect.",
  discardedPrintedFocusValue: "Printed Focus Value of the card paid/discarded for the current Equipment effect.",
  costPaid: "The optional cost required by the effect was successfully paid.",
  xpFromLegalAttackOrDefense: "The XP gain that created the trigger came from a legal Attack or Defense resolution.",
  focusGeneratedBySingleCard: "Amount of Focus generated by the single card that created the trigger.",
  firstNegativeCombatModifierThisRound: "The current negative Attack Power or Guard modifier is the first qualifying one affecting the controller this round.",
  sourceArmorHelpedBlock: "The source Armor/Defense Equipment contributed Defense to an Attack that was Blocked.",
  firstArmorBlockThisRound: "The current Block is the first qualifying Block this round in which the source Armor contributed.",
  sourceAffectedCountThreshold: "Metadata condition carrying the number of qualifying affected events after which the source is destroyed or otherwise changes state.",
  firstDamageThisRound: "The current damage event is the first damage the controller has taken this round.",
  firstCombatDamageThisRound: "The current event is the first combat-damage event the controller has taken this round.",
  incomingDamageAtLeast: "Metadata threshold for the unreduced incoming damage amount relevant to the effect.",
  sourceExhausted: "The source Equipment is currently exhausted.",
  targetHpAtMost: "Metadata threshold requiring the affected fighter's current HP to be at or below the stated value.",
  firstSwapThisGame: "The current Equipment swap is the first swap of this source during the game.",
  discardedByEffect: "The source card is being discarded by a card/effect rather than normal Hide cleanup.",
  firstDamagingAttackThisRound: "The current incoming Attack is the first Attack this round that deals positive damage to the controller.",
  damageSourceIsWeapon: "The current damage event was caused by a Weapon Attack/effect as defined by the canonical rules.",
  minimumDraw: "Metadata floor for the number of cards drawn during the affected Hide draw.",
  currentAttackIsNormal: "The current Attack is a normal Attack rather than a Reversal or other special Attack timing.",
  nextAttackDifferentZone: "The next Attack consuming the pending effect must use a different zone from the Attack that created it.",
  nextQualifyingAttackOnly: "The pending effect is consumed by the next Attack satisfying its other source/qualifier conditions.",
  reactionPlayedAgainstSelf: "A Reaction was just played against the source Equipment's controller.",
  sameTurnOnly: "The pending effect expires at the end of the current turn if it has not been consumed.",
  sameRoundOnly: "The pending effect expires at the end of the current round if it has not been consumed.",
  consumableUsedThisRound: "The controller has resolved at least one Consumable during the current round; used by persistent round-scoped Equipment bonuses created by that use."
};

for (const [id, description] of Object.entries(reusableConditions)) {
  vocabulary.conditions[id] ??= description;
}

await writeFile(path, `${JSON.stringify(vocabulary, null, 2)}\n`, "utf8");
