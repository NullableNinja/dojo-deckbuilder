from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def save_json(path, data):
    (ROOT / path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def replace_exact(text, old, new, label):
    count = text.count(old)
    if count < 1:
        raise RuntimeError(f"Missing expected text for {label}: {old[:100]!r}")
    return text.replace(old, new)

# --- Rules manifest / executable definition ---
definition = load_json("app/data/game-definition.json")
definition["rulesRevision"] = "v2.3-r5"
definition["turn"]["handSize"] = 7
definition["economy"]["badHabitFocus"] = {
    "usesPerTurn": 1,
    "catalogId": "DDB-STA-CORE-001",
    "focusGain": 1,
    "discardFromHand": True,
}
save_json("app/data/game-definition.json", definition)

manifest = load_json("public/rules-manifest.json")
manifest["rulesRevision"] = "v2.3-r5"
save_json("public/rules-manifest.json", manifest)

# --- Card catalog: Wild Swing becomes the lone 2-Focus starter ---
catalog = load_json("app/data/cards.json")
wild = next((c for c in catalog["cards"] if c.get("catalogId") == "DDB-STA-CORE-011"), None)
if not wild or wild.get("name") != "Wild Swing":
    raise RuntimeError("Wild Swing starter card was not found")
wild["focusValue"] = 2
save_json("app/data/cards.json", catalog)

# --- Website written rules ---
rules = load_json("app/data/rules.json")n
replacements = {
    "4. Take the fixed Standard Starter Deck. Every player uses the same named 15 cards listed below. Shuffle it and draw five cards.":
        "4. Take the fixed Standard Starter Deck. Every player uses the same named 15 cards listed below. Shuffle it and draw seven cards.",
    "5. Mulligan once if needed. If your opening hand contains no Attack and no Kata, reveal it, shuffle it back, and draw five new cards. The second hand stays, even if it is a small cardboard tragedy.":
        "5. Mulligan once if needed. If your opening hand contains no Attack and no Kata, reveal it, shuffle it back, and draw seven new cards. The second hand stays, even if it is a small cardboard tragedy.",
    "1. Choose the mode and fighter roster. Take the identical 15-card Starter Deck, shuffle, and draw five. In Tag Team and Dojo Drama, choose one fighter to begin active.":
        "1. Choose the mode and fighter roster. Take the identical 15-card Starter Deck, shuffle, and draw seven. In Tag Team and Dojo Drama, choose one fighter to begin active.",
    "Hand: hidden from opponents; hand size is normally five.":
        "Hand: hidden from opponents; hand size is normally seven.",
    "3. Draw your normal new hand of five cards, or six at Blue Belt, shuffling your discard pile only when needed. Then add the cards set aside by Step 1.":
        "3. Draw your normal new hand of seven cards, or eight at Blue Belt, shuffling your discard pile only when needed. Then add the cards set aside by Step 1.",
    "You may not discard an arbitrary card for Focus. Bad Habit generates 0 Focus and has no effect.":
        "You may not discard an arbitrary card for Focus. Once during your Yell each turn, you may discard one Bad Habit from your hand to gain 1 Focus. Bad Habit still has a printed Focus Value of 0.",
    "Bad Habit may be legally played during Yell, but it has no effect and generates 0 Focus. It can still matter when another effect counts, reveals, discards, or destroys Junk.":
        "Bad Habit has no printed effect and a printed Focus Value of 0. Once during your Yell each turn, you may discard one Bad Habit from your hand to gain 1 Focus. This is a special Bad Habit rule, not a general discard-for-Focus action. Bad Habit can still matter when another effect counts, reveals, discards, or destroys Junk.",
    "The number of cards normally drawn during Hide: five, or six at Blue Belt. Retained or set-aside cards can make the resulting hand larger.":
        "The number of cards normally drawn during Hide: seven, or eight at Blue Belt. Retained or set-aside cards can make the resulting hand larger.",
    "Starter-deck baggage with no useful printed effect. Bad Habit is Junk, generates 0 Focus, and may still be counted, discarded, or Destroyed by specific effects.":
        "Starter-deck baggage with no useful printed effect. Bad Habit is Junk with printed Focus Value 0; once during your Yell each turn, you may discard one from hand to gain 1 Focus. It may still be counted, discarded, or Destroyed by specific effects.",
    "Played during Yell for its printed Focus Value; otherwise has no effect.":
        "Bad Habit has printed Focus Value 0; once during your Yell each turn, you may discard one from hand to gain 1 Focus."
}

def walk(value):
    if isinstance(value, dict):
        return {k: walk(v) for k, v in value.items()}
    if isinstance(value, list):
        return [walk(v) for v in value]
    if isinstance(value, str):
        return replacements.get(value, value)
    return value

before = json.dumps(rules, ensure_ascii=False)
rules = walk(rules)
after = json.dumps(rules, ensure_ascii=False)
for old in replacements:
    if old in before and old in after:
        raise RuntimeError(f"Rules replacement failed: {old[:90]}")
save_json("app/data/rules.json", rules)

# --- Website Quick Duel engine ---
play_path = ROOT / "app/playtest.tsx"
play = play_path.read_text(encoding="utf-8")
play = replace_exact(play, "  defensePracticeUsed: boolean;\n", "  defensePracticeUsed: boolean;\n  badHabitFocusUsed: boolean;\n", "Board badHabitFocusUsed")
play = replace_exact(play, "  schema: 7;\n", "  schema: 8;\n", "match schema type")
play = replace_exact(play,
    "  economy: { defensePractice: { usesPerTurn: number }; market: { rowSize: number; refill: string; stagnationRefresh: string } };\n",
    "  economy: { defensePractice: { usesPerTurn: number }; badHabitFocus: { usesPerTurn: number; catalogId: string; focusGain: number; discardFromHand: boolean }; market: { rowSize: number; refill: string; stagnationRefresh: string } };\n",
    "game definition economy typing")
play = replace_exact(play,
    "nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false",
    "nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false",
    "empty board habit flag")
play = replace_exact(play,
    "defensePracticeUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, readyBoard.belt >= 5 ? 6 : 5);",
    "defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false, nextAttackHasFlow: false, flowAfterFirstAttack: false, hitThisTurn: false, cardsThisTurn: [], nextAttackBonus: 0, borrowedEquipmentId: null, wasHitSinceLastTurn: false, comboAttemptedTurn: false }, gameDefinition.turn.handSize + (readyBoard.belt >= 5 ? 1 : 0));",
    "Hide draw size and habit reset")
play = play.replace("nextDefenseCardBonus: 0, defensePracticeUsed: false, flowUsedThisTurn: false", "nextDefenseCardBonus: 0, defensePracticeUsed: false, badHabitFocusUsed: false, flowUsedThisTurn: false")

practice_marker = "  const practiceDefense = (id: string) => setMatch((current) => {\n"
habit_fn = '''  const discardBadHabitForFocus = (id: string) => setMatch((current) => {\n    if (!current || current.phase !== "player-yell" || current.winner || current.player.badHabitFocusUsed || current.pendingDiscard || current.pendingChoice || gameDefinition.economy.badHabitFocus.usesPerTurn < 1) return current;\n    const card = cardFor(id);\n    if (!card || card.catalogId !== gameDefinition.economy.badHabitFocus.catalogId || !current.player.hand.includes(id)) return current;\n    const gain = gameDefinition.economy.badHabitFocus.focusGain;\n    const nextPlayer = {\n      ...current.player,\n      hand: removeOne(current.player.hand, id),\n      discard: [...current.player.discard, id],\n      focus: current.player.focus + gain,\n      badHabitFocusUsed: true,\n      lastAttackHit: false,\n    };\n    return write(current, `${card.name} discarded under the once-per-turn Bad Habit rule: +${gain} Focus.`, { player: nextPlayer });\n  });\n\n'''
play = replace_exact(play, practice_marker, habit_fn + practice_marker, "Bad Habit player action")

ai_old = '''  } : aiStart;\n  const supportIds = nextAi.hand.filter((id) => {\n    const card = cardFor(id);\n    return Boolean(card && !isAttack(card) && !isDefense(card) && card.subtype !== "Junk" && !(fighter?.name === "Knuckleton the Brawler" && isWeapon(card)));\n  });\n  if (!supportIds.length && !practiceId && !turnEquipment.notes.length) return current;\n'''
ai_new = '''  } : aiStart;\n  const badHabitId = !nextAi.badHabitFocusUsed && gameDefinition.economy.badHabitFocus.usesPerTurn > 0\n    ? nextAi.hand.find((id) => cardFor(id)?.catalogId === gameDefinition.economy.badHabitFocus.catalogId)\n    : undefined;\n  if (badHabitId) {\n    nextAi = {\n      ...nextAi,\n      hand: removeOne(nextAi.hand, badHabitId),\n      discard: [...nextAi.discard, badHabitId],\n      focus: nextAi.focus + gameDefinition.economy.badHabitFocus.focusGain,\n      badHabitFocusUsed: true,\n    };\n  }\n  const supportIds = nextAi.hand.filter((id) => {\n    const card = cardFor(id);\n    return Boolean(card && !isAttack(card) && !isDefense(card) && card.subtype !== "Junk" && !(fighter?.name === "Knuckleton the Brawler" && isWeapon(card)));\n  });\n  if (!supportIds.length && !practiceId && !badHabitId && !turnEquipment.notes.length) return current;\n'''
play = replace_exact(play, ai_old, ai_new, "AI Bad Habit action")
play = replace_exact(play,
    "    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),\n    ...played,\n",
    "    ...(practiceId ? [`Defense Practice with ${cardFor(practiceId)?.name}`] : []),\n    ...(badHabitId ? [`Bad Habit discarded for +${gameDefinition.economy.badHabitFocus.focusGain} Focus`] : []),\n    ...played,\n",
    "AI habit preparation log")

play = replace_exact(play,
    '      ? (pendingAttack ? `You selected ${pendingAttack.name}. Confirm its zone, then declare the Attack.` : !player.defensePracticeUsed && player.hand.some((id) => isDefense(cardFor(id)!)) ? "Use one Defense for Defense Practice to gain its printed Focus without playing its Guard or rules text." : player.hand.some((id) => isAttack(cardFor(id)!)) ? "Play support cards for Focus or select any legal Attack remaining in your hand." : "Your useful cards are spent. Move to Ascend and turn that Focus into a better deck.")',
    '      ? (pendingAttack ? `You selected ${pendingAttack.name}. Confirm its zone, then declare the Attack.` : !player.badHabitFocusUsed && player.hand.some((id) => cardFor(id)?.catalogId === gameDefinition.economy.badHabitFocus.catalogId) ? "Discard one Bad Habit this turn for +1 Focus. It goes straight to your discard pile." : !player.defensePracticeUsed && player.hand.some((id) => isDefense(cardFor(id)!)) ? "Use one Defense for Defense Practice to gain its printed Focus without playing its Guard or rules text." : player.hand.some((id) => isAttack(cardFor(id)!)) ? "Play support cards for Focus or select any legal Attack remaining in your hand." : "Your useful cards are spent. Move to Ascend and turn that Focus into a better deck.")',
    "turn coach habit hint")
play = replace_exact(play,
    '<span>Practice {player.defensePracticeUsed ? "used" : "ready"}</span></div></header>',
    '<span>Practice {player.defensePracticeUsed ? "used" : "ready"}</span><span>Habit {player.badHabitFocusUsed ? "used" : "ready"}</span></div></header>',
    "hand habit counter")
play = replace_exact(play,
    '          const attack = isAttack(card); const defense = isDefense(card); const permanent = isPermanent(card);\n',
    '          const attack = isAttack(card); const defense = isDefense(card); const permanent = isPermanent(card); const badHabit = card.catalogId === gameDefinition.economy.badHabitFocus.catalogId;\n',
    "hand card habit marker")
play = replace_exact(play,
    ': match.phase === "player-initiate" ? () => equipPermanent(id) : attack ? () => chooseAttack(card) : defense ? () => practiceDefense(id) : () => playSupport(id)} onInspect={() => setInspectedId(id)} />;',
    ': match.phase === "player-initiate" ? () => equipPermanent(id) : badHabit && !player.badHabitFocusUsed ? () => discardBadHabitForFocus(id) : attack ? () => chooseAttack(card) : defense ? () => practiceDefense(id) : () => playSupport(id)} onInspect={() => setInspectedId(id)} />;',
    "hand click routing for habit")
play = replace_exact(play, "setMatch({ schema: 7, rulesVersion:", "setMatch({ schema: 8, rulesVersion:", "new match schema")

play_path.write_text(play, encoding="utf-8")

# --- Deterministic simulator: same once-per-turn Bad Habit economy ---
core_path = ROOT / "engine/core.mjs"
core = core_path.read_text(encoding="utf-8")
core = replace_exact(core,
    'openingPurchase:false};',
    'openingPurchase:false,badHabitFocusUsed:false};',
    "sim player habit flag")
practice_method = '  practice(p,card){if(this.data.definition.economy.defensePractice.usesPerTurn<1||!card||guard(card)<=0||!p.hand.includes(card))return false;remove(p.hand,card);p.played.push(card);p.focus+=focus(card);this.track(card,"played",p);this.events.push({round:this.round,type:"defense-practice",player:p.id,card:card.catalogId,focus:focus(card)});return true;}\n'
habit_method = '  cashBadHabit(p){const rule=this.data.definition.economy.badHabitFocus;if(!rule||rule.usesPerTurn<1||p.badHabitFocusUsed)return false;const card=p.hand.find(c=>c?.catalogId===rule.catalogId);if(!card)return false;remove(p.hand,card);p.discard.push(card);p.focus+=Number(rule.focusGain)||0;p.badHabitFocusUsed=true;this.events.push({round:this.round,type:"bad-habit-focus",player:p.id,card:card.catalogId,focus:Number(rule.focusGain)||0});return true;}\n'
core = replace_exact(core, practice_method, practice_method + habit_method, "sim Bad Habit method")
core = replace_exact(core,
    'p.tempo=true;this.practice(p,choosePractice(p.hand,p.strategy));let attackNumber=0;',
    'p.tempo=true;this.practice(p,choosePractice(p.hand,p.strategy));this.cashBadHabit(p);let attackNumber=0;',
    "sim bot uses Bad Habit")
core = replace_exact(core,
    'hide(p){p.discard.push(...p.hand,...p.played);p.hand=[];p.played=[];p.focus=0;this.draw(p,this.data.definition.turn.handSize);}',
    'hide(p){p.discard.push(...p.hand,...p.played);p.hand=[];p.played=[];p.focus=0;p.badHabitFocusUsed=false;this.draw(p,this.data.definition.turn.handSize+(p.xp>=28?1:0));}',
    "sim hide seven/eight hand")
core_path.write_text(core, encoding="utf-8")

# --- Focused regression test ---
test = '''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { loadGameData } from "../engine/rules-loader.mjs";\nimport { Game } from "../engine/core.mjs";\n\ntest("v2.3-r5 starter economy uses seven-card hands, one Bad Habit cash-in, and 2-Focus Wild Swing", async () => {\n  const data = await loadGameData();\n  assert.equal(data.definition.rulesRevision, "v2.3-r5");\n  assert.equal(data.definition.turn.handSize, 7);\n  assert.equal(data.definition.economy.badHabitFocus.usesPerTurn, 1);\n  assert.equal(data.definition.economy.badHabitFocus.focusGain, 1);\n  assert.equal(data.byId.get("DDB-STA-CORE-011").focusValue, 2);\n  const game = new Game(data, { seed: 7 });\n  const p = game.players[0];\n  assert.equal(p.hand.length, 7);\n  const badHabit = data.byId.get("DDB-STA-CORE-001");\n  p.hand = [badHabit, badHabit, ...p.hand.filter(c => c.catalogId !== badHabit.catalogId).slice(0, 5)];\n  p.focus = 0;\n  assert.equal(game.cashBadHabit(p), true);\n  assert.equal(p.focus, 1);\n  assert.equal(p.badHabitFocusUsed, true);\n  assert.equal(p.hand.filter(c => c.catalogId === badHabit.catalogId).length, 1);\n  assert.equal(game.cashBadHabit(p), false);\n  assert.equal(p.focus, 1);\n  game.hide(p);\n  assert.equal(p.badHabitFocusUsed, false);\n  assert.equal(p.hand.length, 7);\n});\n'''
(ROOT / "tests/economy-bootstrap-r5.test.mjs").write_text(test, encoding="utf-8")

# Update stale revision expectations where they are explicit.
for rel in ["tests/content-integrity.test.mjs", "tests/playtest-regression-guardrails.test.mjs", "tests/quick-duel-fixed-hp.test.mjs"]:
    path = ROOT / rel
    if path.exists():
        text = path.read_text(encoding="utf-8").replace("v2.3-r4", "v2.3-r5")
        path.write_text(text, encoding="utf-8")

(ROOT / "scripts/deploy_patch_message.txt").write_text("Adopt seven-card starter economy and Bad Habit Focus rule\n", encoding="utf-8")
