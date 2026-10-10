/**
 * 柴犬軍団の調整用数字。遊びの数値はここだけを変える。
 * 1ステージ目の並びはゲームデザイナーの試作シートどおり。
 */

export const VIEW_W = 390
export const VIEW_H = 844

/** 豆柴の初期匹数。隊長はこの数に含まれない。 */
export const START_DOGS = 5
export const START_WEAPON = 0
export const START_LANE = 0

/** 画面奥から手前へ流れる速さ。大きいほど短い時間で到達する。 */
export const SCROLL_SPEED = 280
/** 物体が湧く距離。プレイヤーは 0。画面の外、奥から来る。 */
export const SPAWN_DIST = 920
export const PLAYER_CLEARANCE = 26

export const LANE_SPEED = 5.2

export const BULLET_SPEED = 700
export const BULLET_START = 42
export const BULLET_HIT_DIST = 36
export const BULLET_HIT_LANE = 0.05
export const MAX_STREAMS = 10
export const MAX_BULLETS = 280

/**
 * 1発の威力は匹数の弱い累乗。
 * 最大武器・良い門取り（約61匹）でボスが約10秒になるよう BOSS_HP と対にする。
 */
export const DOG_POWER_EXP = 0.37

export const WEAPONS = [
  { name: '豆鉄砲', interval: 0.32, pellets: 1, spread: 0 },
  { name: '連射', interval: 0.13, pellets: 1, spread: 0 },
  { name: '3方向撃ち', interval: 0.15, pellets: 3, spread: 0.55 },
] as const

export const FORMATION = {
  halfBase: 0.16,
  halfPerDog: 0.01,
  halfMax: 0.42,
  showMax: 22,
  catBody: 0.1,
}

export interface GateDef {
  kind: 'add' | 'mul' | 'weapon'
  amount: number
}

export interface GatePairDef {
  time: number
  left: GateDef
  right: GateDef
}

/** 出現時刻。到達はおよそ time + SPAWN_DIST / SCROLL_SPEED 秒後。 */
export const GATE_PAIRS: readonly GatePairDef[] = [
  { time: 5, left: { kind: 'add', amount: 5 }, right: { kind: 'mul', amount: 2 } },
  { time: 10, left: { kind: 'mul', amount: 2 }, right: { kind: 'add', amount: 3 } },
  { time: 15, left: { kind: 'add', amount: 2 }, right: { kind: 'add', amount: 5 } },
  { time: 20, left: { kind: 'add', amount: 10 }, right: { kind: 'add', amount: -5 } },
  { time: 25, left: { kind: 'weapon', amount: -1 }, right: { kind: 'add', amount: 6 } },
  { time: 30, left: { kind: 'add', amount: 8 }, right: { kind: 'add', amount: -5 } },
  { time: 35, left: { kind: 'weapon', amount: -1 }, right: { kind: 'add', amount: 8 } },
  { time: 40, left: { kind: 'add', amount: 4 }, right: { kind: 'add', amount: -5 } },
]

export const GATE_INTERVAL = 5
export const RED_GATE_AFTER = 15

export interface CatDef {
  time: number
  lane: number
  hp: number
  brute: boolean
}

/** 1ステージ目。序盤は薄く、門の選択を邪魔しない位置に置く。 */
export const CATS: readonly CatDef[] = [
  { time: 1.55, lane: -0.06, hp: 6, brute: false },
  { time: 1.85, lane: 0.14, hp: 6, brute: false },
  { time: 7.2, lane: 0, hp: 8, brute: false },
  { time: 7.45, lane: -0.2, hp: 7, brute: false },
  { time: 12.4, lane: 0.12, hp: 10, brute: false },
  { time: 12.55, lane: -0.16, hp: 10, brute: false },
  { time: 17.2, lane: -0.22, hp: 12, brute: false },
  { time: 17.35, lane: 0.08, hp: 12, brute: false },
  { time: 17.5, lane: 0.34, hp: 11, brute: false },
  { time: 22.4, lane: 0, hp: 20, brute: true },
  { time: 22.6, lane: -0.32, hp: 12, brute: false },
  { time: 22.6, lane: 0.32, hp: 12, brute: false },
  { time: 27.3, lane: -0.14, hp: 14, brute: false },
  { time: 27.45, lane: 0.16, hp: 14, brute: false },
  { time: 32.2, lane: 0.06, hp: 24, brute: true },
  { time: 32.4, lane: -0.36, hp: 13, brute: false },
  { time: 32.4, lane: 0.4, hp: 13, brute: false },
  { time: 37.4, lane: -0.1, hp: 15, brute: false },
  { time: 37.55, lane: 0.12, hp: 15, brute: false },
  { time: 37.8, lane: 0, hp: 26, brute: true },
  { time: 41.6, lane: -0.28, hp: 14, brute: false },
  { time: 41.6, lane: 0.28, hp: 14, brute: false },
  { time: 41.85, lane: 0, hp: 16, brute: false },
]

/** 最初の20秒で1つ、40秒までにもう1つ。ボスの前に武器が最大まで届く位置。 */
export const CRATE_TIMES = [8.2, 33.6] as const
export const CRATE_HP = 10
export const CRATE_HIT_HALF = 0.48

/** 45秒ごろに出す。HP は最大武器・良い門取りで約10秒。 */
export const BOSS_SPAWN = 45
export const BOSS_HP = 990
export const BOSS_STOP = 390
export const BOSS_HIT_HALF = 0.9
export const BOSS_FACE = 78

/** 2ステージ目以降。1ステージ分ずつ足す。 */
export const STAGE_CAT_HP_STEP = 0.42
export const STAGE_BOSS_HP_STEP = 0.32
export const STAGE2_EXTRA_AFTER = 22

export const LOOK = {
  horizonY: 250,
  captainY: 640,
  halfNear: 178,
  halfFar: 38,
  scaleNear: 1,
  scaleFar: 0.26,
  curve: 0.8,
  behind: 3.15,
  captainH: 138,
  beanH: 54,
  catH: 118,
  bruteMul: 1.16,
  bossMul: 2.65,
  gateH: 124,
  crateH: 74,
}

export const MUTE_KEY = 'shiba-gundan-mute'

export function travelSeconds(): number {
  return SPAWN_DIST / SCROLL_SPEED
}
