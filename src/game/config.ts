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
 * ボス体力は武器では変えない。良い門取りの隊列で、豆鉄砲が約20秒、3方向撃ちが約6秒。
 */
export const DOG_POWER_EXP = 0.37

export const WEAPONS = [
  { name: '豆鉄砲', interval: 0.24, pellets: 1, spread: 0 },
  { name: '連射', interval: 0.115, pellets: 1, spread: 0 },
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

export interface HordeDef {
  time: number
  count: number
  hp: number
}

/**
 * 体力の低い猫を、道いっぱいに10〜20匹のかたまりで出す。
 * 弾が当たる列はまとめて溶け、触れた1匹につき豆柴が1匹減る。
 */
export const HORDES: readonly HordeDef[] = [
  { time: 1.7, count: 12, hp: 2 },
  { time: 7.3, count: 14, hp: 2 },
  { time: 12.5, count: 16, hp: 3 },
  { time: 17.3, count: 16, hp: 3 },
  { time: 22.4, count: 18, hp: 3 },
  { time: 27.4, count: 18, hp: 3 },
  { time: 32.3, count: 16, hp: 4 },
  { time: 37.4, count: 18, hp: 4 },
  { time: 42.1, count: 14, hp: 4 },
]

/** かたまりは道の左右いっぱいに並べ、前後を少しずらして一塊に見せる。 */
export const HORDE_LANE = 0.88
export const HORDE_DEPTH = 18
export const HORDE_MAX = 20

/** 最初の20秒で1つ、40秒までにもう1つ。ボスの前に武器が最大まで届く位置。 */
export const CRATE_TIMES = [8.2, 33.6] as const
export const CRATE_HP = 10
export const CRATE_HIT_HALF = 0.48

/** 45秒ごろに出す。体力は固定。最大武器で約6秒、最弱武器で約20秒。 */
export const BOSS_SPAWN = 45
export const BOSS_HP = 580
export const BOSS_STOP = 390
export const BOSS_HIT_HALF = 0.9
export const BOSS_FACE = 78

/**
 * ボスが止まってから落とす肉球スタンプ。
 * 左右どちらかのレーンに影を出してから着地し、隊列が重なると豆柴が減る。
 */
export const STAMP_WARN = 0.8
export const STAMP_DAMAGE = 5
export const STAMP_INTERVALS = [2.4, 2.8, 2.2, 2.6] as const
export const STAMP_FIRST_DELAY = 0.35
export const STAMP_LANE = 0.72
export const STAMP_HIT_HALF = 0.78
export const STAMP_SLAM = 0.42

/** 2ステージ目以降。1ステージ分ずつ足す。猫は匹数も少し増やす。 */
export const STAGE_CAT_HP_STEP = 0.22
/** 2ステージ目の終盤だけ、かたまりの体力をさらに上げる。最弱武器でもボスは倒せる範囲。 */
export const STAGE_LATE_CAT_HP_STEP = 2.2
export const STAGE_LATE_CAT_AFTER = 36
export const STAGE_BOSS_HP_STEP = 0.32
export const STAGE2_HORDE_EXTRA = 2
/** 木箱の通り道はステージ1と同じ密度にし、この時刻以降のかたまりだけ増やす。 */
export const STAGE2_HORDE_EXTRA_AFTER = 36

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
