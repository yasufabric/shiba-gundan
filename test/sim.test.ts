import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STAMP_WARN, type GateDef } from '../src/game/config'
import { applyGate, rollStampSide, stampLoss } from '../src/game/rules'
import { createSim, step } from '../src/game/sim'
import type { Sim, SimEvent, WeaponLevel } from '../src/game/types'

const DT = 1 / 60
const DODGE_LANE = 0.6

type Policy = 'idle' | 'smart' | 'half' | 'smart-eat' | 'half-eat'

function run(
  policy: Policy,
  stage = 1,
  maxTime = 100,
): { sim: Sim; events: Array<SimEvent & { time: number }>; weaponAt: number | null; beforeBoss: number } {
  const sim = createSim(stage)
  const events: Array<SimEvent & { time: number }> = []
  const locks = new Map<string, number>()
  let weaponAt: number | null = null
  let beforeBoss = -1
  while (sim.time < maxTime && sim.phase === 'play') {
    const frame = step(sim, DT, steer(sim, policy, locks))
    if (weaponAt === null && sim.weapon >= 2) weaponAt = sim.time
    if (sim.boss && beforeBoss < 0) beforeBoss = sim.dogs
    for (const event of frame) events.push({ ...event, time: sim.time })
  }
  return { sim, events, weaponAt, beforeBoss }
}

function dodgeLane(sim: Sim): number {
  const incoming = sim.stamps.find((stamp) => !stamp.resolved)
  if (!incoming) return 0
  return incoming.side < 0 ? DODGE_LANE : -DODGE_LANE
}

function upgrading(op: GateDef, weapon: WeaponLevel): boolean {
  return op.kind === 'weapon' && op.amount > 0 && weapon < 2
}

function steer(sim: Sim, policy: Policy, locks: Map<string, number>): number {
  if (policy === 'idle') return 0
  const eat = policy.endsWith('-eat')
  const base = eat ? policy.slice(0, -4) : policy
  if (sim.boss && sim.boss.stoppedAt !== null) return eat ? 0 : dodgeLane(sim)
  let soonest: { dist: number; pairId: number } | null = null
  let left: (typeof sim.gates)[number] | undefined
  let right: (typeof sim.gates)[number] | undefined
  for (const gate of sim.gates) {
    if (gate.passed) continue
    if (gate.side < 0) left = gate
    else right = gate
    if (!soonest || gate.dist < soonest.dist) soonest = { dist: gate.dist, pairId: gate.pairId }
  }
  if (!soonest || soonest.dist > 520 || !left || !right || left.pairId !== soonest.pairId) return sim.lane
  const key = String(soonest.pairId)
  const locked = locks.get(key)
  if (locked !== undefined) return locked
  const upgrade = upgrading(left.op, sim.weapon) ? -0.78 : upgrading(right.op, sim.weapon) ? 0.78 : null
  let lane: number
  if (upgrade !== null) lane = upgrade
  else {
    const dogsOf = (op: GateDef) => applyGate({ dogs: sim.dogs, weapon: sim.weapon }, op).army.dogs
    const best: -1 | 1 = dogsOf(left.op) >= dogsOf(right.op) ? -1 : 1
    const flips = locks.get('flips') ?? 0
    const takeBest = base === 'smart' || flips % 2 === 0
    if (base === 'half') locks.set('flips', flips + 1)
    const side = takeBest ? best : best === -1 ? 1 : -1
    lane = side < 0 ? -0.78 : 0.78
  }
  locks.set(key, lane)
  return lane
}

function hordeLosses(events: Array<SimEvent & { time: number }>): number[] {
  const losses: number[] = []
  let mark = 0
  const flush = () => {
    if (mark > 0) losses.push(mark)
    mark = 0
  }
  for (const event of events) {
    if (event.type === 'hurt') mark += 1
    if (event.type === 'gate') flush()
  }
  flush()
  return losses
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
    hp: boss ? Number(boss.hp.toFixed(1)) : null,
  })
}

function leaksWhileSliding(slide: boolean): number {
  const sim = createSim(1)
  sim.schedule = sim.schedule.filter((spawn) => spawn.kind === 'cat')
  while (sim.time < 24) {
    sim.phase = 'play'
    sim.dogs = 9
    sim.weapon = 1
    const lane = slide ? Math.sin(sim.time * 2.4) * 0.95 : 0
    step(sim, DT, lane)
  }
  return sim.catLeaks
}

test('湧いた直後のかたまりは道の端から端までいる', () => {
  const sim = createSim(1)
  while (sim.time < 1.85) step(sim, DT, 0)
  assert.equal(sim.dogs, 5)
  const alive = sim.cats.filter((cat) => cat.alive)
  assert.ok(alive.length >= 10 && alive.length <= 20, String(alive.length))
  const lanes = alive.map((cat) => cat.lane)
  const span = Math.max(...lanes) - Math.min(...lanes)
  assert.ok(span >= 1.9, String(span))
})

test('端の猫も、隊列と反対側にいても豆柴を1匹連れていく', () => {
  const sim = createSim(1)
  sim.schedule = []
  sim.dogs = 8
  sim.lane = -1
  sim.cats.push({
    id: sim.nextId++,
    lane: 1,
    dist: 10,
    hp: 5,
    maxHp: 5,
    brute: false,
    variant: 0,
    flash: 0,
    alive: true,
  })
  step(sim, DT, -1)
  assert.equal(sim.dogs, 7)
  assert.equal(sim.catLeaks, 1)
  assert.equal(sim.cats.filter((cat) => cat.alive).length, 0)
})

test('左右に滑っても、撃ち漏らす猫の数は減らない', () => {
  const still = leaksWhileSliding(false)
  const weave = leaksWhileSliding(true)
  assert.ok(still > 0, String(still))
  assert.equal(weave, still)
})

test('指を動かさないと1ステージ目は負ける', () => {
  const { sim, events } = run('idle')
  console.log(`idle stage1 ${summary(sim)}`)
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
  const red = events.filter((event) => event.type === 'gate' && event.good === false)
  assert.equal(red.length, 0)
})

test('武器を優先して多いほうを選ぶと、約60匹でボスをよけて勝てる', () => {
  const { sim, events, weaponAt, beforeBoss } = run('smart')
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  const losses = hordeLosses(events)
  console.log(`smart dodge ${summary(sim)} before ${beforeBoss} weaponAt ${weaponAt} losses ${losses.join(',')}`)
  assert.equal(sim.phase, 'clear', summary(sim))
  assert.ok(beforeBoss >= 50 && beforeBoss <= 70, String(beforeBoss))
  assert.equal(sim.weapon, 2)
  assert.ok(weaponAt !== null && weaponAt >= 26 && weaponAt <= 32, String(weaponAt))
  assert.equal(hits.length, 0, summary(sim))
  assert.ok(losses.length >= 5)
  assert.ok(losses.every((loss) => loss <= 3), losses.join(','))
})

test('門を半分外してもスタンプをよければ勝てるが、1群でまとめて削られる', () => {
  const { sim, events, beforeBoss } = run('half')
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  const losses = hordeLosses(events)
  console.log(`half dodge ${summary(sim)} before ${beforeBoss} losses ${losses.join(',')}`)
  assert.equal(sim.phase, 'clear', summary(sim))
  assert.ok(beforeBoss >= 20 && beforeBoss <= 45, String(beforeBoss))
  assert.equal(hits.length, 0, summary(sim))
  assert.ok(losses.some((loss) => loss >= 5 && loss <= 12), losses.join(','))
})

test('うまく選んでもスタンプを全部食らうと負ける', () => {
  const { sim, events } = run('smart-eat')
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  console.log(`smart eat ${summary(sim)} hits ${hits.length}`)
  assert.ok(hits.length >= 3, summary(sim))
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
  assert.ok(sim.boss && sim.boss.hp > 0, summary(sim))
})

test('門を半分外してスタンプを全部食らうと負ける', () => {
  const { sim, events } = run('half-eat')
  const hits = events.filter((event) => event.type === 'stamp' && event.hit)
  console.log(`half eat ${summary(sim)} hits ${hits.length}`)
  assert.ok(hits.length >= 2, summary(sim))
  assert.equal(sim.phase, 'lose', summary(sim))
  assert.equal(sim.dogs, 0)
  assert.ok(sim.boss && sim.boss.hp > 0, summary(sim))
})

test('肉球は影の0.8秒後に落ち、中央にいるとそのときの割合で減る', () => {
  const sim = createSim(1)
  sim.schedule = sim.schedule.filter((spawn) => spawn.kind !== 'cat')
  while (sim.time < 90 && sim.phase === 'play' && !(sim.boss && sim.boss.stoppedAt !== null)) step(sim, DT, 0)
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
        assert.ok(stamp.side === -1 || stamp.side === 1)
      }
    }
    const frame = step(sim, DT, 0)
    for (const event of frame) {
      if (event.type !== 'stamp') continue
      impacts.push({ time: sim.time, side: event.side })
      if (impacts.length === 1) {
        assert.equal(event.hit, true)
        assert.ok(Math.abs(sim.time - warnAt - remain) < 0.05, `${sim.time - warnAt} vs ${remain}`)
        assert.equal(sim.dogs, Math.max(0, before - stampLoss(before)))
      }
    }
    if (impacts.length >= 4) break
  }
  assert.ok(seen)
  assert.ok(impacts.length >= 3)
  let runLength = 1
  for (let i = 1; i < impacts.length; i += 1) {
    const prev = impacts[i - 1]
    const next = impacts[i]
    assert.ok(prev && next)
    runLength = next.side === prev.side ? runLength + 1 : 1
    assert.ok(runLength <= 2, impacts.map((impact) => impact.side).join(','))
    const gap = next.time - prev.time
    assert.ok(gap >= 2 && gap <= 3, String(gap))
  }
})

test('肉球は同じ側に3回続かない', () => {
  let recent: Array<-1 | 1> = []
  const sides: Array<-1 | 1> = []
  for (let i = 0; i < 12; i += 1) {
    const side = rollStampSide(recent, 0)
    sides.push(side)
    recent = [...recent, side].slice(-2)
  }
  assert.deepEqual(sides, [-1, -1, 1, -1, -1, 1, -1, -1, 1, -1, -1, 1])
  recent = []
  const right: Array<-1 | 1> = []
  for (let i = 0; i < 5; i += 1) {
    const side = rollStampSide(recent, 0.9)
    right.push(side)
    recent = [...recent, side].slice(-2)
  }
  assert.deepEqual(right, [1, 1, -1, 1, 1])
})

test('豆柴が5匹未満のときに肉球を食らうと0で負け', () => {
  const sim = createSim(1)
  sim.schedule = sim.schedule.filter((spawn) => spawn.kind !== 'cat')
  while (sim.time < 90 && sim.phase === 'play' && !(sim.boss && sim.boss.stoppedAt !== null)) step(sim, DT, 0)
  assert.ok(sim.boss)
  sim.cats = []
  sim.dogs = 3
  while (sim.time < 90 && sim.phase === 'play') step(sim, DT, 0)
  assert.equal(sim.phase, 'lose')
  assert.equal(sim.dogs, 0)
})

function lockedBossFight(dogs: number, weapon: WeaponLevel, stage = 1): Sim {
  const sim = createSim(stage)
  sim.schedule = sim.schedule.filter((spawn) => spawn.kind !== 'cat')
  while (sim.time < 180 && sim.phase === 'play') {
    sim.dogs = dogs
    sim.weapon = weapon
    const lane = sim.boss && sim.boss.stoppedAt !== null ? dodgeLane(sim) : 0
    step(sim, DT, lane)
  }
  return sim
}

function killSeconds(sim: Sim): number | null {
  if (sim.clearedAt === null || !sim.boss) return null
  return sim.clearedAt - sim.boss.spawnedAt
}

test('ボスの体力は固定で、武器が上がると溶けるのが速い', () => {
  const counts = [10, 30, 50] as const
  const table: Record<string, number> = {}
  for (const weapon of [0, 1, 2] as const) {
    for (const dogs of counts) {
      const sim = lockedBossFight(dogs, weapon)
      const kill = killSeconds(sim)
      assert.equal(sim.phase, 'clear', summary(sim))
      assert.ok(kill !== null, summary(sim))
      table[`w${weapon}d${dogs}`] = Number(kill.toFixed(2))
    }
  }
  const at = (weapon: number, dogs: number) => {
    const kill = table[`w${weapon}d${dogs}`]
    assert.ok(kill !== undefined)
    return kill
  }
  assert.ok(at(0, 10) > at(0, 50))
  assert.ok(at(2, 50) < at(0, 50))
  assert.ok(at(1, 50) < at(0, 50) && at(2, 50) < at(1, 50))
  assert.ok(at(0, 10) < 90, String(at(0, 10)))
  console.log(`boss ttk ${JSON.stringify(table)}`)
  const later = lockedBossFight(10, 0, 2)
  assert.equal(later.phase, 'clear', summary(later))
})
