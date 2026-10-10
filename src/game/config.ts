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
 * 猫や木箱への1発の威力は匹数の弱い累乗。
 * ボスへの火力は別で、武器の段階がほぼ全部を決める。
 */
export const DOG_POWER_EXP = 0.37

/**
 * ボスに当たった弾の合計威力。匹数の累乗は少しだけ。
 * 豆鉄砲は10匹で約25秒、50匹で約18秒。3方向撃ちは50匹で約6秒。体力は固定。
 * 10匹未満は肉球で崩れた隊列なので、残りだけではボスが溶けきらない。
 */
export const BOSS_DOG_EXP = 0.23
export const BOSS_WEAPON_POWER = [3.15, 3.15, 1.75] as const

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
  { time: 1.7, count: 18, hp: 1 },
  { time: 7.3, count: 15, hp: 1 },
  { time: 12.5, count: 18, hp: 1 },
  { time: 17.3, count: 18, hp: 1 },
  { time: 22.4, count: 18, hp: 1 },
  { time: 27.4, count: 15, hp: 1 },
  { time: 32.3, count: 18, hp: 1 },
  { time: 37.4, count: 18, hp: 1 },
  { time: 42.1, count: 15, hp: 1 },
]

/**
 * 湧く位置は道がまだ幅を持っているあたり。
 * 手前の地平線に重ねると、10匹以上いても2匹に見える。
 */
export const HORDE_SPAWN = 360
/** かたまりは道の左右いっぱいに、前後3列で密集させる。奇数列は半歩ずらす。 */
export const HORDE_LANE = 0.92
export const HORDE_DEPTH = 140
export const HORDE_ROWS = 3
export const HORDE_MAX = 20

/** 最初の20秒で1つ、40秒までにもう1つ。ボスの前に武器が最大まで届く位置。 */
export const CRATE_TIMES = [8.2, 33.6] as const
export const CRATE_HP = 10
export const CRATE_HIT_HALF = 0.48

/** 45秒ごろに出す。体力は固定で、武器の段階では変えない。 */
export const BOSS_SPAWN = 45
export const BOSS_HP = 580
export const BOSS_STOP = 390
export const BOSS_HIT_HALF = 0.9
export const BOSS_FACE = 78

/**
 * ボスが止まってから落とす肉球スタンプ。
 * 左右どちらかのレーンに影を出してから着地する。同じ側は2回まで。
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
  /** 奥でも道幅を残す。狭いと大群が重なって2匹に見える。 */
  halfFar: 96,
  scaleNear: 1,
  scaleFar: 0.26,
  curve: 0.8,
  behind: 3.15,
  captainH: 138,
  beanH: 54,
  catH: 118,
  /** 大群の猫。通常より少し小さく、道の幅に列が並んで見える大きさ。 */
  hordeMul: 0.82,
  bruteMul: 1.16,
  bossMul: 2.65,
  gateH: 124,
  crateH: 74,
}

export const MUTE_KEY = 'shiba-gundan-mute'

export function travelSeconds(): number {
  return SPAWN_DIST / SCROLL_SPEED
}
