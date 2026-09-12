import fs from "node:fs";

const path = "app/playtest.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceExactlyOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(before, after);
}

replaceExactlyOnce(
`      if (ai.hand.includes(reaction.id)) {
        ai = stage3cConsumeDefenseStatuses(markCompletedTask({
          ...ai,
          hand: removeOne(ai.hand, reaction.id),
          discard: [...ai.discard, reaction.id],
          xp: ai.xp + 1,
          defendedThisRound: true,
          playedDefenseSinceLastTurn: true,
          nextDefenseCardBonus: 0,
        }));
      }`,
`      if (ai.hand.includes(reaction.id)) {
        ai = {
          ...ai,
          hand: removeOne(ai.hand, reaction.id),
          discard: [...ai.discard, reaction.id],
        };
      }`,
"player Air Horn cancels AI Defense",
);

replaceExactlyOnce(
`        const cancelledPlayer = stage3cConsumeDefenseStatuses(markCompletedTask({
          ...current.player,
          hand: removeOne(current.player.hand, defenseCard.id),
          discard: [...current.player.discard, defenseCard.id],
          xp: current.player.xp + 1,
          defendedThisRound: true,
          playedDefenseSinceLastTurn: true,
          nextDefenseCardBonus: 0,
        }));`,
`        const cancelledPlayer: Board = {
          ...current.player,
          hand: removeOne(current.player.hand, defenseCard.id),
          discard: [...current.player.discard, defenseCard.id],
        };`,
"AI Air Horn cancels player Defense",
);

fs.writeFileSync(path, source);
console.log("Separated canceled Defense spending from resolved Defense/Block lifecycle.");
