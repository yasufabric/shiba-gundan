import { Game, type Stage } from './game/Game'
import { lockTouch } from './touchLock'

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} not found`)
  return el as T
}

lockTouch()

const stage: Stage = {
  canvas: must<HTMLCanvasElement>('game'),
  frame: must('frame'),
  mute: must<HTMLButtonElement>('mute'),
  rocket: must<HTMLButtonElement>('rocket'),
  live: must('live'),
}

new Game(stage).start()
