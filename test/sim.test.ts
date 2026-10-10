import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RED_GATE_AFTER } from '../src/game/config'
import { applyGate } from '../src/game/rules'
import { createSim, step } from '../src/game/sim'
import type { Army, Sim, SimEvent } from '../src/game/types'

const DT = 1 / 60

type Policy = 'good' | 'half' | 'worst'

function betterSide(army: Army, left: Army, right: Army): -1 | 1 {
  const score = (next: Army) => next.dogs * 10 + next.weapon
  const l = score(left)
  const r = score(right)
  if (l === r) return 1
  return l > r ? -1 : 1
}

function run(policy: Policy, stage = 1, maxTime = 120): { sim: Sim; events: Array<SimEvent & { time: number }> } {
  const sim = createSim(stage)
  const events: Array<SimEvent & { time: number }> = []
  const locked = new Map<number, -1 | 1>()
  let wrongNext = true
  while (sim.time < maxTime && sim.phase === 'play') {
    const lane = steer(sim, policy, locked, { get v() { return wrongNext }, set v(value: boolean) { wrongNext = value } })
    const frame = step(sim, DT, lane)
    for (const event of frame) events.push({ ...event, time: sim.time })
  }
  return { sim, events }
}

function steer(
  sim: Sim,
  policy: Policy,
  locked: Map<number, -1 | 1>,
  wrong: { v: boolean },
): number {
  let soonest: { dist: number; pairId: number } | null = null
  const byPair = new Map<number, { left?: (typeof sim.gates)[number]; right?: (typeof sim.gates)[number] }>()
  for (const gate of sim.gates) {
    if (gate.passed) continue
    const row = byPair.get(gate.pairId) ?? {}
    if (gate.side < 0) row.left = gate
    else row.right = gate
    byPair.set(gate.pairId, row)
    if (!soonest || gate.dist < soonest.dist) soonest = { dist: gate.dist, pairId: gate.pairId }
  }
  if (!soonest || soonest.dist > 480) return 0
  const pair = byPair.get(soonest.pairId)
  if (!pair?.left || !pair.right) return 0
  const known = locked.get(soonest.pairId)
  if (known) return known < 0 ? -0.78 : 0.78
  const army = { dogs: sim.dogs, weapon: sim.weapon }
  const left = applyGate(army, pair.left.op).army
  const right = applyGate(army, pair.right.op).army
  const best = betterSide(army, left, right)
  const tied = left.dogs * 10 + left.weapon === right.dogs * 10 + right.weapon
  let side: -1 | 1 = best
  if (!tied && policy === 'worst') side = best === -1 ? 1 : -1
  if (!tied && policy === 'half') {
    side = wrong.v ? (best === -1 ? 1 : -1) : best
    wrong.v = !wrong.v
  }
  locked.set(soonest.pairId, side)
  return side < 0 ? -0.78 : 0.78
}

function summary(sim: Sim): string {
  const boss = sim.boss
  const kill = sim.clearedAt !== null && boss ? sim.clearedAt - boss.spawnedAt : null
  return JSON.stringify({
    phase: sim.phase,
    time: Number(sim.time.toFixed(2)),
    dogs: sim.dogs,
    weapon: sim.weapon,
    leaks: sim.catLeaks,
    kill: kill === null ? null : Number(kill.toFixed(2)),
    stopped: boss?.stoppedAt ?? null,
    hp: boss ? Number(boss.hp.toFixed(1)) : null,
  })
}

test('何も届く前に豆柴は減らない', () => {
  const sim = createSim(1)
  while (sim.time < 2.2) step(sim, DT, 0)
  assert.equal(sim.dogs, 5)
  assert.ok(sim.cats.length > 0)
  for (const cat of sim.cats) assert.ok(cat.dist > 500)
})

test('良い門を選ぶと最大武器でボスを約10秒で倒す', () => {
  const { sim, events } = run('good')
  assert.equal(sim.phase, 'clear', summary(sim))
  const firstGate = events.find((event) => event.type === 'gate')
  assert.equal(firstGate?.type, 'gate')
  if (firstGate?.type === 'gate') assert.equal(firstGate.dogsAfter, 10)
  const crates = events.filter((event) => event.type === 'crate')
  assert.equal(crates.length, 2, summary(sim))
  assert.equal(sim.weapon, 2, summary(sim))
  assert.ok(sim.boss)
  assert.ok(sim.clearedAt !== null && sim.boss)
  if (sim.clearedAt !== null && sim.boss) {
    const fought = sim.clearedAt - sim.boss.spawnedAt
    assert.ok(fought >= 8 && fought <= 12.5, summary(sim))
  }
  const red = events.filter((event) => event.type === 'gate' && event.good === false)
  for (const event of red) assert.ok(event.time > RED_GATE_AFTER)
  console.log(`good stage1 ${summary(sim)}`)
})

test('門を半分外しても1ステージ目はクリアできる', () => {
  const { sim, events } = run('half')
  const choices = events.filter((event) => event.type === 'gate')
  assert.ok(choices.length >= 8, summary(sim))
  assert.equal(sim.phase, 'clear', summary(sim))
  assert.ok(sim.dogs > 0, summary(sim))
  console.log(`half-wrong stage1 ${summary(sim)}`)
})

test('悪い門だけ選ぶと負ける', () => {
  const { sim } = run('worst', 1, 80)
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
})

test('2ステージ目は良い選択なら勝てて、半分外すとぎりぎりになる', () => {
  const good = run('good', 2, 140)
  assert.equal(good.sim.phase, 'clear', summary(good.sim))
  const half = run('half', 2, 140)
  console.log(`half-wrong stage2 ${summary(half.sim)}`)
  assert.ok(half.sim.phase === 'clear' || half.sim.phase === 'lose')
  if (half.sim.phase === 'clear') assert.ok(half.sim.dogs <= 12, summary(half.sim))
})
