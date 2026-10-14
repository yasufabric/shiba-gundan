import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  FIRE_INTERVAL,
  FORMATION,
  GATE_BODY,
  HORDES,
  HORDE_GAPS,
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
  if (gate.op.kind === 'mul' && amount > LATE_MUL_CAP && (gate.held || sim.time > LATE_MUL_AFTER)) amount = LATE_MUL_CAP
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

function lookAhead(sim: Sim, side: -1 | 1, pairId: number): number {
  const copy = structuredClone(sim)
  let guard = 0
  while (copy.phase === 'play' && guard < 500) {
    const gate = copy.gates.find((item) => item.pairId === pairId && item.side === side)
    const lane = gate && gate.slide > 0 ? Math.max(-1, Math.min(1, side * GATE_BODY + gate.shift)) : side < 0 ? -0.78 : 0.78
    step(copy, DT, lane, false)
    const pending = copy.gates.some((item) => item.pairId === pairId && !item.passed)
    if (!pending) return copy.dogs
    guard += 1
  }
  return copy.dogs
}

function hordeLane(sim: Sim): number | null {
  const living = sim.cats.filter((cat) => cat.alive && cat.dist > 26 && cat.dist < 360)
  if (living.length < 12) return null
  const nearest = Math.min(...living.map((cat) => cat.dist))
  const wave = living.filter((cat) => Math.abs(cat.dist - nearest) < 50)
  const reach = Math.min(FORMATION.halfMax, FORMATION.halfBase + FORMATION.halfPerDog * sim.dogs) + FORMATION.catBody
  let bestLane = 0
  let bestHits = Infinity
  const lanes = [0, ...HORDE_GAPS.map((gap) => gap.lane)]
  for (const lane of lanes) {
    const hits = wave.filter((cat) => Math.abs(cat.lane - lane) <= reach).length
    if (hits < bestHits) {
      bestHits = hits
      bestLane = lane
    }
  }
  return bestLane
}

function steer(sim: Sim, policy: 'idle' | 'smart' | 'half' | 'best', locks: Map<number, number>, flips: { n: number }): number {
  if (policy === 'idle') return 0
  const pair = soonestPair(sim)
  if (policy === 'smart' || policy === 'best') {
    const gap = hordeLane(sim)
    if (gap !== null && (!pair || pair.left.dist > 260)) return gap
  }
  if (!pair) return sim.lane
  const locked = locks.get(pair.pairId)
  if (locked !== undefined) return laneFor(locked < 0 ? pair.left : pair.right, locked as -1 | 1)
  let side: -1 | 1
  if (policy === 'best') {
    const leftDogs = lookAhead(sim, -1, pair.pairId)
    const rightDogs = lookAhead(sim, 1, pair.pairId)
    side = leftDogs >= rightDogs ? -1 : 1
  } else {
    const leftDogs = applyGate(sim.dogs, projectOp(sim, pair.left)).dogs
    const rightDogs = applyGate(sim.dogs, projectOp(sim, pair.right)).dogs
    const best: -1 | 1 = leftDogs >= rightDogs ? -1 : 1
    const takeBest = policy === 'smart' || flips.n % 2 === 0
    if (policy === 'half') flips.n += 1
    side = takeBest ? best : best === -1 ? 1 : -1
  }
  locks.set(pair.pairId, side)
  return laneFor(side < 0 ? pair.left : pair.right, side)
}

function laneFor(gate: Sim['gates'][number], side: -1 | 1): number {
  if (gate.slide > 0) return Math.max(-1, Math.min(1, side * GATE_BODY + gate.shift))
  return side < 0 ? -0.78 : 0.78
}

function fightSeconds(sim: Sim): number {
  if (!sim.boss || sim.clearedAt === null) return -1
  return sim.clearedAt - sim.boss.spawnedAt
}

function run(policy: 'idle' | 'smart' | 'half' | 'best', maxTime = 80, stage = 1) {
  const sim = createSim(stage)
  const events: Array<SimEvent & { time: number }> = []
  const locks = new Map<number, number>()
  const flips = { n: 0 }
  let beforeBoss = -1
  while (sim.time < maxTime && sim.phase === 'play') {
    const bossUp = sim.bosses.some((boss) => !boss.preview && boss.hp > 0)
    const frame = step(sim, DT, steer(sim, policy, locks, flips), policy !== 'idle' && bossUp && sim.rocketCd <= 0)
    if (sim.bosses.some((boss) => !boss.preview) && beforeBoss < 0) beforeBoss = sim.dogs
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

test('うまく選ぶとボス前は約380匹で、群れでは1〜2割減り、残り約9秒で倒す', () => {
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
  assert.ok(beforeBoss >= 360 && beforeBoss <= 420, String(beforeBoss))
  assert.ok(sim.clearMargin !== null && sim.clearMargin >= 7 && sim.clearMargin <= 12, String(sim.clearMargin))
  assert.ok(fight >= 8 && fight <= 13, String(fight))
  assert.equal(losses.length, HORDES.length)
  for (const row of losses) {
    assert.ok(row.ratio >= 0.1 && row.ratio <= 0.2, `${row.loss}/${row.before}`)
  }
})

test('門を半分外すと厚い列で3割以上減り、1面はぎりぎり勝つ', () => {
  const good = run('smart')
  const half = run('half')
  const losses = hordeReport(half.events)
  const fight = fightSeconds(half.sim)
  console.log(
    `half phase=${half.sim.phase} before=${half.beforeBoss} fight=${fight.toFixed(2)} ${losses.map((row) => `${row.loss}/${row.before}`).join(',')}`,
  )
  assert.equal(half.sim.phase, 'clear')
  assert.ok(half.beforeBoss < good.beforeBoss)
  assert.ok(half.beforeBoss >= 140 && half.beforeBoss <= 200, String(half.beforeBoss))
  assert.ok(half.sim.clearMargin !== null && half.sim.clearMargin > 0 && half.sim.clearMargin < 6, String(half.sim.clearMargin))
  assert.ok(fight >= 14 && fight <= 20.2, String(fight))
  const thick = Math.max(...losses.map((row) => row.ratio))
  assert.ok(thick >= 0.3, losses.map((row) => `${row.loss}/${row.before}`).join(','))
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
    shield: 0,
    maxShield: 0,
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
    shield: 0,
    maxShield: 0,
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
    baseLane: 0.58,
  })
  step(sim, DT, 0.78)
  assert.equal(sim.dogs, 12)
})

test('3面の最初の盾猫は1匹でも倒せて、15秒までは減らない', () => {
  const sim = createSim(3)
  let dogs = 1
  let dropped = false
  while (sim.time < 16 && sim.phase === 'play') {
    const frame = step(sim, DT, 0, false)
    for (const event of frame) {
      if (event.type === 'hurt') dropped = true
      if (event.type === 'gate' && event.dogsAfter < dogs) dropped = true
      if (event.type === 'gate') dogs = event.dogsAfter
    }
  }
  assert.equal(dropped, false)
  assert.equal(sim.phase, 'play')
  assert.equal(sim.cats.some((cat) => cat.alive && cat.shield > 0 && cat.maxShield < 20), false)
})

test('4面の小さなボスは倒れてもクリアにならず、届いても負けにならない', () => {
  const sim = createSim(4)
  while (sim.time < 12 && sim.phase === 'play') step(sim, DT, 0, false)
  const preview = sim.bosses.find((boss) => boss.preview)
  assert.ok(preview)
  assert.ok((preview?.hp ?? 1) <= 0)
  assert.equal(sim.phase, 'play')
  assert.equal(sim.dogs > 0, true)
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

test('揺れる門から外れると増減せず、門の上にいると入る', () => {
  const missed = createSim(1)
  missed.schedule = []
  missed.dogs = 10
  missed.lane = -1
  const slide = 0.9
  const phase = Math.PI / 2
  missed.gates.push(
    {
      id: 2,
      pairId: 1,
      side: -1,
      dist: 1,
      op: { kind: 'add', amount: 20 },
      passed: false,
      flash: 0,
      pop: 0,
      sealed: false,
      slide,
      phase,
      shift: 0,
      held: false,
    },
    {
      id: 3,
      pairId: 1,
      side: 1,
      dist: 1,
      op: { kind: 'add', amount: 4 },
      passed: false,
      flash: 0,
      pop: 0,
      sealed: false,
      slide,
      phase,
      shift: 0,
      held: false,
    },
  )
  step(missed, DT, -1)
  assert.equal(missed.dogs, 10)

  const stood = createSim(1)
  stood.schedule = []
  stood.dogs = 10
  stood.gates.push(
    {
      id: 2,
      pairId: 1,
      side: -1,
      dist: 1,
      op: { kind: 'add', amount: 20 },
      passed: false,
      flash: 0,
      pop: 0,
      sealed: false,
      slide,
      phase,
      shift: 0,
      held: false,
    },
    {
      id: 3,
      pairId: 1,
      side: 1,
      dist: 1,
      op: { kind: 'add', amount: 4 },
      passed: false,
      flash: 0,
      pop: 0,
      sealed: false,
      slide,
      phase,
      shift: 0,
      held: false,
    },
  )
  step(stood, DT, -0.52 + slide)
  assert.equal(stood.dogs, 30)
})

test('盾の猫は本体に弾を通さず、触れると3匹減る', () => {
  const sim = createSim(1)
  sim.schedule = []
  sim.dogs = 20
  sim.lane = 0
  sim.fireCd = 0
  sim.cats.push({
    id: 1,
    lane: 0,
    dist: 80,
    hp: 40,
    maxHp: 40,
    shield: 80,
    maxShield: 80,
    brute: false,
    variant: 0,
    flash: 0,
    alive: true,
  })
  let guard = 0
  while (sim.cats[0] && sim.cats[0].shield === 80 && guard < 30) {
    step(sim, DT, 0)
    guard += 1
  }
  const cat = sim.cats[0]
  assert.ok(cat)
  assert.equal(cat?.hp, 40)
  assert.ok((cat?.shield ?? 80) < 80)
  if (cat) cat.dist = 10
  sim.dogs = 20
  step(sim, DT, 0)
  assert.equal(sim.dogs, 17)
})

test('上手いルートの残り時間は面が進むほど短く、門を半分外すと3面から負ける', () => {
  const goals = [9, 6, 4, 2.5]
  for (let stage = 1; stage <= 4; stage += 1) {
    const skilled = run('smart', 100, stage)
    const margin = skilled.sim.clearMargin
    console.log(`ladder smart s${stage} ${skilled.sim.phase} dogs=${skilled.beforeBoss} margin=${margin?.toFixed(2) ?? '-'}`)
    assert.equal(skilled.sim.phase, 'clear')
    assert.ok(margin !== null && Math.abs(margin - (goals[stage - 1] ?? 0)) < 2, String(margin))
    if (stage === 4) assert.ok(margin >= 2 && margin <= 3, String(margin))
    const half = run('half', 100, stage)
    console.log(`ladder half s${stage} ${half.sim.phase} dogs=${half.beforeBoss} margin=${half.sim.clearMargin?.toFixed(2) ?? '-'}`)
    assert.equal(half.sim.phase, stage <= 2 ? 'clear' : 'lose')
  }
})
