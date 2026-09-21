# Dojo Deckbuilder Canonical Rules

Rules v2.3 · revision v2.3-r5

> Generated from content/dojo-game.json + content/rules.json + content/cards.json. This file is a public projection, not an independent rules source.

## Machine-readable game definition

- Mode: quick-duel
- Players: 2
- Starting HP: 25
- Opening hand: 7
- Market row: 7

### Phase contract

#### Honor — once-per-round

Actor: all.

- Automatic: scene-change
- Automatic: on-reveal
- Automatic: survival-xp
- Automatic: refresh-tempo
- Automatic: determine-initiative

#### Initiate — start-of-turn

Actor: active-player.

- Legal capability: pass
- Legal capability: equip
- Legal capability: resolve-start-effects

#### Yell — main-phase

Actor: active-player.

- Legal capability: play-card
- Legal capability: attack
- Legal capability: defense-practice
- Legal capability: combo
- Legal capability: pass

#### Ascend — buy-and-belt-up

Actor: active-player.

- Legal capability: purchase
- Legal capability: combo-attempt
- Legal capability: promote
- Legal capability: pass

#### Hide — cleanup

Actor: active-player.

- Automatic: resolve-end-effects
- Automatic: discard
- Automatic: draw-new-hand
- Automatic: clear-focus
- Legal capability: hide

## Public rules

## 1 Welcome to Paper-Fu

A government-approved martial-art system, publicly tested through card combat and an amount of paperwork nobody has successfully escaped.

The Department of Competitive Safety has one straightforward job: make sure martial-arts schools do not injure the public, endanger property, or claim that a parking lot is a sacred training ground.

For years, every dojo certified itself. That policy ended during the Municipal Demonstration Expo, when three judges accepted discount coupons as evidence, an emotional-support ferret interfered with the final two bouts, and the flaming monks spent six minutes arguing that the fountain was ‘part of the ceremony.’ They are now under restraining orders from the fountain, the fire marshal, and each other.

Rather than decide who was to blame, the Department created a standardized system from techniques submitted by every participating school. A junior clerk filed thousands of entries in a rusty cabinet marked TAX RECEIPTS and went home early. When the cabinet collapsed, the Department named it the Archive of Practical Fighting Wisdom. The masters immediately declared it ancient.

The result was Paper-Fu: a government-approved discipline built from registered techniques, defenses, equipment, drills, and wildly optimistic professional opinions. Every player leads a certified delegation—one competitor or a three-fighter demonstration team—for the annual Licensing Tournament. Every approved dojo keeps its license; the tournament tests whether Paper-Fu earns another year of funding and names a Provisional Model Dojo.

| THE GOLDEN RULE
When a card directly contradicts this rulebook, the card wins. When two cards conflict, use the timing and priority rules in Section 15. When the table still cannot agree, the active player makes the temporary ruling, finishes the turn, and everyone may yell about it afterward. |
| --- |

What Kind of Game Is This?

Dojo Deckbuilder is a competitive martial-arts deckbuilding game. Each player leads a certified delegation, starts with the same awkward 15-card curriculum, plays cards to fight and generate Focus, acquires stronger registered techniques from a shared Market, learns Combos, completes Belt certification tasks, and climbs from White Belt to Black Belt.

- Fixed packs, not randomized boosters. Every registered technique is in the field kit; the Department had enough trouble cataloging them once.

- Deckbuilding happens during play. Purchased Techniques and Items enter your discard pile and cycle into future hands; learned Combos remain face up beside your fighter.

- Combat is direct. Attacks target High, Mid, or Low zones; defenders answer with cards, armor, and panic.

- Two routes to victory. Reach Black Belt or become the last fighter standing.

- Expandable by design. New dojos can add Characters, Techniques, Items, Equipment, Locations, Combos, Bosses, and new varieties of deeply avoidable nonsense.

## 2 Components & Card Types

Sort the Department’s standardized field kit now. The filing cabinet has already had a difficult day.

### Core Components

- Character Cards — three fighters per player in Tag Team and Dojo Drama; one per player in Standard Clash or Quick Duel.

- Fixed Starter Decks — every player uses the same 15 cards: Basic Jab, Basic Body Kick, Basic Shin Kick, Wild Swing, High Guard, Center Guard, Low Guard, Cover Up, Breathing Drill, Footwork Drill, and Bad Habit ×5.

- Market Deck — shuffle all purchasable Attacks, Defenses, Katas, Items, Weapons, Armor, Consumables, and utility cards together. Reveal seven random cards; no card type is guaranteed a slot.

- Combo Deck — a separate face-down deck. Combos never occupy Market slots and never enter a player's draw deck.

- Location Deck — global battlefield conditions. One Location is active at a time; the fight can Scene Change during a round.

- Boss Materials — three Boss Stage cards, ten Boss Profile cards, and a dedicated 32-card Boss Arsenal Deck containing Boss Attacks, Boss Defenses, and Boss Techniques for Dojo Drama. The Department counted twice and has filed the first count as a training incident.

- Trackers — tokens, cubes, dice, beads, tiny plastic fists, or suspiciously organized snacks for HP, XP, Focus, Tempo, promotion tasks, and temporary effects.

### Card Types

| Type | What It Does | Where It Goes |
| --- | --- | --- |
| Character | Your fighter: HP, ATK, DEF, Speed, and unlockable abilities. | Stays face up. |
| Attack | A strike aimed at High, Mid, Low, or Any zone. | Played during your Yell Phase. |
| Defense | A reaction that adds Guard or changes an incoming strike. During your Yell, one Defense may instead be used for Defense Practice. | Played as a Reaction when targeted. |
| Kata | Training, setup, card draw, Flow setup, or strategic weirdness. | Usually played during your Yell Phase. |
| Equipment | The umbrella family for Weapons, Armor, Gear, Consumables, and Items. | Permanent or one-use, depending on subtype. |
| Combo | A learned sequence of Technique tags or conditions that grants a payoff when completed. | Drawn from the separate face-down Combo Deck when learned; stays face up beside your Character. Maximum 2 learned. |
| Location | A global battlefield with On Reveal, Ongoing, and sometimes Scene Change Trigger text. | One Location is active for everyone until a Scene Change replaces it. |
| Junk | Starter-deck baggage with no Technique effect. | Bad Habit has printed Focus Value 0; once during your Yell each turn, you may discard one from hand to gain 1 Focus. |
| Boss Stage | A Rival, Mini-Boss, or Final Boss overlay that supplies Boss HP, Attack bonus, and stage rules. | Placed beside one unused Character card during Dojo Drama. |
| Boss Profile | A named opponent with printed ATK, DEF, Speed, stage fit, and one deterministic rule. | Paired with the matching Boss Stage in Dojo Drama. |
| Boss Arsenal | Automated Boss Attacks, Boss Defenses, and Boss Techniques used only in Dojo Drama. | Shuffled into the dedicated 32-card Boss Arsenal Deck. |

### Card Anatomy

| Element | Meaning |
| --- | --- |
| Focus Cost | Focus required to buy a face-up Market card or learn a revealed Combo. |
| Focus Value | Focus generated when the card is legally played or Equipped from your hand during your own turn. |
| Attack Power / Guard | Attack Power added to an Attack or Guard added by a Defense card. |
| Zone | High, Mid, Low, Any, or the zones protected by Armor. |
| Timing | Turn, Reaction, Anytime, Ongoing, On Reveal, Scene Change, or another explicit window. |
| Tags | Rules labels such as Punch, Kick, Spin, Flow, Street, Improvised, High, or Low. Tags matter only when another rule references them. |
| Flavor Text | Emotionally necessary. Mechanically irrelevant unless your dojo is dangerously committed to improv. |

## 3 Game Modes & Victory

Choose a certified demonstration format. The Department considers all of these ‘controlled.’

| Mode | Players | Characters Each | How to Win |
| --- | --- | --- | --- |
| Standard Clash | 2–6 | 1 | Black Belt Victory or Last Fighter Standing |
| Quick Duel | 1v1 | 1 | Last Fighter Standing only |
| Tag Team: Swap-Fu | 2–6 | 3 | Black Belt Victory or Last Fighter Standing |
| Dojo Drama: Boss Blitz | Solo or 2-player co-op | 3 | Defeat the Final Boss |

### Standard Clash — 2 to 6 Players

Each player controls one Character and one Starter Deck. Players may attack any opposing active fighter unless a card says otherwise.

### Quick Duel — Face-Punch Finals

A fast 1v1 variant with one Character per player. Last Fighter Standing wins; Black Belt Victory is not used. Belt Exams, abilities, ATK, DEF, Focus, and hand-size rewards still apply, but promotion never raises Max HP or heals a fighter. Quick Duel keeps the paperwork and removes the medical expansion plan.

### Tag Team: Swap-Fu — Recommended Core Format

Each player brings three Characters but only one is active at a time. Fighters may tag during Initiate, protect injured teammates on the bench, and continue after a single KO. Full rules appear in Section 13.

### Dojo Drama: Boss Blitz

A solo or cooperative three-stage Boss Rush against a Rival, Mini-Boss, and Final Boss. Each player brings three Characters and uses Tag Team rules. Full rules appear in Section 14.

### Victory Conditions

- Black Belt Victory: Reach 35 XP, complete the Black Belt promotion task, and promote during Ascend. Quick Duel does not use this victory condition.

- Last Fighter Standing: When every opposing player or team has no conscious fighters remaining, you win immediately.

- Scenario Victory: Dojo Drama may replace the normal conditions with a Boss or mission objective.

## 4 Setup & First Round

Register your delegation, unpack the approved curriculum, and give the safety cone the amount of respect it has earned.

### Setup Steps

1. Choose a mode. Tag Team is the recommended Core Format. Standard Clash, Quick Duel, and Dojo Drama are also supported.

2. Choose Characters. Use three per player in Tag Team and Dojo Drama, or one per player in Standard Clash or Quick Duel. Place each Character face up and set every fighter to 25 HP.

3. Take trackers. Set each player to White Belt, 0 XP, 0 Focus, and unused Tempo. Record printed ATK, DEF, and Speed.

4. Take the fixed Standard Starter Deck. Every player uses the same named 15 cards listed below. Shuffle it and draw seven cards.

5. Mulligan once if needed. If your opening hand contains no Attack and no Kata, reveal it, shuffle it back, and draw seven new cards. The second hand stays, even if it is a small cardboard tragedy.

6. Combine and shuffle all purchasable Techniques, Katas, Items, Weapons, Armor, Consumables, and utility cards into one shared Market Deck.

7. Reveal seven random Market cards. Keep the Combo Deck separate and face-down beside the Market.

8. Shuffle the Location Deck. Reveal the first Location during the first Honor Phase.

9. Randomly choose the opening referee to break first-round Speed ties. Pass the marker clockwise after each round.

### Standard Starter Deck

| Card Group | Count | Fixed Contents |
| --- | --- | --- |
| Attacks | 4 | Basic Jab; Basic Body Kick; Basic Shin Kick; Wild Swing |
| Defenses | 4 | High Guard; Center Guard; Low Guard; Cover Up |
| Katas | 2 | Breathing Drill; Footwork Drill |
| Junk | 5 | Bad Habit ×5 |

### Quickstart

1. Choose the mode and fighter roster. Take the identical 15-card Starter Deck, shuffle, and draw seven. In Tag Team and Dojo Drama, choose one fighter to begin active.

2. Shuffle the shared Market Deck, separate face-down Combo Deck, and Location Deck. Reveal seven random Market cards; Combos never occupy Market slots.

3. Begin Honor once for the whole round: Scene Change, give each surviving player +1 XP, refresh Tempo, and order turns by current Speed.

4. Each player then takes their own H.I.Y.A.H. turn after the global Honor Phase: Initiate, Yell, Ascend, Hide.

5. During Yell, play cards one at a time. You may play any number of legal Attacks from your hand, resolving each separately. After your first Attack with Flow each turn resolves, draw one card. Once during Yell, you may use one Defense from hand for Defense Practice instead of playing it normally.

6. Cards legally played or Equipped from hand during your own turn generate printed Focus before their effects resolve. Defense Practice generates only the practiced card's printed Focus. During Ascend, spend Focus on Market cards or one Combo attempt.

7. Promote one Belt if you have the required XP and completed its task.

8. During Hide, resolve end effects, discard your hand and play area as required, draw a new hand, and lose unspent Focus.

9. After each Market purchase, reveal the top Market card to refill the empty slot. After everyone acts, resolve end-of-round effects. If nobody bought a Market card during the round, use Market Mercy to replace all seven cards; otherwise keep the row. Pass the referee marker and begin the next round.

The whole game in one sentence: Play cards to fight and generate Focus, buy a better deck, complete Belt challenges, and reach Black Belt before everyone else—or simply knock them all out.

## 5 Core Resources & Player Areas

Focus buys registered equipment. XP certifies advancement. HP keeps the demonstration from becoming paperwork.

### HP — Health Points

Every Character begins at 25 HP. Damage reduces current HP. Healing cannot raise a fighter above maximum HP. At 0 HP, the fighter is Knocked Out. Belt certification does not raise current or maximum HP or heal a fighter. Max HP remains 25 unless a card or scenario explicitly changes it.

### Focus — Purchasing Power

- Focus is the game's only spendable currency. It buys face-up Market cards and revealed Combos during Ascend.

- When you legally play or Equip a card from your hand during your own turn, gain its printed Focus Value. Gain it after all costs are paid and before resolving the card's effect.

- Cards played outside your own turn do not generate their printed Focus Value unless their rules text explicitly grants Focus. Explicit Focus gained outside your turn remains until your next Hide unless that effect gives it another duration.

- Defense Practice is the one core exception: once during your Yell, reveal one Defense from hand and place it in your play area to gain its printed Focus. It is not played, provides no Guard, resolves no rules text, grants no XP, and cannot satisfy a card, Combo, or Belt Exam requirement. Discard it during Hide. The Department calls this studying because 'discarding your guard to buy a helmet' tested poorly.

- Focus printed on a card is not a victory value. It is the card's contribution to that turn's purchasing power.

- Unspent Focus is lost during Hide. Focus does not bank between turns unless a specific effect explicitly says it does.

- You may not discard an arbitrary card for Focus. Once during your Yell each turn, you may discard one Bad Habit from your hand to gain 1 Focus. Bad Habit still has a printed Focus Value of 0.

### XP — Experience Points

XP is permanent and player-wide. It unlocks Belt promotions and does not decrease unless a card explicitly says so. In Tag Team, all three Characters share the player's XP and Belt.

### ATK, DEF, and Speed

| Stat | Function |
| --- | --- |
| ATK | Added to each legal Attack you make, along with the Attack card and eligible Weapon bonuses. |
| DEF | Added to every incoming Attack against your active fighter, along with matching Armor and any Defense card. |
| Speed | Determines turn order at the start of each round. It also enables Tempo Advantage against slower opponents (see below). Speed does not alter card timing unless an effect says so. |

### Tempo Advantage

Once per round, when your active fighter is faster than the opposing active fighter involved in a combat, you may use Tempo for one of these benefits:

| Timing | Tempo benefit |
| --- | --- |
| Your Attack | +1 Attack Power to that Attack. |
| Your Defense | +1 Guard to that Defense card. |

- Check current Speed when the Attack or Defense is legally played. A tie grants no Tempo Advantage.

- Tempo belongs to the player, refreshes during Honor, and does not refresh when tagging.

- Using Tempo is optional. Place or flip a token to show it has been used for the round.

- If the card is later canceled or prevented, Tempo remains used.

- Bosses do not use Tempo, but a faster player may use Tempo against a Boss.

### Your Personal Play Area

- Draw Deck: face down; you may count it but never inspect or reorder it.

- Hand: hidden from opponents; hand size is normally seven.

- Play Area: face-up cards played this turn.

- Discard Pile: face up; the top card is public, but players may not search it without permission from an effect.

- Equipped Area: permanent Equipment attached to specific Characters.

- Destroyed Pile: cards removed from the game. Keep it face up and separate from every discard pile.

## 6 The H.I.Y.A.H. Round

Honor • Initiate • Yell • Ascend • Hide — the Department’s five-stage Demonstration Safety Protocol. It has never been shortened.

A round begins with one global Honor Phase. Then, in Speed order, each player takes one complete turn consisting of Initiate, Yell, Ascend, and Hide. After the slowest fighter finishes, the round ends.

| Phase | When | What Happens |
| --- | --- | --- |
| H — Honor | Once per round | Scene Change, On Reveal, survival XP, refresh Tempo, determine initiative. |
| I — Initiate | Start of each turn | Ready cards, optional tag, Equip permanents, start effects. |
| Y — Yell | Main phase | Play cards, play any number of legal Attacks from hand, trigger learned Combos, use abilities. |
| A — Ascend | Buy and promote | Spend Focus, attempt one Combo, promote one Belt. |
| H — Hide | Cleanup | End effects, discard, draw the new hand, lose unspent Focus. |

### Honor Phase — Global Round Start

1. Scene Change. Reveal the top card of the Location Deck and make it the new current Location. On the first round, there is no current Location to discard — simply reveal the first one. On later rounds, discard the current Location first, then reveal the next.

2. Resolve the new Location's On Reveal text. Its Ongoing text becomes active immediately and remains active until the Location leaves play.

3. Each non-eliminated player gains +1 XP for surviving long enough to learn something.

4. Refresh each player's Tempo (see Section 5).

5. Determine turn order from highest Speed to lowest. Break ties with the referee marker, then clockwise from that player.

### Initiate Phase — Start of Your Turn

1. Ready exhausted or once-per-turn cards.

2. In Tag Team, you may tag once now. Tagging does not refresh Tempo.

3. Equip any number of permanent Equipment cards from your hand. Respect all slots and Hand limits. Each legally Equipped card generates its printed Focus Value.

4. Resolve start-of-turn effects in the order you choose.

### Yell Phase — Play Cards

Play one card at a time and resolve it completely before playing another, unless a Reaction interrupts it. You may play Katas, use Items, activate Equipment, play any number of legal Attacks from your hand, and trigger learned Combos as long as every action is legal.

Once during your Yell, you may use one Defense from your hand for Defense Practice. Reveal it, place it in your play area, and gain its printed Focus. It is not played and does nothing else. Apparently the safest block is the one performed against an imaginary purchasing decision.

After your first Attack with Flow each turn resolves, draw one card. See Sections 7 and 8.

### Ascend Phase — Buy and Belt Up

- Spend Focus on any number of face-up Market cards. Put each purchase in your discard pile, then immediately reveal the top card of the Market Deck to fill the empty slot. Keep any unspent Focus until Hide.

- Once per turn, reveal the top card of the separate Combo Deck. Pay its Focus Cost to learn it, or return it face-down to the bottom. Either choice uses your Combo attempt.

- A learned Combo stays face up beside your fighter and never enters your hand, draw deck, or discard pile.

- Promote up to one Belt if you meet its XP threshold and completed its promotion task.

### Hide Phase — Cleanup

1. Resolve end-of-turn effects. Set aside cards drawn or added to your hand by this step until cleanup is complete.

2. Discard all cards in your play area and hand except Equipped, Ongoing, otherwise retained cards, and cards set aside by Step 1.

3. Draw your normal new hand of seven cards, or eight at Blue Belt, shuffling your discard pile only when needed. Then add the cards set aside by Step 1.

4. Set Focus to 0.

### End of the Round

1. Resolve Location and card effects that occur at end of round.

2. In Tag Team, benched fighters do not recover HP automatically.

3. Keep the current Market row if at least one card was purchased this round. If nobody purchased a Market card, use Market Mercy: discard all seven cards and reveal seven replacements from the mixed Market Deck.

4. Pass the referee marker clockwise and begin the next Honor Phase.

## 7 Playing Cards

Announce it, check it, resolve it, and only then discover why the inspector wrote another note.

### The Four Steps of Playing a Card

1. Announce the card and all required choices: target, zone, mode, or affected Equipment.

2. Check legality. Satisfy timing, target, prerequisite, slot, and other printed requirements.

3. Pay any specific printed costs, such as discarding a card, exhausting Equipment, losing HP, or performing text before a colon. Paid costs are not refunded if the effect is later prevented.

4. If this card was legally played or Equipped from your hand during your own turn, gain its printed Focus Value. Then resolve the text from top to bottom and place the card in its proper area.

Cards have no general play cost. A printed Focus Cost is paid only when buying the card from the Market or learning it from the Combo Deck.

### Defense Practice

Once during your Yell, you may Practice one Defense from your hand. Reveal it and place it face up in your play area. Gain its printed Focus Value.

- A practiced Defense is not played. It provides no Guard, resolves no rules text, and opens no Reaction Window.

- It grants no Defense XP and cannot satisfy a card condition, learned Combo, Green Belt Exam, Brown Belt Exam, or other requirement that counts a played card or Defense.

- Leave it in your play area and discard it during Hide. You cannot later use it to defend before then.

Defense Practice is not a general discard-for-Focus action. It is a certified drill with exactly one participant and no attacker willing to admit they were there.

### Flow

| FLOW
After the first Attack you play with Flow each turn resolves, draw one card. Later Attacks with Flow that turn do not draw a card. Flow does not make an illegal target, timing, zone, or Combo step legal. |
| --- |

An effect that says your next Attack gains Flow lasts until that Attack is played or the turn ends. If multiple effects grant Flow to the same Attack, they do not create multiple draws.

### Junk & Bad Habits

Bad Habit has no printed effect and a printed Focus Value of 0. Once during your Yell each turn, you may discard one Bad Habit from your hand to gain 1 Focus. This is a special Bad Habit rule, not a general discard-for-Focus action. Bad Habit can still matter when another effect counts, reveals, discards, or destroys Junk.

There is no universal discard-for-Focus action. A discard produces Focus only when a specific card or rule says it does.

### Drawing and Reshuffling

When you must draw more cards than remain in your deck, draw what is available, shuffle your discard pile to create a new deck, then continue drawing. Do not shuffle early. If both piles are empty, draw as many as possible.

### Gaining, Discarding, Destroying, and Returning

| Term | Destination | Notes |
| --- | --- | --- |
| Gain / Buy Technique or Item | Your discard pile | The card is yours immediately but normally cannot be used until drawn later. |
| Discard | Appropriate discard pile | Your cards go to your discard; unpurchased Market cards and Locations go to their matching shared-deck discards. |
| Destroy | Public Destroyed pile | Removed from the game unless an effect specifically retrieves Destroyed cards. |
| Return to Box | The game box | Used for one-use Consumables or scenario components that should not re-enter this game. |
| Set Aside | A clearly marked temporary area | The effect that set it aside explains when it returns. |
| Buy Combo | Learned Combo area | Place it face up beside your Character. It does not enter your personal deck. |

### Ongoing Cards

An Ongoing card remains active in play until its text ends or removes it. It is not discarded during Hide unless its text says so. Equipped cards are permanent but are not considered Ongoing unless they also have that keyword.

## 8 Combat

Declare a zone. The Department requires it after the incident involving a left shin, three witnesses, and a zoning dispute.

### The Three Zones

| Zone | Japanese Label | Body Area | Common Armor Slots |
| --- | --- | --- | --- |
| High | Jōdan | Head and upper line | Head |
| Mid | Chūdan | Torso and arms | Chest, Arms |
| Low | Gedan | Legs and lower line | Legs, Feet |
| Any | Choose when declared | Whichever zone the attacker names | The chosen zone |

### Attack Sequence

1. Declare the strike. Play one Attack card, name one opposing active Character, and declare its zone. "Any" attacks choose a zone now.

2. Identify combat values. Identify the Attack card's Attack Power, Character ATK, eligible Weapon bonuses, defender DEF, matching Armor, and other currently applicable modifiers. Do not calculate or lock final totals yet.

3. Open the Reaction Window. The defender may play one Defense card by default and activate legal Reactions. Bystanders may interfere if their cards allow it.

4. Resolve the Reaction Stack. Resolve Reactions in reverse order. Any Attack, ATK, DEF, Guard, Armor, zone, or other modifiers they create remain in effect for the final calculation.

5. Calculate final combat values. After the Reaction Stack is empty, calculate Attack Power and Defense using all applicable values and modifiers, including Modifier Combos and resolved Reactions. Combat totals are not locked before this step.

6. Deal damage. Damage equals final Attack Power minus final Defense, minimum 0.

7. Resolve the result. If damage is at least 1, the strike Hits. If damage is 0, it is Blocked. Resolve hit, block, and after-attack effects.

8. Award XP. The attacker gains +1 XP for the legal Attack card. The defender gains +1 XP for a legal Defense card, whether the Defense succeeded or not.

### Final Combat Formula

| FINAL COMBAT FORMULA
Attack Power = printed Attack Power + Character ATK + eligible Weapons + modifiers. Defense = Character DEF + matching Armor + one Defense card's Guard + modifiers. Damage = max(0, Attack Power − Defense). |
| --- |

### Tempo in Combat

When your active fighter is faster than the opposing active fighter involved in a combat, you may spend your once-per-round Tempo for +1 Attack Power on your Attack or +1 Guard on your Defense card. Check current Speed when the card is legally played. See Section 5 for edge cases.

### Multiple Attacks & Flow

- You may play any number of legal Attack cards from your hand during your turn. Each Attack resolves as a separate strike.

- After the first Attack you play with Flow each turn resolves, draw one card. Later Flow Attacks that turn resolve normally without that draw.

- Bonuses that say ‘your next Attack’ expire after one strike, even if it is Blocked.

### Defense Limits

- The targeted player may play one Defense card per strike unless a card explicitly allows an additional Defense.

- Static Character DEF and matching Armor apply even if no Defense card is played.

- A Defense card must protect the attacked zone or say Any / Universal.

- A Defense card is discarded after the strike resolves unless it says Ongoing, Equip, or Return.

- Playing a Defense consumes the card from your current hand; you do not refill your hand until your own Hide Phase.

### Reversal

Once per round, after a Defense card you played Blocks an Attack, you may immediately play one Attack from your hand against that attacker. This is a Reversal. Resolve that Attack normally.

- A Reversal happens outside your turn. The original attacker may defend normally.

- A Reversal Attack cannot trigger another Reversal. There is no automatic draw, and it does not generate Focus because it was not played during your turn.

- A Reversal earns the normal Attack XP if eligible. Specific card text may improve a Reversal only as written.

### Critical Terms

| Term | Meaning |
| --- | --- |
| Hit | The strike deals at least 1 damage after Defense. |
| Blocked | The strike deals 0 damage. |
| KO | Damage or an effect reduces a Character to 0 HP. |
| Unblockable | Defense cards cannot be played; Character DEF and Armor still apply unless the card says "ignore DEF and Armor." |
| Piercing X | Ignore X points of Armor Defense. It does not ignore Character DEF or Defense cards. |
| Direct Damage | Lose HP without an Attack. It does not open a normal Defense window unless an effect says it can be prevented. |
| Counter | A Defense or Reaction creates an effect after the Attack resolves, usually only if the strike is Blocked. |

### Combat Example

Rita plays Wild Swing for 1 Damage, adds 2 ATK, and uses a +1 Weapon: Attack Power 4. Devin has 1 DEF and Mid Armor worth 1, then plays Desperate Cover for +2 Guard: Defense 4. The strike deals 0 and is Blocked. Rita still gains 1 XP for attacking; Devin gains 1 XP for defending and may trigger any "when you Block" effects.

## 9 Equipment

Equipment is a family of permanent and one-use cards. The Department has official slot paperwork for helmets, weapons, and several objects that should not have been approved. There is no general cost to Equip or use them; follow timing, slots, Hand limits, and any specific printed cost.

### Equipping Permanent Equipment

- Equip permanent Equipment only during Initiate unless a card says otherwise.

- The card must be in your hand. Place it beside the Character receiving it and gain its printed Focus Value.

- Newly purchased Equipment goes to your discard pile and cannot be equipped immediately.

- You may Equip multiple cards if you have legal slots. Replacing an occupied slot discards the old Equipment first.

### Weapons

- A Character has two Hands.

- A two-handed Weapon occupies both Hands.

- A one-handed Weapon occupies one Hand; two one-handed Weapons may be dual-wielded.

- Unless a card says otherwise, all equipped Weapon bonuses apply to each Attack made by that Character.

- A Disarm effect discards equipped Weapons to their owner's discard pile. If the effect says Destroy, place them in the Destroyed pile instead.

### Armor and Gear

| Slot | Limit | Default Zone |
| --- | --- | --- |
| Head | 1 | High |
| Chest | 1 | Mid |
| Arms | 1 | Mid |
| Legs | 1 | Low |
| Feet | 1 | Low |
| Accessory | 1 | As printed |

- Armor adds DEF only when its protected zone matches the incoming Attack, unless it says Universal.

- Gear is permanent Equipment that does something other than—or in addition to—Armor. Gear uses the slot printed on the card.

- Equipment enters play ready. To exhaust it, turn it sideways and pay that card's exhaust cost. All of your exhausted Equipment readies at your Initiate Phase. Exhausting never turns off printed passive stats such as Guard or Attack Bonus; it only prevents another exhaust ability until the card readies.

### Consumables

Consumables are one-use Equipment. Play them during their printed timing, resolve the effect, then return the card to the box or Consumable supply. Consumables do not enter the Destroyed pile unless the card says Destroy.

In Tag Team, a healing Consumable without a named target may heal your active Character or one conscious benched Character. A KO'd Character requires Revive.

### Items and Tools

Items are utility Equipment. Most are played during your Yell Phase and discarded after resolving. Items marked Ongoing, Equip, or with a slot remain in play according to their text.

Reaction Items are one-use Items played during a Reaction Window. They do not occupy a permanent Equipment slot; resolve their printed effect, then destroy or discard them exactly as the card says.

### Equipment and Characters

- Equipment belongs to the specific Character it is attached to, not to the active slot.

- In Tag Team, Equipment stays with a Character when that fighter tags out.

- When a Character is KO'd, discard all permanent Equipment attached to that Character. Any Ongoing cards attached to that fighter are discarded unless stated otherwise.

- Cards still in the player's deck, hand, or discard pile are not lost when a Character is KO'd.

## 10 Deckbuilding, Market, Combos & Locations

Begin with the basic curriculum. Acquire approved techniques, document a sequence, and relocate when an inspector closes the venue.

### The Shared Market

- The Market is one seven-card face-up row drawn from a single shuffled Market Deck containing purchasable Attacks, Defenses, Katas, Items, Weapons, Armor, Consumables, and utility cards.

- The available mix is random. No card type is guaranteed a slot; apparently curriculum planning was assigned to a raffle drum.

- During Ascend, buy cards one at a time by paying printed Focus Costs. Put each purchase in your discard pile.

- After each purchase, immediately reveal the top card of the Market Deck to fill the empty slot. The buyer may continue purchasing as long as they can pay each printed Focus Cost. Unspent Focus remains available until Hide.

- The Combo Deck is separate, face-down, and never contributes cards to the Market.

- Unpurchased Market cards remain in the row between rounds. If a complete round ends with no Market purchase, discard all seven cards and reveal a fresh seven-card row. This Market Mercy refresh prevents a stalled row.

### The Mixed Market Deck

The Market Deck combines purchasable Attacks, Defenses, Katas, Weapons, Armor, Consumables, and utility Items. Tags printed on cards—such as Punch, Kick, Hand, Spin, Sweep, Street, Improvised, Traditional, High, or Low—are rules labels with no effect by themselves but may be referenced by Combos, Locations, Characters, and other cards.

### Building a Curriculum

You never declare a required deck identity. Your curriculum emerges from the cards you acquire: you may improve your offense, protection, hand flow, equipment, Combos, Focus generation, or a mix of all of them. Let the cards define the plan at the table.

### Learning Combos

- The face-down Combo Deck is separate from the Market. Each Combo shows a Focus Cost, Sequence or Requirement, Effect, Timing Type / Limit, and relevant Tags.

- Once during Ascend, reveal the top Combo. Pay its Focus Cost to learn it; if you decline or cannot pay, return it face-down to the bottom. You may know a maximum of two Combos.

- Complete a Combo's printed sequence in order. Unless stated otherwise, all listed actions occur during the same turn and must use the same named opponent.

- Other legal actions may occur between steps unless the Combo says Consecutive.

### Combo Timing — Modifier vs. Aftermath

- Modifier Combo: after all earlier steps, announce the final required step and choices, then apply the Combo's modifier before calculating that step. The final step must still be legal.

- Aftermath Combo: after the entire printed sequence resolves, resolve the Combo's payoff.

- A Combo's Finishing Technique is played normally as the actual next required step. It must still satisfy every printed requirement.

- A Combo marked Once per turn or Once per round cannot trigger again until its printed limit refreshes. Flip it face down as a reminder.

- Learned Combos are not cards in hand, do not generate Focus, are not discarded during Hide, and do not count as cards played.

Combo Example — Swan Song: a Low or Mid Kick must Hit. When you later announce a High Kick against the same opponent, apply Swan Song's modifier to that High Kick, then resolve it normally. If the opening Kick did not Hit, the Combo is not ready.

### Locations and Scene Changes

- The current Location is a global battlefield. Its Ongoing text affects every player unless it names a specific player, fighter, tag, or card type. Location cards never enter a player deck or hand.

- A Location may contain On Reveal text, an Ongoing Effect, and a Scene Change Trigger. Resolve On Reveal immediately when the Location enters play. Ongoing text applies while it remains current. A Scene Change Trigger tells you when the fight spills somewhere else.

- Scene Change: Finish the effect that caused the Scene Change. Discard the current Location, reveal the top Location card, resolve its On Reveal text, and make its Ongoing text active. A Scene Change does not restart the round, award survival XP, refresh Focus or Tempo, or change turn order.

- A Scene Change happens automatically at the start of every round during Honor. It also happens after a fighter is KO'd if the game continues, when the current Location's Scene Change Trigger fires, or when a card or scenario explicitly says Scene Change.

- If one effect KOs multiple fighters at the same time, resolve every KO from that effect first, then perform only one Scene Change. If a Scene Change itself causes another immediate Scene Change, finish each reveal completely before changing again.

- If the Location Deck empties, shuffle the Location discard pile to form a new deck. If no cards remain, keep the current Location until a Location becomes available or the game ends.

Location Example — Parking Lot Behind the Dojo: Makes Katas harder while rewarding Street and Improvised Weapons. The Location does not choose a winner; it changes which cards are efficient for everyone until the scene moves again.

### When a Shared Deck Empties

When the Market Deck empties, shuffle its discard pile to form a new deck. When the Combo Deck empties, shuffle its discard pile. If a deck and its discard are both empty, leave the affected slot or action unavailable until cards return. The game does not end because a shared deck is exhausted.

### Deck Knowledge

You may count your own draw deck without looking at card faces. The number of cards in every hand is public; the cards are private. The top card of each discard pile and all face-up cards are public. No player may search, reorder, or inspect any deck or discard pile without an effect that explicitly allows it. "I was just checking something" is not a card effect. Put the discard pile down, Sensei Spreadsheet.

## 11 XP & Belt Progression

Belts are public certification milestones. Every requirement survived a committee meeting, which explains why some are oddly specific.

### How to Earn XP

| Source | XP | Limits |
| --- | --- | --- |
| Survive the round | +1 XP | Awarded during Honor to each non-eliminated player. |
| Play a legal Attack | +1 XP | Whether it Hits or is Blocked. |
| Play a legal Defense | +1 XP | Whether it Blocks or fails spectacularly. |
| KO an opposing Character | +2 XP | Awarded to the player who caused the final loss of HP. |
| Card or scenario effect | As printed | Follow the effect. |

| ANTI-LOOP RULE
Each physical Attack or Defense card can award its normal "card played" XP only once per round, even if an effect returns or replays it. Extra XP printed by card effects follows the card normally. |
| --- |

### Promotion Rules

- The task shown on a Belt is the challenge required to enter that Belt.

- Keep your current Belt Exam visible. When you complete it, mark it PASSED immediately; it remains public until you promote during Ascend.

- A challenge begins when you enter the previous Belt. Earlier accomplishments are not retroactive.

- Mark a completed challenge even if you have not yet reached the required XP.

- During Ascend, if you have enough XP and the challenge is complete, promote exactly one Belt.

- Surplus XP is retained. You may not skip Belts or promote twice in one turn.

- Belt rewards are the printed certification perks in the Belt Table. They change rank and future play; they do not change current or maximum HP. Surplus XP is retained, but a player may not skip Belts or promote twice in one turn.

### Belt Table

| Belt | XP | Promotion Task | Reward |
| --- | --- | --- | --- |
| White | 0 | Exist. Try not to sprain anything while shuffling. | None |
| Gold | 3 | Three-Gate Orientation: play one legal High, Mid, and Low Attack across one or more turns. | Certification stipend: gain 2 Focus when promoted |
| Orange | 6 | Controlled Combination: during one Yell, play 2 legal Attacks and Hit with at least 1. | +1 ATK permanently |
| Green | 9 | Safety Demonstration: in one Honor, make a legal Attack and Block an opposing Attack. | +1 SPD permanently |
| Purple | 13 | Stockroom Fieldwork: buy Market cards from 2 different card types across Ascends. | First Market card each Ascend costs 1 less Focus |
| Blue | 17 | Field Loadout: have 2 permanent Equipment cards Equipped at the same time. | +1 card in every new hand |
| Red | 22 | Public Demonstration: trigger a learned Combo. | First 3+ damage Hit each turn gains 1 Focus |
| Brown | 28 | Full Curriculum: during one Yell, play 4 cards including an Attack, Kata, and Equipment or Consumable. | +1 DEF permanently |
| Black | 35 | Licensing Final: while Brown Belt, KO an opposing fighter. | Win the duel and receive the very serious certificate |

### Task Clarifications

- Three-Gate Orientation (Gold): Track High, Mid, and Low separately. An Any Attack counts as the declared zone.

- Two-Attack Test (Orange): Both Attacks must be legal and played during the same turn. At least one must Hit.

- Safety Demonstration (Green): Both cards must be legal and occur in the same Honor. The Defense must Block an opposing Attack.

- Two Market Types (Purple): Track distinct purchased types among Attack, Defense, Kata, and Item. Purchases need not occur during the same Ascend.

- Equip Two (Blue): Any two permanent Equipment cards attached at the same time.

- Four-Card Mastery (Brown): At least four cards legally played or Equipped from hand during one turn, including the listed types.

- Black Belt Target: While Brown Belt, KO any opposing fighter. Bosses count. Complete the task immediately, but promote during your Ascend unless a scenario says otherwise.

### Belt-Licensed Equipment

Some Equipment has a base function for every fighter and a stronger line that begins ‘At [Color] Belt or higher.’ You may buy and equip that card at any Belt; only the stronger line waits for the printed rank. This is a reward for promotion, not a Market lockout.

## 12 Characters & Abilities

Every fighter begins with 25 HP, a certified role in the delegation, and an unhealthy amount of professional confidence.

### Character Card Information

| Field | Rule |
| --- | --- |
| Name / Dojo | Identity, faction, and future source of expansion arguments. |
| Starting HP | 25 unless a mode or card explicitly changes it. |
| ATK / DEF / Speed | Base statistics used throughout the game. Core characters use a normalized stat budget rather than rarity-based power. |
| White Ability | Available from the beginning if printed; may be Activated, Triggered, or Passive as written. |
| Green Ability | Unlocks immediately upon reaching Green Belt; follow its printed ability type and timing. |
| Training Note | A nonbinding note about a fighter’s strengths. It has no rules effect and never restricts deckbuilding. |
| Tags / Traits | Keywords such as Animal, Master, Improvised, or Definitely Three Squirrels. |

### Active vs. Benched

- Only an active Character can attack, be targeted, use ordinary abilities, or contribute printed stats.

- Benched abilities function only when they explicitly say Bench or Team.

- A player's deck, hand, Focus, XP, and Belt belong to the player, not to an individual Character.

- Damage, current HP, status effects, and equipped cards belong to the specific Character.

### Ability Types & Limits

- Activated Ability — An ability you deliberately choose to use, usually with a cost before a colon or an instruction such as "Exhaust:" or "Discard 1 card:". Stunned prevents Activated Abilities.

- Triggered Ability — An ability that becomes eligible when its stated event occurs, usually beginning with "when," "whenever," "after," "at," or "the first time." Stunned does not stop Triggered Abilities unless an effect says otherwise.

- Passive Ability — A continuous rule that applies while its condition is true and requires no activation. Stunned does not stop Passive Abilities unless an effect says otherwise.

- Limits — Once-per-turn abilities refresh at that controller's Initiate Phase; once-per-round abilities refresh during Honor; once-per-game abilities never refresh. An ability with no stated limit follows its printed trigger, subject to the anti-loop rule.

### Status Effects

Place a token on the affected Character or card. Unless the effect gives another duration, a status that says "until your next turn" ends at the beginning of that Character controller's Initiate Phase. A status that says "this round" ends after End-of-Round effects.

| Common Status | Default Meaning |
| --- | --- |
| Stunned | The Character cannot use Activated Abilities until the status ends. Triggered and Passive Abilities still function unless an effect says otherwise. Printed stats still apply. |
| Disarmed | Discard all equipped Weapons. The status itself then ends. |
| Exhausted | Turn the card sideways; it cannot use exhaust abilities until readied. |
| Untargetable | Cannot be chosen as a target. Global effects that do not choose targets still apply. |
| Silenced | Cannot play Katas or trigger learned Combos while active. |

## 13 Tag Team: Swap-Fu

The Department’s officially sanctioned team demonstration: three fighters, one shared curriculum, and a bench full of unsolicited advice.

### Team Setup

- Each player chooses three Characters and places one active and two benched.

- All three begin at 25 HP and share one Standard Starter Deck, one hand, one Focus total, one XP total, and one Belt.

- Choose the starting active Character before drawing the opening hand.

### Tagging

- Once during your Initiate Phase, before equipping cards, you may swap your active Character with one conscious benched Character.

- Tagging is free unless a card or Location says otherwise.

- Statuses and Equipment stay with their Characters. The incoming fighter uses their own stats and attached Equipment immediately.

- A Character that tags in may attack and use abilities normally that turn.

- You cannot voluntarily tag while resolving an Attack or Reaction.

- Tempo belongs to the player, not to an individual Character. Tagging does not refresh Tempo, and the incoming fighter may use the player's Tempo if it is still available this round.

### Bench Care

Benched Characters do not recover HP automatically. Tagging protects an injured fighter but does not erase damage. A healing Consumable you play may target one conscious benched Character you control as described in Section 9. KO'd Characters still require an effect that specifically says Revive.

### Knockouts in Tag Team

When the active Character reaches 0 HP, follow the full Knockout Procedure in Section 16, then apply these Tag Team specifics:

1. Resolve the KO completely and discard that Character's permanent Equipment.

2. If the player has a conscious benched Character, choose one and make it active immediately after the current effect finishes.

3. The replacement does not trigger an Initiate Phase and cannot equip cards until the player's next turn.

4. When all three Characters are KO'd, the player or team is eliminated.

### Team Variants

- Individual Tag Team: Every player has three Characters and attacks any opponent.

- 2v2 Dojo War: Teammates sit opposite each other, share victory, and may not target one another. XP and Belts remain individual unless the scenario says Shared Rank.

- Shared Rank: Optional faster team rule. Teammates share one XP track and Belt; use the higher teammate Speed only for the first round, then each active fighter acts separately.

## 14 Dojo Drama: Boss Blitz

You are attending the Department’s wildly underfunded viability stress test. Budget your confidence accordingly.

You fight exactly three opponents: Rival → Mini-Boss → Final Boss. Each stage pairs a Boss Profile with a Boss Stage card. The Profile supplies identity, printed stats, and one rule; the Stage supplies HP and attack count.

### Boss Rush Setup

1. Choose three Characters for yourself. Your roster uses normal Tag Team rules (Section 13).

2. Choose one Boss Profile for each stage. In Quick Boss Blitz, reveal a random Profile whose printed Stage Fit includes Rival, Mini-Boss, or Final Boss as needed. In Challenge Boss Blitz, deliberately choose the three Profiles before setup.

3. Pair each Profile with the matching Boss Stage card. A Boss Profile contributes only its printed ATK, DEF, Speed, and one Boss Rule. Ignore anything that would require a Boss hand, deck, Focus, Equipment, or choice.

4. Shuffle the dedicated 32-card Boss Arsenal Deck. It contains the twelve original Boss Attacks, eight additional Boss Attacks, six Boss Defenses, and six Boss Techniques. This deck is separate from the normal Technique Deck and does not remove cards from the Market.

5. Prepare your fixed Starter Deck, shared Market Deck, separate face-down Combo Deck, Market row, and Location Deck normally. At the beginning of each Boss stage, shuffle all 32 Boss Arsenal cards to form a fresh Boss Arsenal Deck.

### Boss Stages

| Stage | HP | Boss Attack Bonus | Attacks per Turn |
| --- | --- | --- | --- |
| Rival | 30 | +0 | 1 |
| Mini-Boss | 45 | +1 | 1 |
| Final Boss | 60 | +2 | 1 (2 if Enraged) |

| ENRAGED
While the solo Final Boss has 30 HP or less, it makes two Boss Attacks during each Boss Turn instead of one. Resolve the first Attack completely before revealing the second. In Cooperative Dojo Drama, the Enraged rule does not apply — the co-op Final Boss already makes two attacks per round. |
| --- |

### Boss Turn

The Boss acts once per round according to Speed. It does not buy cards, earn XP, hold a hand, spend Focus, learn Combos, Equip cards, tag, or use Tempo. However, a player may use Tempo Advantage against a Boss if the player's active Character has higher current Speed than the Boss's printed Speed.

1. Reveal Boss Arsenal cards until an Attack is revealed. Resolve each Boss Technique immediately, then continue revealing. Place each revealed Boss Defense face up in the Boss Guard area. If another Boss Defense is already there, discard the old one before placing the new Guard.

2. The Boss targets the instructed active Character and attacks the printed zone. Boss Guard never adds to a Boss Attack; it protects the Boss from a later player Attack.

3. Boss Attack Power = printed Boss Attack Power + printed Boss ATK + the current Boss Stage Attack Bonus.

4. Open and resolve the normal Reaction Window. Then calculate final Attack Power and Defense using the normal combat rules. Resolve any printed Boss Technique effect after the Attack resolves.

5. Discard the Boss Attack after the Attack resolves. If the Boss Arsenal Deck empties, shuffle its discard pile.

6. If the Boss is entitled to another Attack this Boss Turn, repeat Steps 1–5 after the previous Attack has fully resolved.

### Fighting a Boss

- Attack a Boss like an active opposing fighter. It always applies printed DEF but has no Armor or Defense hand unless a scenario explicitly gives it one.

- Boss Guard: when a player declares an Attack whose zone matches the face-up Boss Defense, add that card's Guard to the Boss's Defense for that Attack, then discard the Boss Defense after the Attack resolves. An unmatched player Attack leaves Boss Guard in place. A newly revealed Boss Defense replaces the old one.

- Damage modifiers, Hit/Block effects, Speed modifiers, and effects that directly change combat values work normally when they have a legal Boss target.

- Effects that require the Boss to discard, draw, gain cards, lose or spend Focus, Equip, tag, or make a player-only choice do nothing to a Boss. Resolve any remaining legal part of the effect.

- A Boss cannot be removed by Destroy, instant-KO, alternate-win, or similar shortcut effects unless a scenario explicitly permits it.

### Advancing the Ladder

1. When the Rival or Mini-Boss is KO'd, gain 5 XP. This replaces the normal +2 XP award for causing that Boss KO. When the Final Boss is KO'd, gain 5 XP as well, then check for Scenario Victory.

2. Heal your active Character 8 HP. Benched Characters receive no automatic healing.

3. Resolve the normal KO Scene Change. If this is the Final Boss, the game is over — do not refresh the Market or reveal the next Boss.

4. If the game continues, discard all remaining Market cards to the Market discard and reveal seven fresh random Market cards, reveal the next Boss at the beginning of the next Honor Phase, and shuffle all 32 Boss Arsenal cards for the new stage. This Boss-transition Market refresh replaces the normal end-of-round Market refresh for the round in which a Boss is KO'd — do not refresh twice.

### Winning and Losing

- Win: KO the Final Boss. If that KO completes your Black Belt task and you already have at least 35 XP, promote to Black Belt immediately before Scenario Victory is checked.

- Lose: All of your Characters are KO'd.

- Style Victory: Enter the Final Boss stage already at Black Belt, then defeat the Final Boss because leaving during the climax is rude.

### Cooperative Dojo Drama

For two players, each brings three Characters and uses Tag Team rules. Set Boss HP to 45 / 65 / 85. Each Boss makes two Boss Attacks per round, targeting different players when possible; otherwise target the active fighter with the lowest current HP and break ties randomly. The solo Final Boss Enraged rule does not apply in cooperative play — the co-op Final Boss already makes two attacks per round. Players win or lose together.

## 15 Timing, Reactions & Rule Conflicts

The Department’s Field Dispute Protocol, consulted only after a ferret discovers priority.

### The Reaction Window

When an Attack or effect opens a Reaction Window, begin with the affected player, then proceed clockwise. Each eligible player may play one Reaction or pass. Continue around the table until every player passes consecutively.

### The Dojo Stack

Reaction cards and abilities form the Dojo Stack. Resolve the most recently played Reaction first, then work backward. After the Stack empties, continue resolving the original card. New Reactions may be played only when an effect creates another window.

- The defender may play one Defense card per Attack by default. That Defense is part of the Stack.

- Each bystander may play at most one card with the Interfere keyword during a single Attack.

- The attacker may respond with legal Reactions but cannot play a second ordinary Attack until the first has fully resolved.

- A player may always decline to React. Silence is treated as a pass, not as a legally binding vow of nonviolence.

### Simultaneous Effects

- One player controls all simultaneous choices: that player chooses their order.

- Multiple players control effects: the active player resolves theirs first, then continue clockwise.

- Multiple Characters are KO'd simultaneously: resolve all KOs before checking victory.

- Damage and healing occur simultaneously only when one effect explicitly applies them together.

### Repeating Loops

| REPEATING LOOPS
If the same optional sequence can repeat indefinitely without a new card, resource, random result, or meaningful change in game state, that exact loop may resolve at most three times during the turn. After the third repetition, no part of that exact loop may start it again that turn. If a mandatory sequence would repeat forever and no player can legally stop it, resolve it three times, then end the loop. |
| --- |

| RULE PRIORITY
1. Scenario or mode rules override the core rules for that scenario. 2. Specific card text overrides general rules. 3. "Cannot" beats "can" — a permission does not bypass an explicit prohibition unless it names that prohibition. 4. Later effects override earlier effects when both modify the same value for the same duration. 5. Active-player ruling settles unresolved ambiguity for the current turn; record the question and decide a permanent interpretation after the game. |
| --- |

### Targets and Choices

- A card requiring a target cannot be played without a legal target.

- A card saying "choose up to" may choose zero.

- A random choice must use a die, shuffled tokens, or another method no player controls.

- You may not choose a KO'd, benched, Untargetable, or otherwise illegal Character unless the card explicitly allows it.

### Negotiation, Assistance, and Betrayal

Players may negotiate attacks, promises, and temporary alliances. Verbal deals are not binding unless a card or scenario creates a Binding Deal. Players may not trade cards, Focus, XP, Equipment, or trackers unless an effect specifically allows it. Betrayal is permitted; whining about betrayal is also permitted but has no timing priority.

| TABLE JUDGE PROCEDURE
Pause the game for no more than two minutes. Read the exact card text aloud, apply Rule Priority, and make a temporary ruling. Do not rewrite the entire game mid-turn. If someone throws a rice cracker, traditional law applies: they lose the argument. |
| --- |

## 16 Knockouts, Elimination & Ties

At 0 HP, your stance becomes extremely horizontal.

### Knockout Procedure

1. Reduce the Character to 0 HP. HP cannot become negative.

2. Finish resolving the effect that caused the KO, including simultaneous damage and after-hit text.

3. Award +2 XP to the player responsible for the final loss of HP. If no player caused it—such as a Location—the KO awards no bonus XP.

4. Discard all permanent Equipment attached to the KO'd Character and clear its temporary statuses.

5. Resolve "when KO'd" and "when you KO" effects using the normal timing rules.

6. Replace the fighter in Tag Team or eliminate the player if no conscious fighter remains.

7. Check victory after all KOs from the current effect are complete.

8. If the game continues, perform one Scene Change for all KOs caused by that effect.

### Healing at 0 HP

A KO'd Character cannot be healed unless an effect explicitly says Revive. Reviving sets the Character to the amount of HP printed by the effect; it does not restore discarded Equipment.

### Leaving the Game

- An eliminated player's hand, deck, discard pile, and Equipped cards leave the game.

- Cards that player owns but another player controls return to the box unless a card gives another instruction.

- Ongoing effects created by the eliminated player end unless they belong to a Location or scenario.

- In team play, eliminated teammates may advise only if the table allows ghost coaching. They may not reveal hidden cards they saw.

### Sudden-Death Tiebreaker

If the normal tiebreakers still produce a tie, tied players each reveal the top card of their deck. Highest Focus Cost wins. Repeat as needed; reshuffle when necessary. A Junk card has a cost of 0. If the universe produces an eternal tie, use Rock-Paper-Scissors and accept that destiny has spoken.

## 17 House Rules

House rules live under Rulings & Variants in the companion site: optional deviations kept clearly separate from official rulings and agreed before setup.

## 18 Glossary

The glossary lives in the dedicated Glossary section of the companion site: the Department’s attempt to define its own vocabulary before someone gives it a Combo tag.

## 19 Quick Reference

The Quick Start lives in the dedicated Quick Start section of the companion site: the field-reference version for delegations that would like to begin before the next inspection.

## Glossary

### Aftermath Combo

A learned Combo whose payoff resolves after its entire printed sequence resolves.

### Anytime

Timing that permits play between actions or in a Reaction Window when you have priority; never during another effect's resolution.

### Armor

Permanent Equipment that adds DEF only against its printed zone or zones. Armor is ignored by Piercing but not by effects that ignore only a Defense card.

### Attack

A legal strike played from hand with a target and declared zone. It contributes printed Attack Power and normally earns 1 XP after resolving.

### Attack Power

The attack-side combat total before Defense is subtracted: printed Attack Power, Character ATK, eligible Weapon bonuses, and modifiers.

### Belt Exam

The public certification task for your next Belt. Mark it PASSED when complete, then promote during Ascend after reaching the required XP.

### Blocked

An Attack that deals 0 damage after final Attack Power and Defense are compared.

### Boss Profile

A named Boss card that supplies ATK, DEF, Speed, stage fit, and one deterministic Boss Rule. It pairs with a Boss Stage; it does not use a hand, Focus, Equipment, or choices.

### Boss Stage

A Rival, Mini-Boss, or Final Boss overlay supplying HP, Attack Bonus, attack count, and stage rules.

### Combo

A learned sequence from the separate face-down Combo Deck. Complete its requirement and resolve its payoff.

### Consumable

One-use Equipment returned to the box or supply after resolving.

### Current Speed

Printed Speed plus active modifiers. Used for initiative, Tempo, Boss comparisons, and card effects unless text says printed Speed.

### Damage

HP lost after final Attack Power is reduced by final Defense, minimum 0. Damage prevention applies to this result unless an effect says otherwise.

### Defense

A Reaction card played against an incoming Attack. It must protect the declared zone and adds its printed Guard to the defender's combat total.

### Defense Practice

Once during your Yell, reveal one Defense from hand, place it in your play area, and gain its printed Focus. It is not played, resolves no text, grants no XP, satisfies no requirements, and is discarded during Hide.

### Destroy

Remove a card from the game to the public Destroyed pile.

### Direct Damage

HP loss that is not an Attack; it normally uses no ATK, Weapons, Tempo, Combo steps, Attack XP, or Defense window.

### Discard

Move a card to its appropriate face-up discard pile. Discarding is not Destroying and grants nothing unless an effect says so.

### Draw

Move the top card of your draw deck into your hand. If the deck empties during a draw, shuffle the discard pile only then and continue.

### Enraged

Solo Final Boss state at 30 HP or less; it makes two Boss Attacks during its Boss Turn.

### Equip

Place permanent Equipment from hand beside the active Character during Initiate, obeying every slot and Hand limit. A legal on-turn Equip generates printed Focus.

### Equipment

The umbrella card family containing permanent Weapons, Armor, and Gear plus one-use Consumables and Items. A card's subtype and timing determine how it is used.

### Exhaust

Turn a ready permanent Equipment card sideways to pay an exhaust cost. Passive text remains active unless the card says otherwise.

### Finishing Technique

The final required card or action in a Combo sequence.

### Flow

After the first Attack you play with Flow each turn resolves, draw one card. Later Flow Attacks that turn do not draw a card.

### Focus

Temporary purchasing power. Cards played or Equipped from hand during your own turn—and one Defense used for Defense Practice—generate Focus; spend it during Ascend and lose the remainder during Hide.

### Focus Cost

The amount of Focus required to buy a Market card or learn a revealed Combo. It is not a play cost or victory value.

### Focus Value

The Focus a card generates when legally played or Equipped from hand during your own turn, or when a Defense is used for Defense Practice.

### Golden Rule

When a card directly contradicts the rulebook, the card wins. If ambiguity remains after timing and priority, the active player makes a temporary ruling.

### Guard

The value a Defense card adds to final Defense against one Attack. Guard is not Character DEF or Armor DEF.

### Hand Size

The number of cards normally drawn during Hide: seven, or eight at Blue Belt. Retained or set-aside cards can make the resulting hand larger.

### Hit

An Attack that deals at least 1 damage after final Attack Power and Defense are compared.

### Interfere

A Reaction played by a bystander during another player's conflict.

### Junk

Starter-deck baggage with no useful printed effect. Bad Habit is Junk with printed Focus Value 0; once during your Yell each turn, you may discard one from hand to gain 1 Focus. It may still be counted, discarded, or Destroyed by specific effects.

### Kata

An on-turn Technique used for training, setup, card flow, Focus, Speed, or Flow. It is not an Attack or Defense unless an effect explicitly treats it as one.

### KO

A Character reaches 0 HP.

### Market

The persistent seven-card shared purchase area filled from one mixed deck. Replace each purchase immediately with the top Market card. If nobody buys during a complete round, Market Mercy refreshes all seven cards. Combos are separate.

### Market Mercy

The automatic full-row refresh after a complete round with no Market purchase. Discard all seven unpurchased cards and reveal seven replacements.

### Max HP

The highest current HP a Character may have. Belt certification does not raise it or heal a fighter.

### Modifier Combo

A learned Combo that changes its final required step before that step resolves.

### On Reveal

Text resolved immediately when a card enters play by being revealed, before its Ongoing text is used.

### Ongoing

A card or effect that remains active in play.

### Piercing X

Ignore X Armor DEF for an Attack; do not ignore Character DEF or a Defense card.

### Printed

The value or wording physically recorded on a card before modifiers. A copied or modified value is not printed unless an effect says it is.

### Reaction

A card or ability played during a specific response window.

### Ready

An Equipment card is ready when it is upright and may pay an exhaust cost. All of a player's exhausted Equipment becomes ready at that player's Initiate Phase.

### Reversal

Once per round, after a Defense you played Blocks an Attack, immediately play one Attack from hand against that attacker. It resolves normally outside your turn, cannot make another Reversal, and grants no Focus.

### Revive

Restore a KO'd Character to the printed HP amount without restoring discarded Equipment.

### Round

One Honor Phase plus every eligible player and Boss turn in the initiative order locked during Honor.

### Scene Change

After its triggering effect finishes, replace the current Location and resolve On Reveal.

### Slot

The Equipment position a permanent occupies, such as Head, Chest, Arms, Legs, Feet, Accessory, or one or two Hands. A Character cannot occupy the same limited slot twice unless an effect allows it.

### Status Effect

A named temporary condition created by a card or scenario, such as Disarmed or Untargetable. Its creating text supplies its duration and exact effect.

### Tag

During Initiate in a roster mode, replace the active Character with a conscious benched Character. Tagging does not change the locked initiative order or refresh Tempo.

### Tempo Advantage

Once per round, a faster active fighter may give their Attack +1 Attack Power or their Defense card +1 Guard against a slower opposing active fighter.

### Unblockable

Defense cards cannot be played; Character DEF and Armor still apply unless text says otherwise.

### XP

Permanent Experience used for Belt promotion and Black Belt Victory. XP is not spent.

### Zone

High, Mid, or Low. An Any Attack chooses one zone when declared; a Defense or Armor must match that declared zone unless text says otherwise.

## Official rulings

### Boss KO during your Yell Phase

DDB-RUL-001 · Filed Aug 27, 2026 · Boss Blitz

Finish only that player's Ascend and Hide Phases, then transition stages. Remaining players skip their turns for that round.

### Boss KO outside your own Yell Phase

DDB-RUL-002 · Filed Aug 27, 2026 · Boss Blitz

If the KO occurs during a player turn, that player may complete Ascend and Hide. Otherwise, transition immediately.

### Speed comparisons use current Speed

DDB-RUL-003 · Filed Aug 27, 2026 · Tempo

Tempo and other Speed comparisons use current Speed after active modifiers. Printed Speed is the base value.

### Initiative is locked for the round

DDB-RUL-004 · Filed Aug 27, 2026 · Timing

Honor determines initiative. Later Speed changes and tagging do not reorder turns until the next Honor Phase.

### Player wins a Speed tie with a Boss

DDB-RUL-005 · Filed Aug 27, 2026 · Boss Blitz

When a player and Boss have the same current Speed, the player acts before the Boss.

### Multiple learned Combos may share a finisher

DDB-RUL-006 · Filed Aug 27, 2026 · Combos

Multiple eligible learned Combos may use the same final card or action. Resolve each payoff separately and obey every printed timing limit.

### Co-op stage victory healing

DDB-RUL-007 · Filed Aug 27, 2026 · Co-op

After a Boss stage victory in two-player co-op, each player heals their active fighter 8 HP.

### Shared Rank team variant

DDB-RUL-008 · Filed Aug 27, 2026 · Team Variant

Teammates share XP, Belt, promotion tasks, and rewards. Each player keeps normal individual initiative.
