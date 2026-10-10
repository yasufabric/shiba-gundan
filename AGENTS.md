# Agent workflow

This repo is a phone-first crowd shooter, 柴犬軍団. One stage is the product. Do not add rules.

## Ship when it is ready

- After a focused play or feel change, run `npm test` and a phone-width check (390×844).
- If CI is green and the change does not regress sliding, gates, the weapon crates, the boss, or the one-tap retry, open a PR. Do not merge unless the task says to.
- Prefer one concern per PR.

## Keep the sheet

- Tunable numbers live in `src/game/config.ts`. Stage 2 only raises those numbers.
- Do not add rules the sheet does not have. No coins, shops, levels beyond "a slightly harder next stage", or tutorial copy.
- A first visit needs no words. The army is already on the road, shooting forward. Sliding moves the whole formation.
- Start with 5 mameshiba. Every gate pair is two different gains, and the sides alternate. One side is `+2` dogs. The other is `武器↑`. There are no red gates.
- A gate pair about every 5 seconds.
- Two crates: one in the first 20 seconds, another by 40 seconds, so the weapon can reach its max before the boss.
- The boss spawns around 45 seconds. Its HP does not depend on the weapon you arrived with. Boss damage is mostly the weapon tier; dog count adds only a little. With cats removed, the weakest weapon takes about 25 seconds with 10 dogs and about 17 seconds with 50. The max weapon takes about 7 seconds with 50 dogs. Later stages may raise that HP.
- After the boss stops, it drops a paw stamp on the left or right lane every 2–3 seconds. The side is random, and the same side never lands three times in a row. A shadow marks the spot 0.8 seconds ahead. A hit removes the larger of “ceil(current dogs / 4)” and 5, and the count can reach 0.
- Cats arrive as hordes of 10–20 in one row from edge to edge, bodies overlapping so the road is blocked. Sliding does not open a gap. A cat that is still alive when it reaches the front takes exactly 1 dog, wherever it is in the lane, and both burst together. On stage 1, taking every dog gate or every weapon gate wins if the stamps are dodged, with dogs left in the teens or low teens. Standing still loses. Eating every stamp loses.
- Dogs drop when a cat reaches the front or a paw stamp lands on the squad. All of these come from in front of the screen. Nothing punishes from off screen.
- Weapon steps are 豆鉄砲, 連射, 3方向撃ち. 連射 fires faster at the same per-shot cat damage. 3方向撃ち hits harder and fires three pellets. A crate raises one step. At max weapon, `武器↑` adds 1 dog instead of doing nothing, and the label becomes `+1`.
- Zero mameshiba is a loss. One tap retries the same stage. Clearing the boss opens the next stage.
- The captain is the muscle shiba from hirari2 (the same pictures as deep-three): orange fur, cream muzzle, green tank, black shorts. Beans are that picture, smaller. Cats are original. No real athletes or existing characters.
- SFX are Web Audio only. No audio files. Resume `AudioContext` inside the first touch.
- Mute is the only stored preference. Progress is not saved.
