import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FIRE_INTERVAL, HORDES, HORDE_SPAWN, MAX_STREAMS, ROCKET_DAMAGE, SCROLL_SPEED } from '../src/game/config'
import { applyGate, formationHalf, volleyCatDamage } from '../src/game/rules'
import { createSim, step } from '../src/game/sim'
import type { GateDef } from '../src/game/config'
import type { Sim, SimEvent } from '../src/game/types'

const DT = 1 / 60

function projectOp(sim: Sim, gate: Sim['gates'][number]): GateDef {
  const streams = Math.min(MAX_STREAMS, Math.max(1, sim.dogs))
  const seconds = Math.max(0.2, gate.dist / SCROLL_SPEED)
  let hits = Math.round((seconds / FIRE_INTERVAL) * streams * 0.55)
  const drum = sim.drums.find((item) => item.alive && item.side === gate.side)
  if (drum) {
    const damage = volleyCatDamage(sim.dogs) / streams
    hits = Math.max(0, hits - Math.floor(drum.hp / Math.max(0.2, damage)))
  }
  return { kind: gate.op.kind, amount: gate.op.amount + hits }
}

function steer(sim: Sim, policy: 'idle' | 'smart' | 'half', locks: Map<number, number>, flips: { n: number }): number {
  if (policy === 'idle') return 0
  let soonest: { dist: number; pairId: number } | null = null
  let left: Sim['gates'][number] | undefined
  let right: Sim['gates'][number] | undefined
  for (const gate of sim.gates) {
    if (gate.passed) continue
    if (gate.side < 0) left = gate
    else right = gate
    if (!soonest || gate.dist < soonest.dist) soonest = { dist: gate.dist, pairId: gate.pairId }
  }
  if (!soonest || !left || !right || left.pairId !== soonest.pairId || soonest.dist > 880) return sim.lane
  const locked = locks.get(soonest.pairId)
  if (locked !== undefined) return locked
  const leftDogs = applyGate(sim.dogs, projectOp(sim, left)).dogs
  const rightDogs = applyGate(sim.dogs, projectOp(sim, right)).dogs
  const best: -1 | 1 = leftDogs >= rightDogs ? -1 : 1
  const takeBest = policy === 'smart' || flips.n % 2 === 0
  if (policy === 'half') flips.n += 1
  const side = takeBest ? best : best === -1 ? 1 : -1
  const lane = side < 0 ? -0.78 : 0.78
  locks.set(soonest.pairId, lane)
  return lane
}

function run(policy: 'idle' | 'smart' | 'half', maxTime = 80) {
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

function hordeLosses(events: Array<SimEvent & { time: number }>): number[] {
  return HORDES.map((horde) => {
    const arrive = horde.time + HORDE_SPAWN / SCROLL_SPEED
    return events.filter((event) => event.type === 'hurt' && event.loss === 1 && event.time >= arrive - 0.15 && event.time <= arrive + 0.45).length
  })
}

test('指を動かさないと、最初の門で負ける', () => {
  const { sim, events } = run('idle', 20)
  console.log(`idle t=${sim.time.toFixed(2)} dogs=${sim.dogs} phase=${sim.phase}`)
  assert.equal(sim.phase, 'lose')
  assert.equal(sim.dogs, 0)
  assert.ok(sim.time < 12, String(sim.time))
  const taken = events.find((event) => event.type === 'gate')
  assert.equal(taken?.type, 'gate')
  if (taken?.type === 'gate') assert.equal(taken.good, false)
})

test('赤い門を撃つと数字が上がって青に変わる', () => {
  const { events } = run('smart', 12)
  const bumps = events.filter((event) => event.type === 'gate-bump')
  const first = bumps[0]
  const flip = bumps.find((event) => event.type === 'gate-bump' && event.flipped)
  assert.equal(first?.type, 'gate-bump')
  assert.equal(flip?.type, 'gate-bump')
  if (first?.type !== 'gate-bump' || flip?.type !== 'gate-bump') return
  const seconds = flip.time - first.time
  console.log(`flip ${seconds.toFixed(2)}s ${first.time.toFixed(2)} -> ${flip.time.toFixed(2)} ${flip.label}`)
  assert.equal(flip.tone, 'blue')
  assert.ok(seconds >= 0.2 && seconds <= 1.2, String(seconds))
})

test('うまく選ぶと×の門で数百匹になり、ボスを倒せる', () => {
  const { sim, events, beforeBoss } = run('smart')
  const losses = hordeLosses(events)
  const jumped = events.find((event) => event.type === 'gate' && event.label.startsWith('×') && event.dogsAfter >= 200)
  console.log(`smart phase=${sim.phase} before=${beforeBoss} leaks=${sim.catLeaks} losses=${losses.join(',')} jump=${jumped && jumped.type === 'gate' ? jumped.dogsAfter : '-'}`)
  assert.equal(sim.phase, 'clear')
  assert.equal(jumped?.type, 'gate')
  if (jumped?.type === 'gate') assert.ok(jumped.dogsAfter >= 250 && jumped.dogsAfter <= 380, String(jumped.dogsAfter))
  assert.ok(beforeBoss >= 400 && beforeBoss <= 700, String(beforeBoss))
  assert.ok(sim.catLeaks <= 12, String(sim.catLeaks))
  assert.equal(losses.length, HORDES.length)
})

test('門を半分外すと匹数は少なく、群れでは多く削られる', () => {
  const good = run('smart')
  const half = run('half')
  const losses = hordeLosses(half.events)
  console.log(`half phase=${half.sim.phase} before=${half.beforeBoss} leaks=${half.sim.catLeaks} losses=${losses.join(',')}`)
  assert.equal(half.sim.phase, 'clear')
  assert.ok(half.beforeBoss < good.beforeBoss)
  assert.ok(half.beforeBoss >= 120 && half.beforeBoss <= 360, String(half.beforeBoss))
  assert.ok(half.sim.catLeaks > good.sim.catLeaks)
  assert.ok(losses.some((loss) => loss >= 4), losses.join(','))
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
