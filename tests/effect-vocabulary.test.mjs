import assert from "node:assert/strict";
import test from "node:test";
import { buildCardEffectAggregate, loadCardEffectArchitecture } from "../scripts/card-effect-registry.mjs";

const architecture = await loadCardEffectArchitecture();
const basicJab = architecture.cards.cards.find((card) => card.catalogId === "DDB-STA-CORE-003");
assert.ok(basicJab, "Basic Jab must exist in the canonical catalog");

function family(cards, file = "starters.json", familyName = "Starter") {
  return { file, family: familyName, registry: { cards } };
}

test("canonical effect references hydrate runtime action, target, and single allowed duration", () => {
  const aggregate = buildCardEffectAggregate({
    ...architecture,
    families: [family({
      [basicJab.catalogId]: {
        name: basicJab.name,
        effects: [{ id: "test-draw", effect: "core.draw", trigger: "afterResolve", amount: 1 }],
      },
    })],
  });
  assert.deepEqual(aggregate.cards[basicJab.catalogId].effects[0], {
    id: "test-draw",
    effect: "core.draw",
    trigger: "afterResolve",
    amount: 1,
    action: "draw",
    target: "self",
    duration: "immediate",
  });
});

test("unknown effect aliases are rejected instead of silently creating vocabulary drift", () => {
  assert.throws(() => buildCardEffectAggregate({
    ...architecture,
    families: [family({
      [basicJab.catalogId]: {
        name: basicJab.name,
        effects: [{ id: "bad-alias", effect: "core.drawCard", trigger: "afterResolve", amount: 1 }],
      },
    })],
  }), /Unknown canonical effect 'core\.drawCard'/);
});

test("duplicate Catalog IDs across family sources are rejected", () => {
  const entry = {
    [basicJab.catalogId]: {
      name: basicJab.name,
      effects: [],
    },
  };
  assert.throws(() => buildCardEffectAggregate({
    ...architecture,
    families: [family(entry, "starters.json", "Starter"), family(entry, "other.json", "Starter")],
  }), /authored by both/);
});

test("family membership is validated against canonical card identity", () => {
  assert.throws(() => buildCardEffectAggregate({
    ...architecture,
    families: [family({
      [basicJab.catalogId]: { name: basicJab.name, effects: [] },
    }, "defenses.json", "Defense")],
  }), /belongs to family 'Starter', not 'Defense'/);
});

test("effect-specific trigger constraints are enforced", () => {
  assert.throws(() => buildCardEffectAggregate({
    ...architecture,
    families: [family({
      [basicJab.catalogId]: {
        name: basicJab.name,
        effects: [{ id: "bad-trigger", effect: "combat.piercing", trigger: "onHide", amount: 1 }],
      },
    })],
  }), /does not allow trigger 'onHide'/);
});

test("canonical condition identifiers are enforced for effect-reference authoring", () => {
  assert.throws(() => buildCardEffectAggregate({
    ...architecture,
    families: [family({
      [basicJab.catalogId]: {
        name: basicJab.name,
        effects: [{
          id: "bad-condition",
          effect: "combat.modifyAttackPower",
          trigger: "onAttackDeclared",
          amount: 1,
          conditions: [{ kind: "first_attack_but_spelled_wrong", operator: "eq", value: true }],
        }],
      },
    })],
  }), /unknown canonical condition 'first_attack_but_spelled_wrong'/);
});
