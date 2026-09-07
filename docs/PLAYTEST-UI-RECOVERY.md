# Quick Duel UI Recovery — 50 Implemented Improvements

Scope: restore a playable, non-overlapping Quick Duel interface without changing card effects or combat rules. The list below is both the audited recommendation set and the implementation ledger for this pass.

## Cascade and layout ownership

1. **Retire the late external hotfix link.** The HTML shell no longer loads a stylesheet after the Vite bundle, so source order is deterministic.
2. **Neutralize the legacy hotfix asset.** The old public file remains inert so a cached HTML shell cannot restore viewport-fixed gameplay panels during deployment.
3. **Bundle one final recovery layer.** `playtest-functional-recovery.css` loads last from the application entry point.
4. **Establish one live-shell geometry contract.** The recovery layer owns the HUD, arena, action bar, hand, and utility order.
5. **Return the game to document flow.** The page grows naturally instead of pretending every surface fits in one fixed-height canvas.
6. **Prevent page-wide horizontal overflow.** The shell and hosting frame clip stray inline overflow while local rails retain their own scrolling.
7. **Replace extreme gameplay z-indexes with a small scale.** Ordinary panels use normal stacking; only sticky HUD, VFX, dialogs, and results rise above them.
8. **Remove the post-render DOM mutation patcher.** Combo and fighter presentation now render declaratively through React.

## HUD and fighter boards

9. **Add a semantic player HUD summary.** The top bar now contains the player's name and Belt rather than a CSS pseudo-label.
10. **Add a semantic opponent HUD summary.** The opponent receives the same stable, readable treatment.
11. **Show exact HP in both HUD summaries.** Current and maximum HP remain readable without hunting through the board.
12. **Add proportional HUD health bars.** Each bar is a real progress indicator with accessible numeric values.
13. **Make the HUD sticky without removing it from flow.** It stays useful while scrolling and still reserves its own space.
14. **Use the HUD as the only health-bar surface.** The duplicate card health track is suppressed while exact HP remains accessible in the full-width top bar.
15. **Restore the fighter-card grid.** Name, art, ATK, DEF, SPD, Focus, XP, ability, and Loadout occupy dedicated non-overlapping rows.
16. **Protect fighter headings from clipping.** Long fighter names truncate inside their own heading instead of crossing the Belt badge or flavor copy.
17. **Contain fighter art inside the illustration window.** Transparent character art scales by `object-fit` and cannot spill into adjacent panels.
18. **Give long abilities an internal scroll area.** Rules copy remains available without changing fighter-card height.
19. **Keep the Loadout and Combo launchers inside the fighter card.** Both have dedicated bottom-row targets and no hover panel can cover combat.

## Arena, Scene, and combat record

20. **Stabilize the three-column combat table.** Player, stage, and opponent use bounded columns with one shared height.
21. **Use an adaptive but bounded arena height.** Fighter boards and the combat stage align, with a compact-height treatment for common laptop screens.
22. **Remove accidental fighter-column scroll ownership.** Columns no longer create hidden independent page scroll traps.
23. **Guard the center stage against min-content overflow.** Long card and Scene text cannot widen the whole page.
24. **Remove the persistent Market rail from live combat.** It no longer consumes the vertical space needed to see the playable hand and combat animation together.
25. **Keep acquisition in the Ascend desk.** The complete seven-card Market, featured Combo, and Belt review remain available when the game asks for an Ascend decision.
26. **Keep all seven Market slots reachable.** The Ascend desk has a bounded horizontal Market rail at narrow widths.
27. **Keep both Combo and Belt dockets reachable from the board.** The player-side Combo launcher and Ascend review open the appropriate decision surface without a persistent middle panel.
28. **Retain usable acquisition targets.** Ascend, Market, Combo, and Belt actions keep their minimum interactive sizes.
29. **Rename the active label to “Current Scene.”** The board now uses the player's preferred, more vivid vocabulary.
30. **Enlarge the active Scene name.** It now reads as a major state element rather than a muted subheading.
31. **Place the Scene rule on a contrasting paper slip.** The active modifier is readable at a glance.
32. **Give each Scene family a themed edge accent.** Cool, concrete, civic, retail, and dojo locations gain distinct restrained color cues.
33. **Reserve the center viewport lane for Scene Change.** Its cue now appears in one deterministic position regardless of scroll.
34. **Bound the clash grid.** Declaration, seal, and response cards cannot expand beyond the combat stage.
35. **Fit stage card artwork within its slots.** Card visuals crop or contain without covering labels or the combat seal.
36. **Keep all three combat zones readable.** The zone row retains a consistent minimum height.
37. **Strengthen the active-zone contrast.** The hot zone now has a clear red-and-gold selected state.
38. **Make both filed-card ledgers independently scrollable.** Long turn histories stay in one row and never widen the stage.
39. **Bound the impact receipt.** Large exchange notes scroll inside the receipt instead of covering the next surface.
40. **Make selected hand cards unmistakable.** A stronger gold ring and offset red shadow identify the pending choice.

## Actions, hand, utilities, dialogs, and VFX

41. **Place the phase action dock in the hand header.** Legal progression controls stay with the playable cards instead of taking a separate page row.
42. **Keep the primary action dock in normal flow.** It cannot cover cards, fighter boards, or the Scene at any scroll position.
43. **Use compact action targets in the hand header.** Phase progression stays comfortably clickable while preserving hand space.
44. **Allow action groups to adapt.** Long phase labels and multiple legal actions remain reachable at narrower widths.
45. **Make the hand visible immediately after combat.** Removing the live Market rail and shortening the desktop card rail reduces the scroll distance to a small handoff.
46. **Give the hand a visible, snap-assisted horizontal rail.** Every card remains reachable while retaining its art, cost, Focus, zone, and rules summary.
47. **Keep utilities and dark-theme contrast stable.** Coach, log, motion, navigation, and sync controls remain in flow, while dark surfaces preserve readable borders and disabled-card contrast.
48. **Fit Ascend and inspectors to the viewport.** Dialogs own their scrolling, suppress horizontal spill, and retain reachable close/actions.
49. **Give player and opponent combat cues fixed viewport lanes.** Attack, Block, damage, Tempo, and summary notices no longer use scrolled element rectangles.
50. **Give milestone cues a fixed center lane and serialized replacement.** KO, Scene Change, Combo, and promotion stay centered while newer actions replace stale queued visuals.

## Audit baseline

- GitHub `main` audited at `6063d98e137fa6b6ed2f6398af24a76cd35bb83b`.
- Baseline repository gate: 227 tests passing before UI recovery.
- Live-browser audit covered setup, Initiate, Yell, attack declaration, block resolution, Ascend Market, nested inspection, Combo/Belt navigation, and the defense window.
- Primary failure: acquisition, action, utility, HUD, and fighter HP rules had accumulated contradictory fixed-position overrides across many late cascade layers.
- Card-effect implementation is intentionally outside this recovery scope.
