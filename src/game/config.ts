/**
 * 柴犬軍団の調整用数字。遊びの数値はここだけを変える。
 * 隊列は自動で前に進み、指は左右だけ。弾は隊列の正面にだけ飛ぶ。
 */

export const VIEW_W = 390
export const VIEW_H = 844

/** 豆柴の初期匹数。隊長はこの数に含まれない。 */
export const START_DOGS = 1
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
/** 画面に出す弾の本数の上限。これより多い豆柴は、1発の威力にまとめる。 */
export const MAX_STREAMS = 6
export const MAX_BULLETS = 280
export const FIRE_INTERVAL = 0.18

/** 猫への1斉射の合計。匹数の平方根で増える。 */
export const CAT_HIT = 2.4
export const CAT_DOG_EXP = 0.5

/** ボスへの1斉射の合計。体力は固定で、匹数の平方根だけ効く。 */
export const BOSS_POWER = 7.5
export const BOSS_DOG_EXP = 0.5

/** ボス戦で隊長アイコンを押したときのロケット。 */
export const ROCKET_DAMAGE = 900
export const ROCKET_COOLDOWN = 1.7
export const ROCKET_SPEED = 980

export const FORMATION = {
  halfBase: 0.05,
  halfPerDog: 0.004,
  /** 道の横幅の3分の1。レーン -1..1 の幅 2 に対して、隊列の全幅は 2/3。 */
  halfMax: 1 / 3,
  /** 画面に描く豆柴の上限。超えた分は密さと頭上の数字で見せる。 */
  drawMax: 80,
  packMin: 0.42,
  rowGap: 15,
  body: 0.075,
  catBody: 0.1,
  countBase: 44,
  countPer: 0.14,
  countMax: 84,
}

export type GateKind = 'add' | 'mul'

export interface GateDef {
  kind: GateKind
  /**
   * add は足す数。負なら赤い −。
   * mul は 2 以上で青い ×、−2 以下で赤い ÷。
   * 弾が当たるたびにこの数は 1 増える。
   */
  amount: number
}

export interface DrumDef {
  side: 'left' | 'right'
  hp: number
}

export interface GatePairDef {
  time: number
  left: GateDef
  right: GateDef
  /** 一番いい門の手前。無いペアは null。 */
  drum: DrumDef | null
}

/**
 * 出現時刻。到達はおよそ time + SPAWN_DIST / SCROLL_SPEED 秒後。
 * 最初の2組は、弾が当たらなくても増える青い門だけ。
 * 赤い門と ÷ は 15 秒をすぎてから。× の手前のドラム缶は撃って壊す。
 */
export const GATE_PAIRS: readonly GatePairDef[] = [
  { time: 4, left: { kind: 'add', amount: 12 }, right: { kind: 'add', amount: 4 }, drum: null },
  { time: 10, left: { kind: 'mul', amount: 2 }, right: { kind: 'add', amount: 6 }, drum: { side: 'left', hp: 302 } },
  { time: 16, left: { kind: 'add', amount: -120 }, right: { kind: 'mul', amount: -16 }, drum: { side: 'right', hp: 1600 } },
  { time: 23, left: { kind: 'add', amount: 4 }, right: { kind: 'add', amount: 12 }, drum: null },
]

/** 門の左右のあいだ。ここにある弾はどちらの門にも当たらない。 */
export const GATE_GAP = 0.08
export const GATE_HIT_DIST = 52
/**
 * これより遠い門には弾が当たらない。
 * 数字が変わるのは、門が画面で大きく見えるあいだだけ。
 */
export const GATE_RANGE = 840
export const DRUM_RANGE = 960

/** ドラム缶は門よりこの距離だけ手前（プレイヤー側）に湧く。 */
export const DRUM_AHEAD = 40
/** 弾を遮る幅。狙いの隊列が乗りきるまで、奥の門には届かない。 */
export const DRUM_HIT_HALF = 0.56
/** 体の当たり。この幅に隊列が重なると豆柴が減る。 */
export const DRUM_BODY = 0.16
export const DRUM_LOSS = 8
export const DRUM_LANE = 0.58

export interface HordeDef {
  time: number
  count: number
  hp: number
}

/**
 * 道を横切る猫の群れ。大きさは、普通に選んだときに想定される匹数へ合わせた固定値。
 * 実際の匹数では変えない。隊列に重なった猫だけが豆柴を連れていく。
 */
export const HORDES: readonly HordeDef[] = [
  { time: 20.4, count: 114, hp: 800 },
  { time: 27.4, count: 208, hp: 900 },
  { time: 32.2, count: 148, hp: 900 },
  { time: 37.0, count: 102, hp: 900 },
]

export const HORDE_SPAWN = 300
export const HORDE_LANE = 1
export const HORDE_DEPTH = 0
export const HORDE_ROWS = 1
export const HORDE_MAX = 220

export const BOSS_SPAWN = 44
export const BOSS_HP = 7200
export const BOSS_STOP = 390
export const BOSS_HIT_HALF = 1.05
export const BOSS_FACE = 78

/** 2ステージ目以降。1ステージ分ずつ足す。猫は匹数も少し増やす。 */
export const STAGE_CAT_HP_STEP = 0.22
export const STAGE_LATE_CAT_HP_STEP = 2.2
export const STAGE_LATE_CAT_AFTER = 36
export const STAGE_BOSS_HP_STEP = 0.32
export const STAGE2_HORDE_EXTRA = 2
export const STAGE2_HORDE_EXTRA_AFTER = 36

export const LOOK = {
  horizonY: 250,
  captainY: 640,
  halfNear: 178,
  halfFar: 96,
  scaleNear: 1,
  scaleFar: 0.26,
  curve: 0.8,
  behind: 3.15,
  captainH: 138,
  beanH: 54,
  catH: 118,
  hordeMul: 1.05,
  bruteMul: 1.16,
  bossMul: 2.65,
  gateH: 124,
  drumH: 78,
}

export const MUTE_KEY = 'shiba-gundan-mute'

export function travelSeconds(): number {
  return SPAWN_DIST / SCROLL_SPEED
}
