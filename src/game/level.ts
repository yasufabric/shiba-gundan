import {
  BOSS_HP,
  BOSS_SPAWN,
  GATE_PAIRS,
  HORDES,
  HORDE_DEPTH,
  HORDE_LANE,
  HORDE_MAX,
  HORDE_ROWS,
  STAGE2_HORDE_EXTRA,
  STAGE2_HORDE_EXTRA_AFTER,
  STAGE_BOSS_HP_STEP,
  STAGE_CAT_HP_STEP,
  STAGE_LATE_CAT_AFTER,
  STAGE_LATE_CAT_HP_STEP,
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
}

export interface CatSpawn {
  kind: 'cat'
  time: number
  lane: number
  hp: number
  brute: boolean
  variant: number
  depth: number
}

export interface BossSpawn {
  kind: 'boss'
  time: number
  hp: number
}

export type Spawn = GateSpawn | CatSpawn | BossSpawn

export function catHpMul(stage: number): number {
  return 1 + (stage - 1) * STAGE_CAT_HP_STEP
}

export function lateCatHpMul(stage: number): number {
  return 1 + (stage - 1) * STAGE_LATE_CAT_HP_STEP
}

export function bossMaxHp(stage: number): number {
  return BOSS_HP * (1 + (stage - 1) * STAGE_BOSS_HP_STEP)
}

function pushHorde(out: Spawn[], stage: number, horde: HordeDef, index: number): void {
  const extra = stage > 1 && horde.time >= STAGE2_HORDE_EXTRA_AFTER ? STAGE2_HORDE_EXTRA : 0
  const count = Math.max(1, Math.min(HORDE_MAX, horde.count + extra))
  const hp = horde.hp * (horde.time >= STAGE_LATE_CAT_AFTER ? lateCatHpMul(stage) : catHpMul(stage))
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
      brute: false,
      variant: (index + i) % 4,
      depth: row * HORDE_DEPTH,
    })
  }
}

/** ステージごとの出現表。ステージ2は猫とボスの数字だけを上げる。 */
export function buildSchedule(stage: number): Spawn[] {
  const safeStage = Math.max(1, Math.floor(stage))
  const spawns: Spawn[] = []
  for (const pair of GATE_PAIRS) {
    spawns.push({
      kind: 'gates',
      time: pair.time,
      left: { kind: pair.left.kind, amount: pair.left.amount },
      right: { kind: pair.right.kind, amount: pair.right.amount },
      drum: pair.drum ? { side: pair.drum.side, hp: pair.drum.hp } : null,
    })
  }
  HORDES.forEach((horde, index) => pushHorde(spawns, safeStage, horde, index))
  spawns.push({ kind: 'boss', time: BOSS_SPAWN, hp: bossMaxHp(safeStage) })
  spawns.sort((a, b) => a.time - b.time || a.kind.localeCompare(b.kind))
  return spawns
}
