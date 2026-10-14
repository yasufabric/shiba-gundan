import { FORMATION, LOOK, SPAWN_DIST, VIEW_H, VIEW_W } from './config'
import { countFontSize, formationHalf } from './rules'

export interface Projected {
  x: number
  y: number
  scale: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** dist 0 が隊長の足もと、正が奥。画面の y は下が手前。 */
export function project(lane: number, dist: number): Projected {
  const curve = dist <= 0 ? (dist / SPAWN_DIST) * LOOK.behind : Math.pow(Math.min(dist / SPAWN_DIST, 1.25), LOOK.curve)
  const y = LOOK.captainY + (LOOK.horizonY - LOOK.captainY) * curve
  const widthT = Math.min(1, Math.max(0, (curve + 0.22) / 1.22))
  const half = lerp(LOOK.halfNear, LOOK.halfFar, widthT)
  const scaleT = Math.min(1, Math.max(0, curve))
  const scale = dist <= 0 ? LOOK.scaleNear * (1 - dist * 0.0035) : lerp(LOOK.scaleNear, LOOK.scaleFar, scaleT)
  return {
    x: VIEW_W / 2 + lane * half,
    y,
    scale,
  }
}

export interface LabelRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 頭上の匹数。数字1字をフォント幅で見て、左右とも画面の中に収める。
 * anchorTop は隊長の絵の上端。
 */
export function troopLabelRect(anchorX: number, anchorTop: number, digits: number, fontSize: number): LabelRect {
  const margin = FORMATION.labelMargin
  const textW = Math.max(1, digits) * fontSize
  const w = Math.max(fontSize, textW + fontSize * 0.35)
  const h = fontSize * 1.15
  const maxX = Math.max(margin, VIEW_W - margin - w)
  let x = Math.max(margin, Math.min(maxX, anchorX - w / 2))
  let y = anchorTop - FORMATION.labelGap - h
  y = Math.max(margin, Math.min(VIEW_H - margin - h, y))
  const rocket = { x: VIEW_W - 90, y: VIEW_H - 104, w: 76, h: 76 }
  const overlaps = x < rocket.x + rocket.w && x + w > rocket.x && y < rocket.y + rocket.h && y + h > rocket.y
  if (overlaps) x = Math.max(margin, Math.min(maxX, rocket.x - margin - w))
  return { x, y, w, h }
}

/** クリア中に隊長の頭上へ出る匹数。描画と同じ式。 */
export function armyCountBox(input: {
  dogs: number
  lane: number
  phase: string
  time: number
  numPop: number
  recoil: number
}): LabelRect {
  const jump = input.phase === 'clear' ? Math.abs(Math.sin(input.time * 7)) * 16 : 0
  const captain = project(input.lane, 0)
  const height = LOOK.captainH * (1 + input.recoil * 0.06)
  const pop = 1 + input.numPop * 0.35
  const fontSize = countFontSize(input.dogs) * pop
  return troopLabelRect(captain.x, captain.y - height - jump, String(Math.max(0, Math.floor(input.dogs))).length, fontSize)
}

/** クリアの文字。残り秒はこの半分より外側へ膨らむ。 */
export const CLEAR_WORD = { font: 64, stroke: 10 }
export const CLEAR_SCORE = { font: 48, stroke: 8 }
export const CLEAR_PULSE_MAX = 1.04
const GLYPH_HALF = 0.68

export function textHalf(font: number, stroke: number, pulse = 1): number {
  return (font * GLYPH_HALF + stroke / 2) * pulse
}

/**
 * クリアの見出しと残り秒。頭上の匹数より上に置き、最大の脈動でも重ならない。
 * labelTop は armyCountBox の上端。
 */
export function clearReadout(labelTop: number): { wordY: number; scoreY: number } {
  const gap = 18
  const scoreHalf = textHalf(CLEAR_SCORE.font, CLEAR_SCORE.stroke, CLEAR_PULSE_MAX)
  const wordHalf = textHalf(CLEAR_WORD.font, CLEAR_WORD.stroke, CLEAR_PULSE_MAX)
  const scoreY = labelTop - gap - scoreHalf
  const wordY = scoreY - gap - scoreHalf - wordHalf
  return { wordY, scoreY }
}

/** 横幅は道の3分の1で止める。あふれた豆柴は後ろへ列を足す。80匹を超えた分は間隔を詰める。 */
export function beanOffsets(dogs: number, spread: number): { lane: number; dist: number }[] {
  const count = Math.min(FORMATION.drawMax, Math.max(0, Math.floor(dogs)))
  const tight = dogs <= FORMATION.drawMax ? 1 : Math.max(FORMATION.packMin, FORMATION.drawMax / Math.max(1, dogs))
  const half = formationHalf(Math.max(dogs, 1)) * spread * tight
  const perRow = Math.max(1, Math.min(count, Math.floor((half * 2) / (FORMATION.body * tight)) || 1))
  const slots: { lane: number; dist: number }[] = []
  let left = count
  let row = 0
  while (left > 0) {
    const rowCount = Math.min(left, perRow)
    for (let i = 0; i < rowCount; i += 1) {
      const u = rowCount === 1 ? 0 : (i / (rowCount - 1)) * 2 - 1
      slots.push({
        lane: u * half,
        dist: -16 - row * FORMATION.rowGap * tight,
      })
    }
    left -= rowCount
    row += 1
  }
  return slots
}
