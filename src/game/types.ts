import type { GateDef } from './config'
import type { Spawn } from './level'

export type WeaponLevel = 0 | 1 | 2
export type Phase = 'play' | 'clear' | 'lose'
export type GateTone = 'blue' | 'red'

export interface Army {
  dogs: number
  weapon: WeaponLevel
}

export interface Gate {
  id: number
  pairId: number
  side: -1 | 1
  dist: number
  op: GateDef
  passed: boolean
  flash: number
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

export interface Crate {
  id: number
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
  stampCd: number
  stampIndex: number
  /** 直近の落下側。同じ側が3回続かないように見る。 */
  stampSides: Array<-1 | 1>
}

export interface Stamp {
  side: -1 | 1
  lane: number
  warn: number
  slam: number
  resolved: boolean
}

export interface Bullet {
  lane: number
  dist: number
  laneVel: number
  damage: number
  bossDamage: number
  weapon: WeaponLevel
  pellet: number
  alive: boolean
}

export type SimEvent =
  | { type: 'shoot'; weapon: WeaponLevel }
  | { type: 'hit'; lane: number; dist: number; target: 'cat' | 'crate' | 'boss' }
  | { type: 'cat-down'; lane: number; dist: number; brute: boolean }
  | { type: 'gate'; good: boolean; lane: number; dist: number; dogsAfter: number; label: string }
  | { type: 'crate'; lane: number; dist: number; weapon: WeaponLevel }
  | { type: 'hurt'; lane: number; dist: number }
  | { type: 'stamp'; lane: number; side: -1 | 1; hit: boolean }
  | { type: 'boss-down' }
  | { type: 'lose' }

export interface Sim {
  stage: number
  time: number
  phase: Phase
  dogs: number
  weapon: WeaponLevel
  lane: number
  fireCd: number
  gates: Gate[]
  cats: Cat[]
  crates: Crate[]
  bullets: Bullet[]
  stamps: Stamp[]
  boss: Boss | null
  clearedAt: number | null
  catLeaks: number
  nextId: number
  cursor: number
  schedule: Spawn[]
  events: SimEvent[]
}
