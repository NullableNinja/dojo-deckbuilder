// Policies only select from actions and choices exposed by the headless engine.
// They do not mutate GameState or implement game rules.
export const baselinePolicy = {
  chooseAction(game, legalActions) { return game.defaultAction(legalActions); },
  chooseChoice(game) { return game.defaultChoice(); },
};

export const randomLegalPolicy = {
  chooseAction(game, legalActions) { return legalActions[Math.floor(game.rng.next() * legalActions.length)]; },
  chooseChoice(game, pendingChoice) { return pendingChoice.options[Math.floor(game.rng.next() * pendingChoice.options.length)]; },
};
