from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CARDS_PATH = ROOT / "app" / "data" / "cards.json"
RULES_PATH = ROOT / "app" / "data" / "rules.json"


DECK_BY_SHEET = {
    "Starter Pool": "Starter Deck",
    "Techniques - Attack": "Technique Deck",
    "Techniques - Defense": "Technique Deck",
    "Techniques - Kata": "Technique Deck",
    "Items - Consumable": "Item Deck",
    "Items - Weapons": "Item Deck",
    "Items - Defense": "Item Deck",
    "Characters": "Character Deck",
    "Combos": "Combo Deck",
    "Locations": "Location Deck",
    "Boss Stages": "Boss Materials",
    "Boss Techniques": "Boss Technique Deck",
}


CORE_NAMES = {
    "Basic Jab", "Basic Body Kick", "Basic Shin Kick", "Wild Swing", "High Guard",
    "Center Guard", "Low Guard", "Cover Up", "Breathing Drill", "Footwork Drill",
    "Bad Habit", "Front Jab", "Rear Hand Punch", "Double Punch", "Water Bottle",
    "Painkiller", "Bo Staff (Long Staff)", "Bokken (Wooden Sword)", "Sparring Headgear",
    "Chest Protector", "Forearm Guards", "One-Two-Oh-No", "Lowered Expectations",
    "Traditional Dojo", "Tournament Mat", "Rival", "Mini-Boss", "Final Boss",
}

MASTERS_HINTS = {
    "Herbal Tea", "Swan Song", "Daniel Sun", "Miyagi-San", "Sensei Do’Mura",
    "Dano 'The Sage' Santo", "Master Jhoon 'Legacy' Ray", "The Dragon Li",
    "Master 'Yip-Yap' Man", "Khung Ree", "Jet Quick", "Chon-Li",
    "Staff of Master Shifu", "Bruce Lee's Nunchaku", "Dragon Sword",
    "Miyagi-Do Karate Stick", "Astral Training Plane", "Meditation Garden",
    "Moonlit Bamboo Grove", "Haunted Dojo",
}

BACK_ALLEY_HINTS = {
    "Baseball Bat", "Brass Knuckles", "Broken Bottle", "Club", "Hand Axe",
    "Pocket Stick", "Butterfly Knife (Balisong)", "Parking Lot Behind the Dojo",
    "Rain-Slick Alley", "Back Alley", "Underground Fight Club", "Dumpster Behind the Dojo",
    "Gas Station at 2 A.M.", "Concrete Stairwell", "Subway Platform", "Construction Site",
    "Warehouse After Hours", "Parking Garage Spiral", "Old Train Yard",
}

NONSENSE_HINTS = {
    "Mr. Bobby", "Wavey Davey", "J.C. BowFlex", "Sensei Ducktape", "El Pollo Rojo",
    "Some Guy Named Steve", "Grandma Uppercut", "Monk Broski Dude", "Sir Kixalot",
    "Munch-Fu Master", "Maximum Overdojo", "Rubber Chicken", "Bubble Wrap", "Banana Peel",
    "Air Horn", "Confetti Cannon", "Emergency Burrito", "Tactical Baguette", "Dojo Mop",
    "Folding Chair of Destiny", "Frozen Burrito", "Pool Noodle of Shame",
    "Giant Foam Finger", "Emotional Support Brick", "Grandma's Wooden Spoon",
    "Kids' Birthday Party", "Elevator of Poor Decisions", "Mall Food Court",
    "Family Pizza Arcade", "Kata of the Lost Car Keys", "Emotional Support Headbutt",
}


def release_set(card: dict) -> str:
    name = card["name"]
    if card["sourceSheet"] in {"Starter Pool", "Boss Stages", "Boss Techniques"} or name in CORE_NAMES:
        return "Core Game"
    if name in NONSENSE_HINTS:
        return "Expansion: Maximum Nonsense"
    if name in BACK_ALLEY_HINTS:
        return "Expansion: Back Alley Brawl"
    if name in MASTERS_HINTS:
        return "Expansion: Masters & Mystics"

    haystack = " ".join(
        str(value) for value in [
            name, card.get("category"), card.get("rulesText"), card.get("flavorText"),
            *card.get("tags", []), *card.get("buildPaths", []),
        ] if value
    ).casefold()
    if any(word in haystack for word in ("street", "improvised", "alley", "parking", "traffic", "warehouse")):
        return "Expansion: Back Alley Brawl"
    if any(word in haystack for word in ("astral", "mystic", "serenity", "spirit", "meditation", "ancient")):
        return "Expansion: Masters & Mystics"
    if any(word in haystack for word in ("emotional", "emergency", "questionable", "cardboard", "foam", "burrito", "snack")):
        return "Expansion: Maximum Nonsense"
    return "Core Game"


def upgrade_cards() -> None:
    data = json.loads(CARDS_PATH.read_text(encoding="utf-8"))
    for card in data["cards"]:
        card["rulesVersion"] = "v1.5"
        card["deck"] = DECK_BY_SHEET.get(card["sourceSheet"], card["sourceSheet"])
        card["expansion"] = release_set(card)
        card["details"]["Release Set"] = card["expansion"]
        card["searchText"] = f"{card['searchText']} {card['deck']} {card['expansion']}".casefold()
        if card["name"] == "Wavey Davey":
            card["details"]["White Ability Text"] = (
                "If you were Hit by an Attack since your last turn, your first Attack this turn deals +1 damage."
            )
            card["details"]["Green Ability Text"] = (
                "The first time you are Hit each round, draw 1 card then discard 1 card after the Attack resolves."
            )
            card["rulesText"] = card["details"]["White Ability Text"]

    data["version"] = "v1.5"
    data["expansions"] = [
        "Core Game",
        "Expansion: Masters & Mystics",
        "Expansion: Back Alley Brawl",
        "Expansion: Maximum Nonsense",
    ]
    data["decks"] = sorted({card["deck"] for card in data["cards"]})
    data["counts"] = dict(sorted(Counter(card["cardType"] for card in data["cards"]).items()))
    CARDS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


HOUSE_RULES = [
    {
        "name": "Steal the Belt",
        "category": "Promotion",
        "summary": "KO a peer and skip the task—not the XP.",
        "rule": "When you KO an opposing non-Boss fighter at your Belt or higher, mark your current promotion task complete. You still need the required XP and must promote normally during Ascend.",
        "notes": "Bosses and teammate KOs do not qualify. This accelerates task completion without bypassing the XP race.",
    },
    {
        "name": "Chi Bank",
        "category": "Economy",
        "summary": "Convert carefully saved Chi into next-turn FP.",
        "rule": "During Hide, you may spend 2 current Chi to place 1 Banked FP token beside your play area. During your next Initiate, gain that FP. Maximum 1 token; discard it if unused by that turn’s Hide.",
        "notes": "The cap prevents defensive Chi hoarding from becoming an unlimited purchase engine.",
    },
    {
        "name": "Secret Kata Night",
        "category": "Market Chaos",
        "summary": "Buy the cost; discover the Kata afterward.",
        "rule": "When a Kata enters the Technique row, cover its name, rules text, tags, and Focus Value while leaving its FP cost visible. Reveal it only after a player buys it. Non-Kata Techniques remain face up.",
        "notes": "Use sleeves or blank cards as covers so no card is marked or damaged.",
    },
    {
        "name": "Crowd Favorite",
        "category": "Catch-Up",
        "summary": "The trailing fighter gets one dramatic boost per round.",
        "rule": "At the start of Honor, the player or team with the lowest XP takes the Crowd token. Once that round, after their active fighter is Hit, they may discard the token to gain 1 Chi and draw 1 card, then discard 1 card. Tied lowest players receive no token.",
        "notes": "Replaces Belt Tax. It helps a clear trailing player without punishing success or creating permanent resources.",
    },
    {
        "name": "Training Montage",
        "category": "Deck Control",
        "summary": "Lose one action phase to clean up your act.",
        "rule": "Once per game, at the start of your Yell Phase, you may declare a Training Montage. Skip the rest of that Yell Phase, heal your active fighter 4 HP, and Destroy one Junk card from your hand or discard pile.",
        "notes": "Replaces Tap Out. The cost is immediate, the healing is bounded, and the player never becomes an illegal target.",
    },
    {
        "name": "Friendly Fire",
        "category": "Team Chaos",
        "summary": "Teammates may attack each other—without farming rewards.",
        "rule": "In team play, active fighters may target allied active fighters. The first allied Attack each round resolves normally but grants no XP, promotion-task credit, KO reward, Tempo, or learned Combo trigger to either teammate.",
        "notes": "One allied Attack per round keeps the joke tactical instead of becoming an XP or Combo engine.",
    },
    {
        "name": "Market Mercy",
        "category": "Market",
        "summary": "Unbought cards linger until the table truly stalls.",
        "rule": "Do not discard unpurchased Market cards at end of round. Refill purchased spaces normally. If a complete round ends with no Market purchase, discard and refill all seven Market slots.",
        "notes": "The forced refresh prevents an unwanted Market from freezing the game indefinitely.",
    },
    {
        "name": "Fast Belts",
        "category": "Short Game",
        "summary": "Later promotions arrive three XP sooner.",
        "rule": "Use the normal Yellow Belt threshold. Reduce every later Belt’s XP threshold by 3, to a minimum of 1 XP above the previous Belt. Promotion tasks and the one-promotion-per-turn limit remain unchanged.",
        "notes": "Best for demos and weeknight games; it intentionally makes Black Belt Victory more likely.",
    },
    {
        "name": "Mystery Scroll",
        "category": "Combo Chaos",
        "summary": "Pay three FP and learn from the top of the deck.",
        "rule": "During Ascend, instead of buying a face-up Combo, pay 3 FP to draw the top Combo Deck card. You must learn it if legal. If you already know two Combos, forget one first. This counts as your one Combo purchase that turn.",
        "notes": "The purchase limit and forced replacement stop blind draws from bypassing the learned-Combo cap.",
    },
]


GLOSSARY = [
    ("Aftermath Combo", "A learned Combo triggered after its entire printed sequence resolves. Pay its Trigger Chi, then resolve its payoff."),
    ("Anytime", "Timing that permits play between actions or during a Reaction Window when you have priority; never during another effect’s resolution."),
    ("Ascend Timing", "Play before or between purchases in your Ascend Phase. Pay Chi and gain printed Focus Value normally."),
    ("Banked FP", "FP set aside for your next turn. Add it during Initiate; lose it normally if unspent by Hide."),
    ("Boss Stage", "A Rival, Mini-Boss, or Final Boss overlay that supplies HP, Attack Bonus, attack count, and stage rules."),
    ("Combo", "A player-owned learned sequence. Satisfy its requirements, announce it at the proper timing, pay Trigger Chi, and resolve its payoff."),
    ("Consumable", "One-use Equipment returned to the box or supply after resolving."),
    ("Current Speed", "Printed Speed plus every active modifier. Used for initiative, Tempo, Boss comparisons, and card effects unless text says printed Speed."),
    ("Destroy", "Remove a card from the game to the public Destroyed pile."),
    ("Direct Damage", "HP loss that is not an Attack; it normally uses no ATK, Weapons, Tempo, Combos, Attack XP, or Defense window."),
    ("Discard for FP", "Once per Yell, discard one card from hand for 1 FP. It is not played, and only explicit Location text may change the amount."),
    ("Enraged", "Solo Final Boss state at 30 HP or less; it makes two Boss Technique Attacks during its Boss Turn."),
    ("Finishing Technique", "The final required card or action in a Combo sequence."),
    ("Interfere", "A Reaction played by a bystander during another player’s conflict."),
    ("KO", "A Character reaches 0 HP."),
    ("Market", "The shared face-up purchase area: 3 Techniques, 2 Items, and 2 Combo Scrolls."),
    ("Modifier Combo", "A Combo announced after the final step and its choices are declared but before that step’s cost is paid."),
    ("Ongoing", "A card or effect that remains active in play."),
    ("Piercing X", "Ignore X Armor DEF for an Attack."),
    ("Reaction", "A card or ability played during a specific response window."),
    ("Reserved", "A card held in a marked area until its future trigger."),
    ("Revive", "Restore a KO’d Character to the printed HP amount without restoring discarded Equipment."),
    ("Round", "One Honor Phase plus every eligible player and Boss turn in the initiative order locked during Honor."),
    ("Scene Change", "After its triggering effect finishes, replace the current Location and resolve On Reveal."),
    ("Tempo Advantage", "Once per round, after paying 1+ Chi for an Attack targeting or Defense against a slower opposing active Character, regain 1 Chi."),
    ("Trigger Chi", "Additional Chi paid at a learned Combo’s trigger point; pay separately for every Combo triggered."),
    ("Unblockable", "Defense cards cannot be played; Character DEF and Armor still apply unless text says otherwise."),
]


def paragraph(text: str) -> dict:
    return {"kind": "paragraph", "text": text}


def upgrade_rules() -> None:
    data = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    data["version"] = "v1.5"
    data["source"] = "Dojo Deckbuilder Rules v1.5"
    data["houseRules"] = HOUSE_RULES
    data["glossary"] = [{"term": term, "meaning": meaning} for term, meaning in GLOSSARY]

    chapter_three = next((chapter for chapter in data["chapters"] if chapter["number"] == 3), None)
    if chapter_three:
        chapter_three["intro"] = [
            paragraph("Choose how many people are getting kicked, and whether they are allowed teammates."),
            {
                "kind": "table",
                "rows": [
                    ["Mode", "Players", "Characters Each", "How to Win"],
                    ["Standard Clash", "2–6", "1", "Black Belt Victory or Last Fighter Standing"],
                    ["Quick Duel", "1v1", "1", "Last Fighter Standing only"],
                    ["Tag Team: Swap-Fu", "2–6", "3", "Black Belt Victory or Last Fighter Standing"],
                    ["Dojo Drama: Boss Blitz", "Solo or 2-player co-op", "3", "Defeat the Final Boss"],
                ],
            },
        ]
        chapter_three["sections"] = [
            {"id": "standard-clash", "title": "Standard Clash — 2 to 6 Players", "content": [paragraph("Each player controls one Character and one Starter Deck. Players may attack any opposing active fighter unless a card says otherwise.")]},
            {"id": "quick-duel", "title": "Quick Duel — Face-Punch Finals", "content": [paragraph("A fast 1v1 variant with one Character per player. Last Fighter Standing wins; Black Belt Victory is not used. Belt progression and stat rewards still apply.")]},
            {"id": "tag-team", "title": "Tag Team: Swap-Fu — Recommended Core Format", "content": [paragraph("Each player brings three Characters but only one is active at a time. Fighters may tag during Initiate, protect injured teammates on the bench, and continue after a single KO. Full rules appear in Section 13.")]},
            {"id": "boss-blitz", "title": "Dojo Drama: Boss Blitz", "content": [paragraph("A solo or cooperative three-stage Boss Rush against a Rival, Mini-Boss, and Final Boss. Each player brings three Characters and uses Tag Team rules. Full rules appear in Section 14.")]},
            {"id": "victory-conditions", "title": "Victory Conditions", "content": [
                {"kind": "bullet", "text": "Black Belt Victory: Reach 55 XP, complete the Black Belt promotion task, and promote during Ascend. Quick Duel does not use this victory condition."},
                {"kind": "bullet", "text": "Last Fighter Standing: When every opposing player or team has no conscious fighters remaining, you win immediately."},
                {"kind": "bullet", "text": "Scenario Victory: Dojo Drama may replace the normal conditions with a Boss or mission objective."},
            ]},
        ]

    RULES_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    upgrade_cards()
    upgrade_rules()
