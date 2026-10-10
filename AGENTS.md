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
- Start with 5 mameshiba. The first gate pair is blue on both sides (`+5` and `×2`); from 5 dogs both end at 10. Later pairs must change the result, and the better side alternates.
- A gate pair about every 5 seconds. Red gates (`−5`, `武器↓`) spawn only after 15 seconds.
- Two crates: one in the first 20 seconds, another by 40 seconds, so the weapon can reach its max before the boss.
- The boss spawns around 45 seconds. With the max weapon and the better gates, it dies in about 10 seconds.
- Stage 1 cat pressure stays low enough that missing about half the gates still clears. Tightness starts at stage 2.
- Dogs drop only when a cat overlaps the formation or a red gate is passed. Both come from in front of the screen. Nothing punishes from off screen.
- Weapon steps are 豆鉄砲, 連射, 3方向撃ち. A crate raises one step. `武器↓` lowers one step, and it does not go below 0.
- Zero mameshiba is a loss. One tap retries the same stage. Clearing the boss opens the next stage.
- The captain is the muscle shiba from hirari2 (the same pictures as deep-three): orange fur, cream muzzle, green tank, black shorts. Beans are that picture, smaller. Cats are original. No real athletes or existing characters.
- SFX are Web Audio only. No audio files. Resume `AudioContext` inside the first touch.
- Mute is the only stored preference. Progress is not saved.
