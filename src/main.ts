import { Game, type Stage } from './game/Game'
import { lockTouch } from './touchLock'

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} not found`)
  return el as T
}

const stage: Stage = {
  canvas: must<HTMLCanvasElement>('game'),
  frame: must('frame'),
  mute: must<HTMLButtonElement>('mute'),
  rocket: must<HTMLButtonElement>('rocket'),
  live: must('live'),
}

const game = new Game(stage)
// touchend の preventDefault より先に解錠する。iOS は touchstart では音を開かない。
const unlock = () => game.unlockAudio()
document.addEventListener('touchend', unlock, { capture: true })
document.addEventListener('pointerup', unlock, { capture: true })
lockTouch()
game.start()
