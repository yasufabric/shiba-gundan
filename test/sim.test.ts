import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FIRE_INTERVAL,
  HORDES,
  HORDE_SPAWN,
  LATE_MUL_AFTER,
  LATE_MUL_CAP,
  MAX_STREAMS,
  ROCKET_DAMAGE,
  SCROLL_SPEED,
} from '../src/game/config'
import { applyGate, bumpGate, formationHalf, volleyCatDamage } from '../src/game/rules'
import { createSim, step } from '../src/game/sim'
import type { GateDef } from '../src/game/config'
import type { Sim, SimEvent } from '../src/game/types'

const DT = 1 / 60

function projectOp(sim: Sim, gate: Sim['gates'][number]): GateDef {
  const streams = Math.min(MAX_STREAMS, Math.max(1, sim.dogs))
  const seconds = Math.max(0.2, gate.dist / SCROLL_SPEED)
  let hits = Math.round((seconds / FIRE_INTERVAL) * streams)
  const drum = sim.drums.find((item) => item.alive && item.side === gate.side)
  if (drum) {
    const damage = volleyCatDamage(sim.dogs) / streams
    hits = Math.max(0, hits - Math.floor(drum.hp / Math.max(0.2, damage)))
  }
  let amount = gate.op.amount + hits
  if (sim.time > LATE_MUL_AFTER && gate.op.kind === 'mul' && amount > LATE_MUL_CAP) amount = LATE_MUL_CAP
  return { kind: gate.op.kind, amount }
}

function soonestPair(sim: Sim) {
  let soonest: { dist: number; pairId: number } | null = null
  let left: Sim['gates'][number] | undefined
  let right: Sim['gates'][number] | undefined
  for (const gate of sim.gates) {
    if (gate.passed) continue
    if (gate.side < 0) left = gate
    else right = gate
    if (!soonest || gate.dist < soonest.dist) soonest = { dist: gate.dist, pairId: gate.pairId }
  }
  if (!soonest || !left || !right || left.pairId !== soonest.pairId) return null
  return { pairId: soonest.pairId, left, right }
}

function lookAhead(sim: Sim, lane: number, pairId: number): number {
  const copy = structuredClone(sim)
  let guard = 0
  while (copy.phase === 'play' && guard < 500) {
    step(copy, DT, lane, false)
    const pending = copy.gates.some((gate) => gate.pairId === pairId && !gate.passed)
    if (!pending) return copy.dogs
    guard += 1
  }
  return copy.dogs
}

function steer(sim: Sim, policy: 'idle' | 'smart' | 'half' | 'best', locks: Map<number, number>, flips: { n: number }): number {
  if (policy === 'idle') return 0
  const pair = soonestPair(sim)
  if (!pair) return sim.lane
  const locked = locks.get(pair.pairId)
  if (locked !== undefined) return locked
  let side: -1 | 1
  if (policy === 'best') {
    const leftDogs = lookAhead(sim, -0.78, pair.pairId)
    const rightDogs = lookAhead(sim, 0.78, pair.pairId)
    side = leftDogs >= rightDogs ? -1 : 1
  } else {
    const leftDogs = applyGate(sim.dogs, projectOp(sim, pair.left)).dogs
    const rightDogs = applyGate(sim.dogs, projectOp(sim, pair.right)).dogs
    const best: -1 | 1 = leftDogs >= rightDogs ? -1 : 1
    const takeBest = policy === 'smart' || flips.n % 2 === 0
    if (policy === 'half') flips.n += 1
    side = takeBest ? best : best === -1 ? 1 : -1
  }
  const lane = side < 0 ? -0.78 : 0.78
  locks.set(pair.pairId, lane)
  return lane
}

function fightSeconds(sim: Sim): number {
  if (!sim.boss || sim.clearedAt === null) return -1
  return sim.clearedAt - sim.boss.spawnedAt
}

function run(policy: 'idle' | 'smart' | 'half' | 'best', maxTime = 80) {
  const sim = createSim(1)
  const events: Array<SimEvent & { time: number }> = []
  const locks = new Map<number, number>()
  const flips = { n: 0 }
  let beforeBoss = -1
  while (sim.time < maxTime && sim.phase === 'play') {
    const bossUp = Boolean(sim.boss && sim.boss.hp > 0)
    const frame = step(sim, DT, steer(sim, policy, locks, flips), policy !== 'idle' && bossUp && sim.rocketCd <= 0)
    if (sim.boss && beforeBoss < 0) beforeBoss = sim.dogs
    for (const event of frame) events.push({ ...event, time: sim.time })
  }
  return { sim, events, beforeBoss }
}

function hordeReport(events: Array<SimEvent & { time: number }>): Array<{ loss: number; before: number; ratio: number }> {
  let dogs = 1
  let cursor = 0
  return HORDES.map((horde) => {
    const arrive = horde.time + HORDE_SPAWN / SCROLL_SPEED
    const end = arrive + 0.55
    while (cursor < events.length && events[cursor].time < arrive - 0.2) {
      const event = events[cursor]
      if (event.type === 'gate') dogs = event.dogsAfter
      if (event.type === 'hurt') dogs = Math.max(0, dogs - event.loss)
      cursor += 1
    }
    const before = dogs
    let loss = 0
    while (cursor < events.length && events[cursor].time <= end) {
      const event = events[cursor]
      if (event.type === 'hurt' && event.loss === 1) loss += 1
      if (event.type === 'gate') dogs = event.dogsAfter
      if (event.type === 'hurt') dogs = Math.max(0, dogs - event.loss)
      cursor += 1
    }
    return { loss, before, ratio: before > 0 ? loss / before : 1 }
  })
}

test('指を動かさないと15秒までは減らず、そのあとの門で負ける', () => {
  const { sim, events } = run('idle', 30)
  let dogs = 1
  let dropped = false
  for (const event of events) {
    if (event.time > 15) break
    if (event.type === 'gate') {
      if (event.dogsAfter < dogs) dropped = true
      dogs = event.dogsAfter
    }
    if (event.type === 'hurt') {
      dropped = true
      dogs = Math.max(0, dogs - event.loss)
    }
  }
  console.log(`idle t=${sim.time.toFixed(2)} dogs=${sim.dogs} phase=${sim.phase} early=${dogs}`)
  assert.equal(dropped, false)
  assert.ok(dogs >= 1)
  assert.equal(sim.phase, 'lose')
  assert.equal(sim.dogs, 0)
  assert.ok(sim.time > 15 && sim.time < 24, String(sim.time))
})

test('赤い門は想定匹数だと約2.5秒で青に変わる', () => {
  const { events } = run('smart', 22)
  const bumps = events.filter((event) => event.type === 'gate-bump' && event.time >= 16 && event.time <= 20)
  const first = bumps[0]
  const flip = bumps.find((event) => event.type === 'gate-bump' && event.flipped)
  assert.equal(first?.type, 'gate-bump')
  assert.equal(flip?.type, 'gate-bump')
  if (first?.type !== 'gate-bump' || flip?.type !== 'gate-bump') return
  const seconds = flip.time - first.time
  console.log(`flip ${seconds.toFixed(2)}s ${first.time.toFixed(2)} -> ${flip.time.toFixed(2)} ${flip.label}`)
  assert.equal(flip.tone, 'blue')
  assert.ok(seconds >= 2.2 && seconds <= 2.8, String(seconds))
})

test('うまく選ぶとボス前は約300匹で、群れでは1〜2割減って約12秒で倒す', () => {
  const { sim, events, beforeBoss } = run('smart')
  const losses = hordeReport(events)
  const jumped = events.find((event) => event.type === 'gate' && event.label === '×2')
  const fight = fightSeconds(sim)
  console.log(
    `smart phase=${sim.phase} before=${beforeBoss} fight=${fight.toFixed(2)} jump=${jumped && jumped.type === 'gate' ? jumped.dogsAfter : '-'} ${losses.map((row) => `${row.loss}/${row.before}`).join(',')}`,
  )
  assert.equal(sim.phase, 'clear')
  assert.equal(jumped?.type, 'gate')
  if (jumped?.type === 'gate') assert.equal(jumped.label, '×2')
  assert.ok(beforeBoss >= 260 && beforeBoss <= 340, String(beforeBoss))
  assert.ok(fight >= 10.5 && fight <= 13.5, String(fight))
  assert.equal(losses.length, HORDES.length)
  for (const row of losses) {
    assert.ok(row.ratio >= 0.1 && row.ratio <= 0.2, `${row.loss}/${row.before}`)
  }
})

test('門を半分外すと群れで3割以上減り、約150匹でぎりぎりボスに間に合う', () => {
  const good = run('smart')
  const half = run('half')
  const losses = hordeReport(half.events)
  const fight = fightSeconds(half.sim)
  console.log(
    `half phase=${half.sim.phase} before=${half.beforeBoss} fight=${fight.toFixed(2)} ${losses.map((row) => `${row.loss}/${row.before}`).join(',')}`,
  )
  assert.equal(half.sim.phase, 'clear')
  assert.ok(half.beforeBoss < good.beforeBoss)
  assert.ok(half.beforeBoss >= 140 && half.beforeBoss <= 180, String(half.beforeBoss))
  assert.ok(fight >= 17.5 && fight <= 20.2, String(fight))
  for (const row of losses) {
    assert.ok(row.ratio >= 0.3 && row.ratio <= 0.4, `${row.loss}/${row.before}`)
  }
})

test('最強でもボス前は400匹を超えない', () => {
  const { sim, events, beforeBoss } = run('best')
  const losses = hordeReport(events)
  const fight = fightSeconds(sim)
  console.log(
    `best phase=${sim.phase} before=${beforeBoss} fight=${fight.toFixed(2)} ${losses.map((row) => `${row.loss}/${row.before}`).join(',')}`,
  )
  assert.equal(sim.phase, 'clear')
  assert.ok(beforeBoss >= 280 && beforeBoss <= 400, String(beforeBoss))
  assert.ok(fight > 8 && fight < 14, String(fight))
  for (const row of losses) {
    assert.ok(row.ratio >= 0.1 && row.ratio <= 0.2, `${row.loss}/${row.before}`)
  }
})

test('15秒をすぎた×は撃っても×2のままで、ボスは約20秒で届くと負け', () => {
  const grown = bumpGate({ kind: 'mul', amount: 2 }, 16)
  assert.equal(grown.amount, 2)
  const early = bumpGate({ kind: 'mul', amount: 2 }, 10)
  assert.equal(early.amount, 3)
  const sim = createSim(1)
  sim.schedule = [{ kind: 'boss', time: 0.05, hp: 9_999_999 }]
  sim.dogs = 1
  sim.fireCd = 10
  while (sim.phase === 'play' && sim.time < 30) step(sim, DT, 0, false)
  assert.equal(sim.phase, 'lose')
  assert.ok(sim.boss)
  assert.ok(sim.time > 19.4 && sim.time < 21.2, String(sim.time))
})

test('弾は隊列の横幅の中だけに飛び、はみ出した猫は豆柴を連れていかない', () => {
  const sim = createSim(1)
  sim.schedule = []
  sim.dogs = 300
  sim.lane = 0.4
  sim.fireCd = 0
  step(sim, DT, 0.4)
  const half = formationHalf(300)
  const pellets = sim.bullets.filter((bullet) => bullet.kind === 'pellet')
  assert.equal(pellets.length, MAX_STREAMS)
  for (const bullet of pellets) {
    assert.ok(Math.abs(bullet.lane - 0.4) <= half + 1e-6, String(bullet.lane))
  }
  sim.cats.push({
    id: sim.nextId++,
    lane: -1,
    dist: 10,
    hp: 30,
    maxHp: 30,
    brute: false,
    variant: 0,
    flash: 0,
    alive: true,
  })
  const before = sim.dogs
  step(sim, DT, 0.4)
  assert.equal(sim.dogs, before)
  assert.equal(sim.catLeaks, 0)
})

test('隊列の正面にいる猫と、壊していないドラム缶は豆柴を減らす', () => {
  const sim = createSim(1)
  sim.schedule = []
  sim.dogs = 20
  sim.lane = 0.78
  sim.cats.push({
    id: sim.nextId++,
    lane: 0.78,
    dist: 10,
    hp: 40,
    maxHp: 40,
    brute: false,
    variant: 0,
    flash: 0,
    alive: true,
  })
  step(sim, DT, 0.78)
  assert.equal(sim.dogs, 19)
  assert.equal(sim.catLeaks, 1)
  sim.dogs = 20
  sim.drums.push({
    id: sim.nextId++,
    side: 1,
    lane: 0.58,
    dist: 10,
    hp: 500,
    maxHp: 500,
    alive: true,
    flash: 0,
  })
  step(sim, DT, 0.78)
  assert.equal(sim.dogs, 12)
})

test('ボス戦のロケットはボスだけに届く', () => {
  const sim = createSim(1)
  sim.schedule = sim.schedule.filter((spawn) => spawn.kind === 'boss')
  while (sim.time < 80 && sim.phase === 'play' && !sim.boss) step(sim, DT, 0, false)
  assert.ok(sim.boss)
  const before = sim.boss.hp
  const frame = step(sim, DT, 0, true)
  assert.equal(frame.some((event) => event.type === 'rocket'), true)
  let guard = 0
  while (sim.boss && sim.boss.hp > before - ROCKET_DAMAGE + 1 && sim.phase === 'play' && guard < 90) {
    step(sim, DT, 0, false)
    guard += 1
  }
  assert.ok(sim.boss)
  assert.ok(before - sim.boss.hp >= ROCKET_DAMAGE - 1, `${before} -> ${sim.boss.hp}`)
})
