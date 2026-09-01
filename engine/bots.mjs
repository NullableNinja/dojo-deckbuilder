const number = (value) => Number.parseInt(String(value ?? 0), 10) || 0;
export const STRATEGIES = ["balanced", "aggression", "economy", "fortress"];
export const attackPower = (card) => number(card.stats?.["Attack Power"]);
export const guard = (card) => number(card.stats?.Guard);
export const focus = (card) => number(card.focusValue);
export const cost = (card) => number(card.fpCost);
export function cardScore(card, strategy="balanced") {
  const weights = strategy === "aggression" ? [4,1,1] : strategy === "economy" ? [1,1,5] : strategy === "fortress" ? [1,4,2] : [3,2,3];
  return attackPower(card)*weights[0] + guard(card)*weights[1] + focus(card)*weights[2] - cost(card)*.25 + (card.rulesText?.match(/draw 1/i)?2:0);
}
export const chooseAttack = (hand, strategy) => hand.filter((c)=>attackPower(c)>0).sort((a,b)=>cardScore(b,strategy)-cardScore(a,strategy))[0] ?? null;
export const chooseDefense = (hand) => hand.filter((c)=>guard(c)>0).sort((a,b)=>guard(b)-guard(a))[0] ?? null;
export const choosePractice = (hand, strategy) => hand.filter((c)=>guard(c)>0).sort((a,b)=>focus(b)-focus(a) || cardScore(a,strategy)-cardScore(b,strategy))[0] ?? null;
export const choosePurchase = (market, available, strategy) => market.filter((c)=>cost(c)<=available).sort((a,b)=>cardScore(b,strategy)-cardScore(a,strategy) || cost(b)-cost(a))[0] ?? null;
