import {
  BOSS_HP,
  BOSS_SPAWN,
  CATS,
  CRATE_TIMES,
  GATE_PAIRS,
  STAGE2_EXTRA_AFTER,
  STAGE_BOSS_HP_STEP,
  STAGE_CAT_HP_STEP,
  type CatDef,
  type GateDef,
} from './config'

export interface GateSpawn {
  kind: 'gates'
  time: number
  left: GateDef
  right: GateDef
}

export interface CatSpawn {
  kind: 'cat'
  time: number
  lane: number
  hp: number
  brute: boolean
  variant: number
}

export interface CrateSpawn {
  kind: 'crate'
  time: number
}

export interface BossSpawn {
  kind: 'boss'
  time: number
  hp: number
}

export type Spawn = GateSpawn | CatSpawn | CrateSpawn | BossSpawn

export function catHpMul(stage: number): number {
  return 1 + (stage - 1) * STAGE_CAT_HP_STEP
}

export function bossMaxHp(stage: number): number {
  return BOSS_HP * (1 + (stage - 1) * STAGE_BOSS_HP_STEP)
}

function pushCat(out: Spawn[], stage: number, cat: CatDef, index: number, timePad: number, lanePad: number): void {
  const lane = Math.max(-0.9, Math.min(0.9, cat.lane + lanePad))
  out.push({
    kind: 'cat',
    time: cat.time + timePad,
    lane,
    hp: cat.hp * catHpMul(stage),
    brute: timePad === 0 ? cat.brute : false,
    variant: (index + (timePad === 0 ? 0 : 1)) % 4,
  })
}

/** ステージごとの出現表。ステージ2は猫とボスの数字だけを上げる。 */
export function buildSchedule(stage: number): Spawn[] {
  const safeStage = Math.max(1, Math.floor(stage))
  const spawns: Spawn[] = []
  for (const pair of GATE_PAIRS) {
    spawns.push({ kind: 'gates', time: pair.time, left: pair.left, right: pair.right })
  }
  CATS.forEach((cat, index) => {
    pushCat(spawns, safeStage, cat, index, 0, 0)
    if (safeStage > 1 && cat.time >= STAGE2_EXTRA_AFTER) {
      const pad = cat.lane >= 0 ? 0.18 : -0.18
      pushCat(spawns, safeStage, cat, index, 0.2, pad)
    }
  })
  for (const time of CRATE_TIMES) spawns.push({ kind: 'crate', time })
  spawns.push({ kind: 'boss', time: BOSS_SPAWN, hp: bossMaxHp(safeStage) })
  spawns.sort((a, b) => a.time - b.time || a.kind.localeCompare(b.kind))
  return spawns
}
