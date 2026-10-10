import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RED_GATE_AFTER, STAMP_DAMAGE, STAMP_WARN } from '../src/game/config'
import { applyGate } from '../src/game/rules'
import { createSim, step } from '../src/game/sim'
import type { Army, Sim, SimEvent, WeaponLevel } from '../src/game/types'

const DT = 1 / 60

type Policy = 'good' | 'half' | 'worst' | 'half-eat' | 'idle'

const DODGE_LANE = 0.6

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

function dodgeLane(sim: Sim): number {
  const incoming = sim.stamps.find((stamp) => !stamp.resolved)
  const side = incoming?.side ?? (sim.boss && sim.boss.stampIndex % 2 === 0 ? -1 : 1)
  return side < 0 ? DODGE_LANE : -DODGE_LANE
}

function steer(
  sim: Sim,
  policy: Policy,
  locked: Map<number, -1 | 1>,
  wrong: { v: boolean },
): number {
  if (policy === 'idle') return 0
  if (sim.boss?.stoppedAt !== null && sim.boss) {
    if (policy === 'half-eat' || policy === 'worst') return 0
    return dodgeLane(sim)
  }
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
  if (!tied && (policy === 'half' || policy === 'half-eat')) {
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

function killSeconds(sim: Sim): number | null {
  if (sim.clearedAt === null || !sim.boss) return null
  return sim.clearedAt - sim.boss.spawnedAt
}

function fight(stage: number, weapon: WeaponLevel, maxTime = 160): { sim: Sim } {
  const sim = createSim(stage)
  const locked = new Map<number, -1 | 1>()
  let wrongNext = true
  let armed = false
  const wrong = {
    get v() {
      return wrongNext
    },
    set v(value: boolean) {
      wrongNext = value
    },
  }
  while (sim.time < maxTime && sim.phase === 'play') {
    if (sim.boss && sim.boss.stoppedAt !== null && !armed) {
      sim.weapon = weapon
      armed = true
    }
    step(sim, DT, steer(sim, 'good', locked, wrong))
  }
  return { sim }
}

test('良い門を選ぶと最大武器でボスを約6秒で倒す', () => {
  const { sim, events } = run('good')
  assert.equal(sim.phase, 'clear', summary(sim))
  const firstGate = events.find((event) => event.type === 'gate')
  assert.equal(firstGate?.type, 'gate')
  if (firstGate?.type === 'gate') assert.equal(firstGate.dogsAfter, 10)
  const crates = events.filter((event) => event.type === 'crate')
  assert.equal(crates.length, 2, summary(sim))
  assert.equal(sim.weapon, 2, summary(sim))
  assert.ok(sim.boss)
  const fought = killSeconds(sim)
  assert.ok(fought !== null && fought >= 5 && fought <= 7.5, summary(sim))
  const red = events.filter((event) => event.type === 'gate' && event.good === false)
  for (const event of red) assert.ok(event.time > RED_GATE_AFTER)
  console.log(`good stage1 ${summary(sim)}`)
})

test('指を動かさないと1ステージ目は負ける', () => {
  const { sim, events } = run('idle')
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  console.log(`idle stage1 ${summary(sim)} hits ${hits.length}`)
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
  assert.ok(sim.boss && sim.boss.hp > 0, summary(sim))
  assert.ok(hits.length >= 3, summary(sim))
})

test('門を半分外してスタンプを何回かよければ勝てる', () => {
  const { sim, events } = run('half')
  const choices = events.filter((event) => event.type === 'gate')
  assert.ok(choices.length >= 8, summary(sim))
  assert.equal(sim.phase, 'clear', summary(sim))
  assert.ok(sim.dogs > 0, summary(sim))
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  assert.equal(hits.length, 0, summary(sim))
  console.log(`half-wrong dodge stage1 ${summary(sim)} hits ${hits.length}`)
})

test('門を半分外してスタンプを全部食らうと負ける', () => {
  const { sim, events } = run('half-eat')
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  console.log(`half-wrong eat stage1 ${summary(sim)} hits ${hits.length}`)
  assert.ok(hits.length >= 2, summary(sim))
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
})

test('肉球は影の0.8秒後に落ち、中央にいると5匹減る', () => {
  const sim = createSim(1)
  while (sim.time < 90 && !(sim.boss && sim.boss.stoppedAt !== null)) step(sim, DT, 0)
  assert.ok(sim.boss?.stoppedAt)
  sim.cats = []
  const before = sim.dogs
  let remain = 0
  let warnAt = 0
  let seen = false
  const impacts: Array<{ time: number; side: -1 | 1 }> = []
  const stop = (sim.boss?.stoppedAt ?? sim.time) + 14
  while (sim.time < stop && sim.phase === 'play') {
    if (!seen) {
      const stamp = sim.stamps.find((item) => !item.resolved)
      if (stamp) {
        seen = true
        remain = stamp.warn
        warnAt = sim.time
        assert.ok(remain > STAMP_WARN - 0.05 && remain <= STAMP_WARN)
        assert.equal(stamp.side, -1)
      }
    }
    const frame = step(sim, DT, 0)
    for (const event of frame) {
      if (event.type !== 'stamp') continue
      impacts.push({ time: sim.time, side: event.side })
      if (impacts.length === 1) {
        assert.equal(event.hit, true)
        assert.ok(Math.abs(sim.time - warnAt - remain) < 0.05, `${sim.time - warnAt} vs ${remain}`)
        assert.equal(sim.dogs, Math.max(0, before - STAMP_DAMAGE))
      }
    }
    if (impacts.length >= 4) break
  }
  assert.ok(seen)
  assert.ok(impacts.length >= 3)
  assert.equal(impacts[0]?.side, -1)
  assert.equal(impacts[1]?.side, 1)
  for (let i = 1; i < impacts.length; i += 1) {
    const prev = impacts[i - 1]
    const next = impacts[i]
    assert.ok(prev && next)
    const gap = next.time - prev.time
    assert.ok(gap >= 2 && gap <= 3, String(gap))
  }
})

test('豆柴が5匹未満のときに肉球を食らうと0で負け', () => {
  const sim = createSim(1)
  while (sim.time < 90 && !(sim.boss && sim.boss.stoppedAt !== null)) step(sim, DT, 0)
  assert.ok(sim.boss)
  sim.cats = []
  sim.dogs = 3
  while (sim.time < 90 && sim.phase === 'play') step(sim, DT, 0)
  assert.equal(sim.phase, 'lose')
  assert.equal(sim.dogs, 0)
})

test('わざと悪い門を全部選ぶと負ける', () => {
  const { sim } = run('worst', 1, 80)
  console.log(`worst stage1 ${summary(sim)}`)
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
})

test('ボスの体力は固定で、最弱は約20秒、最大は約6秒', () => {
  const weak = fight(1, 0)
  const mid = fight(1, 1)
  const strong = fight(1, 2)
  const weakKill = killSeconds(weak.sim)
  const midKill = killSeconds(mid.sim)
  const strongKill = killSeconds(strong.sim)
  assert.equal(weak.sim.phase, 'clear', summary(weak.sim))
  assert.equal(strong.sim.phase, 'clear', summary(strong.sim))
  assert.ok(weakKill !== null && weakKill >= 17 && weakKill <= 24, summary(weak.sim))
  assert.ok(strongKill !== null && strongKill >= 5 && strongKill <= 7.5, summary(strong.sim))
  assert.ok(midKill !== null && weakKill !== null && strongKill !== null)
  assert.ok(midKill < weakKill && midKill > strongKill, summary(mid.sim))
  console.log(`ttk stage1 w0 ${summary(weak.sim)} w1 ${summary(mid.sim)} w2 ${summary(strong.sim)}`)
  for (const stage of [2, 3] as const) {
    const laterWeak = fight(stage, 0)
    const laterStrong = fight(stage, 2)
    assert.equal(laterWeak.sim.phase, 'clear', summary(laterWeak.sim))
    assert.equal(laterStrong.sim.phase, 'clear', summary(laterStrong.sim))
    const laterWeakKill = killSeconds(laterWeak.sim)
    const laterStrongKill = killSeconds(laterStrong.sim)
    assert.ok(laterWeakKill !== null && laterWeakKill < 70, summary(laterWeak.sim))
    assert.ok(laterStrongKill !== null && laterWeakKill !== null && laterStrongKill < laterWeakKill)
    console.log(`ttk stage${stage} w0 ${summary(laterWeak.sim)} w2 ${summary(laterStrong.sim)}`)
  }
})

test('2ステージ目は良い選択なら勝てて、半分外すとぎりぎりになる', () => {
  const good = run('good', 2, 140)
  console.log(`good stage2 ${summary(good.sim)}`)
  assert.equal(good.sim.phase, 'clear', summary(good.sim))
  const half = run('half', 2, 140)
  console.log(`half-wrong stage2 ${summary(half.sim)}`)
  assert.ok(half.sim.phase === 'clear' || half.sim.phase === 'lose')
  if (half.sim.phase === 'clear') {
    const halfKill = killSeconds(half.sim)
    const goodKill = killSeconds(good.sim)
    assert.ok(halfKill !== null && goodKill !== null && halfKill > goodKill, summary(half.sim))
    assert.ok(half.sim.dogs < good.sim.dogs, summary(half.sim))
  }
})
