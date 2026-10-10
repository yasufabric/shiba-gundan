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
/** 豆柴の数だけ弾が増える。この本数で頭打ち。 */
export const MAX_STREAMS = 48
export const MAX_BULLETS = 520
/** 弾は隊列の位置ではなく、道の端から端まで散らす。 */
export const VOLLEY_HALF = 0.92

/**
 * ボスに当たった弾の合計威力。匹数の累乗は少しだけ。
 * 体力は固定。武器が上がるほど速く溶ける。匹数の差は小さい。
 * 10匹未満は肉球で崩れた隊列なので、残りだけではボスが溶けきらない。
 */
export const BOSS_DOG_EXP = 0.23
export const BOSS_WEAPON_POWER = [3.15, 3.15, 1.75] as const

export const WEAPONS = [
  { name: '豆鉄砲', interval: 0.24, pellets: 1, spread: 0 },
  { name: '連射', interval: 0.115, pellets: 1, spread: 0 },
  { name: '3方向撃ち', interval: 0.15, pellets: 3, spread: 0.55 },
] as const

/**
 * 猫に当たった1発の威力。匹数では割らない。
 * 連射は間隔が短い。3方向撃ちは1発が強く、弾も3本。
 */
export const CAT_SHOT = [1, 1, 2] as const
/** 武器が最大のときに「武器↑」を取ると、代わりに増える豆柴。 */
export const WEAPON_CAP_DOGS = 1

export const FORMATION = {
  halfBase: 0.14,
  halfPerDog: 0.006,
  halfMax: 0.5,
  showMax: 36,
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

/**
 * 出現時刻。到達はおよそ time + SPAWN_DIST / SCROLL_SPEED 秒後。
 * 豆柴の門は +8〜+15。後半に ×2 を1回混ぜる。
 * 武器の門は約10秒に1回で、2回取ると約30秒で最大。
 * 最大になる時刻のあとは、豆柴どうし（+ か ×2）だけ。
 */
export const GATE_PAIRS: readonly GatePairDef[] = [
  { time: 5, left: { kind: 'add', amount: 8 }, right: { kind: 'add', amount: 10 } },
  { time: 10, left: { kind: 'add', amount: 8 }, right: { kind: 'add', amount: 10 } },
  { time: 15, left: { kind: 'weapon', amount: 1 }, right: { kind: 'add', amount: 15 } },
  { time: 20, left: { kind: 'add', amount: 10 }, right: { kind: 'add', amount: 8 } },
  { time: 25, left: { kind: 'add', amount: 10 }, right: { kind: 'weapon', amount: 1 } },
  { time: 30, left: { kind: 'mul', amount: 2 }, right: { kind: 'add', amount: 10 } },
  { time: 35, left: { kind: 'add', amount: 8 }, right: { kind: 'add', amount: 10 } },
]

export const GATE_INTERVAL = 5

export interface HordeDef {
  time: number
  count: number
  hp: number
}

/**
 * 道を端から端までふさぐ。撃ち漏らした猫は、届いたら必ず豆柴を1匹連れていく。
 * 大きさは、普通に選んだときに想定される匹数へ合わせた固定値。実際の匹数では変えない。
 */
export const HORDES: readonly HordeDef[] = [
  { time: 1.7, count: 12, hp: 2 },
  { time: 9.9, count: 16, hp: 6 },
  { time: 14.9, count: 18, hp: 7 },
  { time: 19.9, count: 18, hp: 14 },
  { time: 24.9, count: 18, hp: 16 },
  { time: 29.9, count: 18, hp: 64 },
  { time: 34.9, count: 20, hp: 96 },
  { time: 39.9, count: 20, hp: 80 },
]

/**
 * 湧く位置は道がまだ幅を持っているあたり。
 * 手前の地平線に重ねると、10匹以上いても2匹に見える。
 */
export const HORDE_SPAWN = 300
/** かたまりは道の端から端まで、1列で体が重なる壁にする。 */
export const HORDE_LANE = 1
export const HORDE_DEPTH = 0
export const HORDE_ROWS = 1
export const HORDE_MAX = 22

/** 武器の門と重ならない。門を2回取ったあとに壊れるので、最速の最大は門の側。 */
export const CRATE_TIMES = [33, 39] as const
export const CRATE_HP = 10
export const CRATE_HIT_HALF = 0.48

/** 45秒ごろに出す。体力は固定で、武器の段階では変えない。 */
export const BOSS_SPAWN = 45
export const BOSS_HP = 1500
export const BOSS_STOP = 390
export const BOSS_HIT_HALF = 1.05
export const BOSS_FACE = 78

/**
 * ボスが止まってから落とす肉球スタンプ。
 * 左右どちらかのレーンに影を出してから着地する。同じ側は2回まで。
 */
export const STAMP_WARN = 0.8
/** 減る数は、匹数の4分の1を切り上げたものと、この数の、多いほう。 */
export const STAMP_MIN = 5
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
  /** 大群の猫。道の端まで体が重なって、すき間ができない大きさ。 */
  hordeMul: 1.05,
  bruteMul: 1.16,
  bossMul: 2.65,
  gateH: 124,
  crateH: 74,
}

export const MUTE_KEY = 'shiba-gundan-mute'

export function travelSeconds(): number {
  return SPAWN_DIST / SCROLL_SPEED
}
