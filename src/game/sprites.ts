import dizzyUrl from '../assets/shiba/shiba-dizzy.png'
import idleUrl from '../assets/shiba/shiba-idle.png'
import leftUrl from '../assets/shiba/shiba-left.png'
import rightUrl from '../assets/shiba/shiba-right.png'

export interface SpriteSet {
  idle: HTMLImageElement
  left: HTMLImageElement
  right: HTMLImageElement
  dizzy: HTMLImageElement
}

function load(src: string): HTMLImageElement {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  return img
}

/** 隊長は deep-three と同じマッスル柴（hirari2）。 */
export function loadSprites(): SpriteSet {
  return {
    idle: load(idleUrl),
    left: load(leftUrl),
    right: load(rightUrl),
    dizzy: load(dizzyUrl),
  }
}
