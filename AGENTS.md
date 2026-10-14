# Agent workflow

This repo is a phone-first crowd shooter, 柴犬軍団. One stage is the product. Do not add rules.

## Ship when it is ready

- After a focused play or feel change, run `npm test` and a phone-width check (390×844).
- If CI is green and the change does not regress sliding, gates, drums, the boss rocket, or the one-tap retry, open a PR. Do not merge unless the task says to.
- Prefer one concern per PR.

## Keep the sheet

- Tunable numbers live in `src/game/config.ts`. Stage 1 stays on that sheet. Stage 2 adds sliding gates, stage 3 adds shield cats, stage 4 adds a second boss, and stage 5 onward stacks those and raises horde and boss HP slightly. Each new element appears once in a safe form during the first 10 seconds, then for real later.
- Do not add rules the sheet does not have. No coins, shops, or tutorial copy. The title is a stage number and always starts at stage 1. The highest stage reached is the only saved progress besides mute.
- A first visit needs no words. The army is already on the road, shooting forward. Sliding moves the whole formation left and right. It advances on its own.
- Start with 1 mameshiba. Gates are blue (`+`, `×`) or red (`−`, `÷`). Each bullet that hits a gate adds 1 to its number. Keep shooting a red gate and it turns blue. At the dog count a good route has when the first red gate arrives, that flip takes about 2.5 seconds. The gate flashes and bounces when the number changes. The first two pairs are blue on both sides and raise the count even if no bullet hits them. Red gates appear only after 15 seconds. After 15 seconds a × gate stops at ×2, even if you keep shooting it.
- A drum sometimes sits in front of the better gate. Shooting breaks it. Walking into it removes dogs.
- Bullets fly only across the formation, not the whole road. Formation width stops at one third of the road; extra dogs lengthen the formation backward. Draw at most 80 dogs. Past that, pack them tighter and enlarge the count above the formation.
- Cat hordes come from the front. The late hordes share one fixed size chosen for a 300-dog army. They do not grow when the player has more dogs. Only a cat that overlaps the formation takes 1 dog. A good route still loses about 10–20% of its dogs to each horde and arrives at the boss with about 300. A route that misses about half the gates loses at least 30% per horde and arrives with about 150. Standing still does not lose dogs in the first 15 seconds, then loses. Even the route that takes every best grown gate and breaks every drum on that path stays at or under 400 dogs before the boss.
- The boss is last. It walks toward the army and reaches it in about 20 seconds. If it is still alive when it arrives, you lose. About 300 dogs defeat it in about 12 seconds. About 150 dogs defeat it just before it arrives. During that fight, tapping the captain icon fires a rocket. A short clear screen then starts the next stage with 1 dog. One tap retries the same stage after a loss. The stage number is on the HUD.
- Dogs also drop when a drum is not broken before the formation hits it. Threats come from in front of the screen.
- Zero mameshiba is a loss. One tap retries the same stage.
- The captain is the muscle shiba from hirari2 (the same pictures as deep-three): orange fur, cream muzzle, green tank, black shorts. Beans are that picture, smaller. Cats are original. No real athletes or existing characters.
- SFX and music are Web Audio only. No audio files. Create and resume `AudioContext` on the first gesture. Schedule music on `currentTime` with a lookahead, not with `setInterval`. Suspend the context while the page is hidden and resume it when visible. The march is about 132 BPM. The boss loop gets faster and adds layers as the boss gets closer. Clear and loss each play a short jingle.
- Mute is stored. The highest stage reached is stored. The title still starts at stage 1.
