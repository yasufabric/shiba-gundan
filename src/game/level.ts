import {
  BOSS_HP,
  BOSS_SPAWN,
  GATE_PAIRS,
  GATE_SLIDE,
  HORDES,
  HORDE_DEPTH,
  HORDE_LANE,
  HORDE_MAX,
  HORDE_ROWS,
  MINI_BOSS,
  SHIELD_HP,
  STAGE_PRESSURE,
  TUTORIAL_GATE,
  TUTORIAL_SHIELD,
  TWIN_BOSS_GAP,
  TWIN_BOSS_HP_SCALE,
  type DrumDef,
  type GateDef,
  type HordeDef,
} from './config'

export interface GateSpawn {
  kind: 'gates'
  time: number
  left: GateDef
  right: GateDef
  drum: DrumDef | null
  slide: number
}

export interface CatSpawn {
  kind: 'cat'
  time: number
  lane: number
  hp: number
  shield: number
  brute: boolean
  variant: number
  depth: number
}

export interface BossSpawn {
  kind: 'boss'
  time: number
  hp: number
  lane: number
  preview: boolean
  /** 先頭のボスより奥に置く距離。 */
  behind: number
}

export type Spawn = GateSpawn | CatSpawn | BossSpawn

export interface StageFeatures {
  slide: boolean
  shield: boolean
  twin: boolean
  pressure: number
}

/** 1面は何も足さない。2・3・4面は要素が1つ。5面から全部と体力上昇。 */
export function stageFeatures(stage: number): StageFeatures {
  const safe = Math.max(1, Math.floor(stage))
  return {
    slide: safe === 2 || safe >= 5,
    shield: safe === 3 || safe >= 5,
    twin: safe === 4 || safe >= 5,
    pressure: safe >= 5 ? 1 + (safe - 4) * STAGE_PRESSURE : 1,
  }
}

function pushHorde(out: Spawn[], horde: HordeDef, index: number, shield: number, pressure: number): void {
  const count = Math.max(1, Math.min(HORDE_MAX, horde.count))
  const hp = horde.hp * pressure
  const rows = Math.min(HORDE_ROWS, count)
  const cols = Math.ceil(count / rows)
  for (let i = 0; i < count; i += 1) {
    const row = Math.min(rows - 1, Math.floor(i / cols))
    const col = i - row * cols
    const inRow = Math.min(cols, count - row * cols)
    const u = inRow <= 1 ? 0.5 : row % 2 === 0 ? col / (inRow - 1) : (col + 0.5) / inRow
    const lane = -HORDE_LANE + u * HORDE_LANE * 2
    out.push({
      kind: 'cat',
      time: horde.time,
      lane,
      hp,
      shield,
      brute: false,
      variant: (index + i) % 4,
      depth: row * HORDE_DEPTH,
    })
  }
}

function pushTutorialCats(out: Spawn[]): void {
  const count = TUTORIAL_SHIELD.count
  for (let i = 0; i < count; i += 1) {
    out.push({
      kind: 'cat',
      time: TUTORIAL_SHIELD.time,
      lane: 0,
      hp: TUTORIAL_SHIELD.hp,
      shield: TUTORIAL_SHIELD.shield,
      brute: false,
      variant: i % 4,
      depth: i * TUTORIAL_SHIELD.depth,
    })
  }
}

/** ステージごとの出現表。1面は調整済みの並びだけ。 */
export function buildSchedule(stage: number): Spawn[] {
  const safeStage = Math.max(1, Math.floor(stage))
  const features = stageFeatures(safeStage)
  const spawns: Spawn[] = []
  if (features.slide) {
    spawns.push({
      kind: 'gates',
      time: TUTORIAL_GATE.time,
      left: { kind: 'add', amount: TUTORIAL_GATE.left },
      right: { kind: 'add', amount: TUTORIAL_GATE.right },
      drum: null,
      slide: GATE_SLIDE,
    })
  }
  for (const pair of GATE_PAIRS) {
    spawns.push({
      kind: 'gates',
      time: pair.time,
      left: { kind: pair.left.kind, amount: pair.left.amount },
      right: { kind: pair.right.kind, amount: pair.right.amount },
      drum: pair.drum ? { side: pair.drum.side, hp: pair.drum.hp } : null,
      slide: features.slide ? GATE_SLIDE : 0,
    })
  }
  if (features.shield) pushTutorialCats(spawns)
  HORDES.forEach((horde, index) => {
    const shield = features.shield && horde.time > 10 ? SHIELD_HP : 0
    pushHorde(spawns, horde, index, shield, features.pressure)
  })
  if (features.twin) {
    spawns.push({
      kind: 'boss',
      time: MINI_BOSS.time,
      hp: MINI_BOSS.hp,
      lane: 0,
      preview: true,
      behind: 0,
    })
  }
  const bossHp = BOSS_HP * (features.twin ? TWIN_BOSS_HP_SCALE : 1) * features.pressure
  spawns.push({
    kind: 'boss',
    time: BOSS_SPAWN,
    hp: bossHp,
    lane: 0,
    preview: false,
    behind: 0,
  })
  if (features.twin) {
    spawns.push({
      kind: 'boss',
      time: BOSS_SPAWN,
      hp: bossHp,
      lane: 0,
      preview: false,
      behind: TWIN_BOSS_GAP,
    })
  }
  spawns.sort((a, b) => a.time - b.time || a.kind.localeCompare(b.kind))
  return spawns
}
