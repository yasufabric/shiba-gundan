# Agent workflow

This repo is a phone-first crowd shooter, 柴犬軍団. One stage is the product. Do not add rules.

## Ship when it is ready

- After a focused play or feel change, run `npm test` and a phone-width check (390×844).
- If CI is green and the change does not regress sliding, gates, drums, the boss rocket, or the one-tap retry, open a PR. Do not merge unless the task says to.
- Prefer one concern per PR.

## Keep the sheet

- Tunable numbers live in `src/game/config.ts`. Stage 2 only raises those numbers.
- Do not add rules the sheet does not have. No coins, shops, levels beyond "a slightly harder next stage", or tutorial copy.
- A first visit needs no words. The army is already on the road, shooting forward. Sliding moves the whole formation left and right. It advances on its own.
- Start with 1 mameshiba. Gates are blue (`+`, `×`) or red (`−`, `÷`). Each bullet that hits a gate adds 1 to its number. Keep shooting a red gate and it turns blue. At the dog count a good route has when the first red gate arrives, that flip takes about 2.5 seconds. The gate flashes and bounces when the number changes. The first two pairs are blue on both sides and raise the count even if no bullet hits them. Red gates and ÷ gates appear only after 15 seconds.
- A drum sometimes sits in front of the better gate. Shooting breaks it. Walking into it removes dogs.
- Bullets fly only across the formation, not the whole road. Formation width stops at one third of the road; extra dogs lengthen the formation backward. Draw at most 80 dogs. Past that, pack them tighter and enlarge the count above the formation.
- Cat hordes come from the front. Size and HP are fixed for the count a normal route would have. They do not grow when the player has more dogs. Only a cat that overlaps the formation takes 1 dog. A good route still loses about 10–20% of its dogs to each horde. A route that misses about half the gates loses about 30% per horde. Standing still does not lose dogs in the first 15 seconds, then loses. Choosing the gates well reaches a few hundred dogs and clears the boss.
- The boss is last. During that fight, tapping the captain icon fires a rocket. Clearing opens a slightly harder next stage. Later stages may raise cat and boss numbers.
- Dogs also drop when a drum is not broken before the formation hits it. Threats come from in front of the screen.
- Zero mameshiba is a loss. One tap retries the same stage.
- The captain is the muscle shiba from hirari2 (the same pictures as deep-three): orange fur, cream muzzle, green tank, black shorts. Beans are that picture, smaller. Cats are original. No real athletes or existing characters.
- SFX are Web Audio only. No audio files. Resume `AudioContext` inside the first touch.
- Mute is the only stored preference. Progress is not saved.
