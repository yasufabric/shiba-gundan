import { Game, type Stage } from './game/Game'

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} not found`)
  return el as T
}

const stage: Stage = {
  canvas: must<HTMLCanvasElement>('game'),
  frame: must('frame'),
  mute: must<HTMLButtonElement>('mute'),
  live: must('live'),
}

new Game(stage).start()
