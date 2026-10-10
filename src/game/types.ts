import type { GateDef } from './config'
import type { Spawn } from './level'

export type Phase = 'play' | 'clear' | 'lose'
export type GateTone = 'blue' | 'red'

export interface Gate {
  id: number
  pairId: number
  side: -1 | 1
  dist: number
  op: GateDef
  passed: boolean
  flash: number
  /** 数字が変わったときの跳ね。1 で最大。 */
  pop: number
  /** ドラム缶を壊さずに通り過ぎた側は、もう弾が数字を増やさない。 */
  sealed: boolean
}

export interface Cat {
  id: number
  lane: number
  dist: number
  hp: number
  maxHp: number
  brute: boolean
  variant: number
  flash: number
  alive: boolean
}

export interface Drum {
  id: number
  side: -1 | 1
  lane: number
  dist: number
  hp: number
  maxHp: number
  alive: boolean
  flash: number
}

export interface Boss {
  dist: number
  hp: number
  maxHp: number
  flash: number
  spawnedAt: number
  stoppedAt: number | null
}

export interface Bullet {
  kind: 'pellet' | 'rocket'
  lane: number
  dist: number
  damage: number
  bossDamage: number
  alive: boolean
}

export type SimEvent =
  | { type: 'shoot' }
  | { type: 'hit'; lane: number; dist: number; target: 'cat' | 'drum' | 'gate' | 'boss' }
  | { type: 'cat-down'; lane: number; dist: number; brute: boolean }
  | { type: 'gate-bump'; lane: number; dist: number; label: string; tone: GateTone; flipped: boolean }
  | { type: 'gate'; good: boolean; lane: number; dist: number; dogsAfter: number; label: string }
  | { type: 'drum'; lane: number; dist: number }
  | { type: 'hurt'; lane: number; dist: number; loss: number }
  | { type: 'rocket' }
  | { type: 'boss-down' }
  | { type: 'lose' }

export interface Sim {
  stage: number
  time: number
  phase: Phase
  dogs: number
  lane: number
  fireCd: number
  rocketCd: number
  gates: Gate[]
  cats: Cat[]
  drums: Drum[]
  bullets: Bullet[]
  boss: Boss | null
  clearedAt: number | null
  catLeaks: number
  nextId: number
  cursor: number
  schedule: Spawn[]
  events: SimEvent[]
}
