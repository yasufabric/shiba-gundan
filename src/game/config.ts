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
export const BOSS_DOG_EXP = 0.85

/**
 * ボス戦で隊長アイコンを押したときのロケット。
 * 約12秒のあいだに撃つ分で、ボス体力の15〜20%を削る。
 */
export const ROCKET_DAMAGE = 2100
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
  /** 匹数ラベルを画面内に収め、隊長の絵と離す。 */
  labelMargin: 8,
  labelGap: 12,
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
  /** この組の × は、弾が当たっても数字が増えない。 */
  holdMul?: boolean
  /** 省略すると通常の湧き距離。見本の × は近くに短く出す。 */
  dist?: number
}

/**
 * 出現時刻。到達はおよそ time + SPAWN_DIST / SCROLL_SPEED 秒後。
 * 最初の加算の組は、弾が当たらなくても増える青い門。
 * そのあいだに、撃っても ×2 のままの青い × を一度だけ見せる。
 * 赤い門は 15 秒をすぎてから。そのあとの × は、撃っても ×2 で止まる。
 */
export const GATE_PAIRS: readonly GatePairDef[] = [
  { time: 4, left: { kind: 'add', amount: 12 }, right: { kind: 'add', amount: 4 }, drum: null },
  { time: 7.55, left: { kind: 'mul', amount: 2 }, right: { kind: 'add', amount: 28 }, drum: null, holdMul: true, dist: 150 },
  { time: 10, left: { kind: 'add', amount: 10 }, right: { kind: 'add', amount: 6 }, drum: null },
  { time: 16, left: { kind: 'add', amount: -120 }, right: { kind: 'add', amount: -200 }, drum: null },
  { time: 23, left: { kind: 'mul', amount: 2 }, right: { kind: 'add', amount: -9 }, drum: { side: 'left', hp: 48 } },
  { time: 30, left: { kind: 'add', amount: -72 }, right: { kind: 'add', amount: -64 }, drum: null },
]

/**
 * 始まってからこの秒数をすぎた × は、撃ってもこの数で止まる。
 * それより前に出た × は、弾の数だけ育つ。
 */
export const LATE_MUL_AFTER = 15
export const LATE_MUL_CAP = 2

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
 * 後半の猫の群れ。大きさは 300 匹の想定で決めた固定値で、群れごとに同じ。
 * 実際の匹数では変えない。隊列に重なった猫だけが豆柴を連れていく。
 */
export const HORDES: readonly HordeDef[] = [
  { time: 27.2, count: 210, hp: 1600 },
  { time: 36.2, count: 210, hp: 1600 },
]

export const HORDE_SPAWN = 300
export const HORDE_LANE = 1
export const HORDE_DEPTH = 0
export const HORDE_ROWS = 1
export const HORDE_MAX = 240

/**
 * 群れの薄い帯。レーンの中心と半幅。thin はその帯に残す猫の割合。
 * 1群目は右が薄く、2群目は左が薄い。
 * 薄い列に寄ると約5%、門の列に留まると約25%減る。
 */
export const HORDE_GAPS: readonly { lane: number; half: number; thin: number }[] = [
  { lane: 0.78, half: 0.55, thin: 0.12 },
  { lane: -0.78, half: 0.55, thin: 0.12 },
]

export const BOSS_SPAWN = 41
/**
 * 1面のボス体力。上手いルート（ボス前およそ380匹）で、届くまで約9秒残る。
 * 匹数では変えない。面ごとの倍率は bossHpMultiplier。
 */
export const BOSS_HP = 71000
/** 隊列へ歩く速さ。湧いてから届くまでおよそ20秒。 */
export const BOSS_SPEED = 44
/** この距離まで来てまだ生きていれば、隊列に届いて負け。 */
export const BOSS_REACH = 36
export const BOSS_HIT_HALF = 1.05
export const BOSS_FACE = 78

/**
 * 1面のボス体力を 1 とした倍率。
 * 2面 1.36。薄い列で豆柴が残ると 1.25 では残り約9秒なので、約8秒まで上げた。
 * これ以上は、門を半分外すルートが2面で負ける。
 * 3面 1.53。薄い列の盾猫でも約350匹残るので、約4秒まで上げた。
 * 4面は1体 1.16。上手いルートの残りは約2.7秒で、3面の約4秒より短い。
 * 5面からは 1体あたり 0.15 ずつ足す。匹数では変えない。
 */
export const STAGE_BOSS_MULT = [1, 1.36, 1.53] as const
/**
 * 4面以降のボス1体。5面から STAGE_HP_STEP を足す。
 * 1.06 だと残り約4.7秒なので、2.5〜3秒に合わせて 1.16。
 */
export const TWIN_BOSS_HP_SCALE = 1.16
export const STAGE_HP_STEP = 0.15

/** 面ごとのボス体力倍率。4面以降はボス1体ぶん。 */
export function bossHpMultiplier(stage: number): number {
  const safe = Math.max(1, Math.floor(stage))
  if (safe <= 3) return STAGE_BOSS_MULT[safe - 1] ?? 1
  return TWIN_BOSS_HP_SCALE + (safe - 4) * STAGE_HP_STEP
}

export const CLEAR_HOLD = 1.7
export const STAGE_KEY = 'shiba-gundan-stage'

/** 揺れる門。チュートリアルは最初の10秒、どちらを通っても増える青。 */
export const GATE_SLIDE = 0.32
export const GATE_SLIDE_RATE = 1.35
/** 門の絵の中心。左が負。スライドはこの位置に足す。 */
export const GATE_BODY = 0.52
/**
 * 揺れる門の半幅。隊列がこの中にいないと、その門は外した扱いで増減しない。
 */
export const GATE_BODY_HALF = 0.46
/**
 * 最初の門をくぐったあと、近くに短く出す。
 * その前に増やすと、あとの門へ当たる弾まで増えて1面の匹数から離れる。
 */
export const TUTORIAL_GATE = {
  time: 7.6,
  left: 1,
  right: 1,
  dist: 120,
}

/**
 * 盾は正面の弾を受け、本体には通さない。
 * 隊列に触れた盾猫は、通常の猫の SHIELD_LOSS 倍だけ豆柴を連れていく。
 */
export const SHIELD_HP = 520
export const SHIELD_LOSS = 3
export const TUTORIAL_SHIELD = {
  time: 1.1,
  count: 3,
  hp: 1,
  shield: 1,
  /** 奥へずらす間隔。1本の弾筋で手前から順に倒せる。 */
  depth: 140,
}

/** 4面の手前に出す、すぐ倒せる小さなボス。 */
export const MINI_BOSS = {
  time: 1.4,
  hp: 160,
}
export const TWIN_BOSS_GAP = 170

/** 曲。音程の再生は AudioContext.currentTime に予約する。 */
export const MUSIC = {
  bpm: 132,
  bossBpmFar: 124,
  bossBpmNear: 150,
  lookahead: 0.2,
  bass: 0.055,
  drum: 0.06,
  lead: 0.04,
  hat: 0.022,
}

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
  bossMul: 3.15,
  gateH: 124,
  drumH: 78,
}

export const MUTE_KEY = 'shiba-gundan-mute'

export function travelSeconds(): number {
  return SPAWN_DIST / SCROLL_SPEED
}
