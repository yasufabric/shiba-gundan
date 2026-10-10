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
- The boss spawns around 45 seconds. Its HP does not depend on the weapon you arrived with. Boss damage is mostly the weapon tier; dog count adds only a little. The weakest weapon takes about 25 seconds with 10 dogs and about 18 seconds with 50. The max weapon takes about 6 seconds with 50 dogs. Later stages may raise that HP, but the weakest weapon must still be able to finish the fight.
- After the boss stops, it drops a paw stamp on the left or right lane every 2–3 seconds. The side is random, and the same side never lands three times in a row. A shadow marks the spot 0.8 seconds ahead. A hit removes 5 dogs, and the count can reach 0.
- Cats arrive as low-HP hordes of 10–20, packed in three staggered rows across the width of the road and a bit smaller than a lone cat, so the whole clump is on screen together. One cat still removes one dog. Stage 1 stays clearable if about half the gates are missed and the stamps are dodged. Standing still, or taking every worse gate, loses. Tightness starts at stage 2.
- Dogs drop when a cat overlaps the formation, a red gate is passed, or a paw stamp lands on the squad. All of these come from in front of the screen. Nothing punishes from off screen.
- Weapon steps are 豆鉄砲, 連射, 3方向撃ち. A crate raises one step. `武器↓` lowers one step, and it does not go below 0.
- Zero mameshiba is a loss. One tap retries the same stage. Clearing the boss opens the next stage.
- The captain is the muscle shiba from hirari2 (the same pictures as deep-three): orange fur, cream muzzle, green tank, black shorts. Beans are that picture, smaller. Cats are original. No real athletes or existing characters.
- SFX are Web Audio only. No audio files. Resume `AudioContext` inside the first touch.
- Mute is the only stored preference. Progress is not saved.
