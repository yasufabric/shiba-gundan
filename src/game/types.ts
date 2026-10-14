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
  /** 0 なら揺られない。左右の振れ幅。 */
  slide: number
  /** ペアで揃える位相。 */
  phase: number
  /** 今の左右のずれ。1面は常に 0。 */
  shift: number
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
  /** 正面の盾。0 になるまで本体の体力は減らない。 */
  shield: number
  maxShield: number
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
  /** 揺れの基準位置。毎フレーム lane をここから足し直す。 */
  baseLane: number
}

export interface Boss {
  dist: number
  lane: number
  hp: number
  maxHp: number
  flash: number
  spawnedAt: number
  stoppedAt: number | null
  /** 最初の10秒で見せる小さなボス。倒してもクリアにならない。 */
  preview: boolean
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
  /** いちばん手前で生きているボス。描画とロケットの対象。 */
  boss: Boss | null
  bosses: Boss[]
  clearedAt: number | null
  catLeaks: number
  nextId: number
  cursor: number
  schedule: Spawn[]
  events: SimEvent[]
}
