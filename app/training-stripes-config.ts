import gameDefinitionJson from "./data/game-definition.json" with { type: "json" };
import type { BeltCheckActionRule } from "./belt-check-actions.ts";
import type { TrainingStripeConfig, TrainingStripeRule } from "./training-stripes.ts";

type BeltDefinition = {
  id: string;
  name: string;
  color: string;
  xp: number;
};

type ProgressionDefinition = {
  belts: BeltDefinition[];
  beltCheckAction: BeltCheckActionRule;
  trainingStripes: TrainingStripeRule;
};

const progression = (gameDefinitionJson as unknown as { progression: ProgressionDefinition }).progression;

export const canonicalBeltCheckActionRule = progression.beltCheckAction;
export const canonicalTrainingStripeRule = progression.trainingStripes;
export const canonicalTrainingStripeConfig: TrainingStripeConfig = {
  rule: canonicalTrainingStripeRule,
  beltThresholds: progression.belts.map((belt) => Number(belt.xp) || 0),
};
export const canonicalTrainingStripeBelts = progression.belts;
