import {
  BOSS_FACE,
  BOSS_HIT_HALF,
  BOSS_STOP,
  BULLET_HIT_DIST,
  BULLET_HIT_LANE,
  BULLET_SPEED,
  BULLET_START,
  CRATE_HIT_HALF,
  CRATE_HP,
  HORDE_SPAWN,
  LANE_SPEED,
  MAX_BULLETS,
  MAX_STREAMS,
  PLAYER_CLEARANCE,
  SCROLL_SPEED,
  SPAWN_DIST,
  CAT_SHOT,
  START_DOGS,
  START_LANE,
  STAMP_FIRST_DELAY,
  STAMP_HIT_HALF,
  STAMP_INTERVALS,
  STAMP_LANE,
  STAMP_SLAM,
  STAMP_WARN,
  VOLLEY_HALF,
  WEAPONS,
} from './config'
import { buildSchedule, type Spawn } from './level'
import { applyGate, bossBulletDamage, clampWeapon, formationHalf, gateLabel, rollStampSide, stampLoss } from './rules'
import type { Boss, Bullet, Cat, Crate, Gate, Sim, SimEvent, WeaponLevel } from './types'

export function createSim(stage = 1): Sim {
  return {
    stage: Math.max(1, Math.floor(stage)),
    time: 0,
    phase: 'play',
    dogs: START_DOGS,
    weapon: clampWeapon(0),
    lane: START_LANE,
    fireCd: 0.18,
    gates: [],
    cats: [],
    crates: [],
    bullets: [],
    stamps: [],
    boss: null,
    clearedAt: null,
    catLeaks: 0,
    nextId: 1,
    cursor: 0,
    schedule: buildSchedule(Math.max(1, Math.floor(stage))),
    events: [],
  }
}

function arm(sim: Sim): { dogs: number; weapon: WeaponLevel } {
  return { dogs: sim.dogs, weapon: sim.weapon }
}

function lose(sim: Sim): void {
  if (sim.phase !== 'play') return
  sim.dogs = 0
  sim.phase = 'lose'
  sim.events.push({ type: 'lose' })
}

function spawnOne(sim: Sim, item: Spawn): void {
  switch (item.kind) {
    case 'gates': {
      const pairId = sim.nextId++
      const sides = [
        { side: -1 as const, op: item.left },
        { side: 1 as const, op: item.right },
      ]
      for (const side of sides) {
        const gate: Gate = {
          id: sim.nextId++,
          pairId,
          side: side.side,
          dist: SPAWN_DIST,
          op: side.op,
          passed: false,
          flash: 0,
        }
        sim.gates.push(gate)
      }
      return
    }
    case 'cat': {
      const cat: Cat = {
        id: sim.nextId++,
        lane: item.lane,
        dist: HORDE_SPAWN + item.depth,
        hp: item.hp,
        maxHp: item.hp,
        brute: item.brute,
        variant: item.variant,
        flash: 0,
        alive: true,
      }
      sim.cats.push(cat)
      return
    }
    case 'crate': {
      const crate: Crate = {
        id: sim.nextId++,
        lane: 0,
        dist: SPAWN_DIST,
        hp: CRATE_HP,
        maxHp: CRATE_HP,
        alive: true,
        flash: 0,
      }
      sim.crates.push(crate)
      return
    }
    case 'boss': {
      if (sim.boss) return
      const boss: Boss = {
        dist: SPAWN_DIST,
        hp: item.hp,
        maxHp: item.hp,
        flash: 0,
        spawnedAt: sim.time,
        stoppedAt: null,
        stampCd: STAMP_FIRST_DELAY,
        stampIndex: 0,
        stampSides: [],
      }
      sim.boss = boss
      return
    }
    default: {
      const unknown: never = item
      void unknown
    }
  }
}

function fire(sim: Sim): void {
  if (sim.dogs <= 0) return
  const stats = WEAPONS[sim.weapon]
  const streams = Math.min(MAX_STREAMS, Math.max(1, sim.dogs))
  const shift = Math.sin(sim.time * 9) * (0.45 / streams)
  for (let pellet = 0; pellet < stats.pellets; pellet += 1) {
    const center = (stats.pellets - 1) / 2
    const spread = (pellet - center) * stats.spread
    for (let i = 0; i < streams; i += 1) {
      const u = streams === 1 ? 0.5 : i / (streams - 1)
      const bullet: Bullet = {
        lane: (u - 0.5) * 2 * VOLLEY_HALF + shift,
        dist: BULLET_START,
        laneVel: spread,
        damage: CAT_SHOT[sim.weapon],
        bossDamage: bossBulletDamage(sim.dogs, sim.weapon, streams),
        weapon: sim.weapon,
        pellet,
        alive: true,
      }
      sim.bullets.push(bullet)
    }
  }
  sim.events.push({ type: 'shoot', weapon: sim.weapon })
}

function resolveGates(sim: Sim): void {
  const ready = new Set<number>()
  for (const gate of sim.gates) {
    if (!gate.passed && gate.dist <= 0) ready.add(gate.pairId)
  }
  for (const pairId of ready) {
    const side: -1 | 1 = sim.lane < 0 ? -1 : 1
    const chosen = sim.gates.find((gate) => gate.pairId === pairId && gate.side === side)
    for (const gate of sim.gates) {
      if (gate.pairId !== pairId) continue
      gate.passed = true
      gate.dist = Math.min(gate.dist, 0)
      gate.flash = gate === chosen ? 1 : 0.35
    }
    if (!chosen || sim.phase !== 'play') continue
    const before = arm(sim)
    const next = applyGate(before, chosen.op)
    sim.dogs = next.army.dogs
    sim.weapon = next.army.weapon
    sim.events.push({
      type: 'gate',
      good: next.good,
      lane: sim.lane,
      dist: 0,
      dogsAfter: sim.dogs,
      label: gateLabel(chosen.op, before.weapon),
    })
    if (sim.dogs <= 0) lose(sim)
  }
}

function stampHits(sim: Sim, lane: number): boolean {
  const half = formationHalf(Math.max(1, sim.dogs))
  const stampLeft = lane - STAMP_HIT_HALF
  const stampRight = lane + STAMP_HIT_HALF
  const formLeft = sim.lane - half
  const formRight = sim.lane + half
  return formLeft <= stampRight && formRight >= stampLeft
}

function resolveStamps(sim: Sim, stepDt: number): void {
  const boss = sim.boss
  if (boss && boss.hp > 0 && boss.stoppedAt !== null) {
    boss.stampCd -= stepDt
    while (boss.stampCd <= 0) {
      const side = rollStampSide(boss.stampSides, Math.random())
      boss.stampSides.push(side)
      if (boss.stampSides.length > 2) boss.stampSides.shift()
      sim.stamps.push({
        side,
        lane: side * STAMP_LANE,
        warn: STAMP_WARN,
        slam: 0,
        resolved: false,
      })
      const interval = STAMP_INTERVALS[boss.stampIndex % STAMP_INTERVALS.length] ?? STAMP_INTERVALS[0]
      boss.stampCd += interval
      boss.stampIndex += 1
    }
  }

  for (const stamp of sim.stamps) {
    if (!stamp.resolved) {
      stamp.warn -= stepDt
      if (stamp.warn > 0) continue
      stamp.resolved = true
      stamp.slam = STAMP_SLAM
      const hit = sim.phase === 'play' && stampHits(sim, stamp.lane)
      sim.events.push({ type: 'stamp', lane: stamp.lane, side: stamp.side, hit })
      if (!hit) continue
      sim.dogs = Math.max(0, sim.dogs - stampLoss(sim.dogs))
      if (sim.dogs <= 0) lose(sim)
    } else {
      stamp.slam -= stepDt
    }
  }
  sim.stamps = sim.stamps.filter((stamp) => !stamp.resolved || stamp.slam > 0)
}

function resolveCats(sim: Sim): void {
  for (const cat of sim.cats) {
    if (!cat.alive || cat.dist > PLAYER_CLEARANCE) continue
    cat.alive = false
    if (sim.phase !== 'play') continue
    sim.dogs = Math.max(0, sim.dogs - 1)
    sim.catLeaks += 1
    sim.events.push({ type: 'hurt', lane: cat.lane, dist: cat.dist })
    if (sim.dogs <= 0) lose(sim)
  }
}

function strike(sim: Sim, bullet: Bullet): void {
  for (const crate of sim.crates) {
    if (!crate.alive) continue
    if (Math.abs(bullet.dist - crate.dist) > BULLET_HIT_DIST) continue
    if (Math.abs(bullet.lane - crate.lane) > CRATE_HIT_HALF) continue
    bullet.alive = false
    crate.hp -= bullet.damage
    crate.flash = 1
    sim.events.push({ type: 'hit', lane: crate.lane, dist: crate.dist, target: 'crate' })
    if (crate.hp <= 0) {
      crate.alive = false
      const before = sim.weapon
      sim.weapon = clampWeapon(sim.weapon + 1)
      sim.events.push({
        type: 'crate',
        lane: crate.lane,
        dist: crate.dist,
        weapon: sim.weapon > before ? sim.weapon : before,
      })
    }
    return
  }

  let closest: Cat | null = null
  let closestGap = Infinity
  for (const cat of sim.cats) {
    if (!cat.alive) continue
    const gap = Math.abs(bullet.dist - cat.dist)
    if (gap > BULLET_HIT_DIST) continue
    if (Math.abs(bullet.lane - cat.lane) > BULLET_HIT_LANE + 0.16 + (cat.brute ? 0.04 : 0)) continue
    if (gap < closestGap) {
      closest = cat
      closestGap = gap
    }
  }
  if (closest) {
    bullet.alive = false
    closest.hp -= bullet.damage
    closest.flash = 1
    sim.events.push({ type: 'hit', lane: closest.lane, dist: closest.dist, target: 'cat' })
    if (closest.hp <= 0) {
      closest.alive = false
      sim.events.push({
        type: 'cat-down',
        lane: closest.lane,
        dist: closest.dist,
        brute: closest.brute,
      })
    }
    return
  }

  const boss = sim.boss
  if (!boss || boss.hp <= 0) return
  if (Math.abs(bullet.dist - boss.dist) > BOSS_FACE) return
  if (Math.abs(bullet.lane) > BOSS_HIT_HALF) return
  bullet.alive = false
  boss.hp -= bullet.bossDamage
  boss.flash = 1
  sim.events.push({ type: 'hit', lane: bullet.lane, dist: boss.dist, target: 'boss' })
  if (boss.hp <= 0 && sim.phase === 'play') {
    boss.hp = 0
    sim.phase = 'clear'
    sim.clearedAt = sim.time
    sim.events.push({ type: 'boss-down' })
  }
}

export function step(sim: Sim, dt: number, targetLane: number | null): SimEvent[] {
  sim.events = []
  if (sim.phase !== 'play') return sim.events
  const stepDt = Math.min(0.05, Math.max(0, dt))
  if (stepDt === 0) return sim.events
  sim.time += stepDt

  if (targetLane !== null) {
    const goal = Math.max(-1, Math.min(1, targetLane))
    const delta = goal - sim.lane
    const maxMove = LANE_SPEED * stepDt
    if (Math.abs(delta) <= maxMove) sim.lane = goal
    else sim.lane += Math.sign(delta) * maxMove
  }

  while (sim.cursor < sim.schedule.length && sim.schedule[sim.cursor].time <= sim.time) {
    spawnOne(sim, sim.schedule[sim.cursor])
    sim.cursor += 1
  }

  for (const gate of sim.gates) {
    if (gate.passed) gate.flash = Math.max(0, gate.flash - stepDt * 2.4)
    else gate.dist -= SCROLL_SPEED * stepDt
  }
  for (const cat of sim.cats) {
    if (!cat.alive) continue
    cat.dist -= SCROLL_SPEED * stepDt
    cat.flash = Math.max(0, cat.flash - stepDt * 7)
  }
  for (const crate of sim.crates) {
    if (!crate.alive) continue
    crate.dist -= SCROLL_SPEED * stepDt
    crate.flash = Math.max(0, crate.flash - stepDt * 6)
  }
  if (sim.boss && sim.boss.hp > 0) {
    sim.boss.flash = Math.max(0, sim.boss.flash - stepDt * 5)
    if (sim.boss.dist > BOSS_STOP) sim.boss.dist = Math.max(BOSS_STOP, sim.boss.dist - SCROLL_SPEED * stepDt)
    if (sim.boss.dist <= BOSS_STOP && sim.boss.stoppedAt === null) sim.boss.stoppedAt = sim.time
  }

  sim.fireCd -= stepDt
  const interval = WEAPONS[sim.weapon].interval
  let shots = 0
  while (sim.fireCd <= 0 && shots < 4 && sim.phase === 'play') {
    sim.fireCd += interval
    fire(sim)
    shots += 1
  }

  for (const bullet of sim.bullets) {
    if (!bullet.alive) continue
    bullet.dist += BULLET_SPEED * stepDt
    bullet.lane += bullet.laneVel * stepDt
    if (bullet.dist > SPAWN_DIST + 80) {
      bullet.alive = false
      continue
    }
    strike(sim, bullet)
  }

  resolveGates(sim)
  resolveCats(sim)
  resolveStamps(sim, stepDt)

  sim.gates = sim.gates.filter((gate) => !gate.passed || gate.flash > 0)
  sim.cats = sim.cats.filter((cat) => cat.alive && cat.dist > -80)
  sim.crates = sim.crates.filter((crate) => crate.alive && crate.dist > -40)
  sim.bullets = sim.bullets.filter((bullet) => bullet.alive)
  if (sim.bullets.length > MAX_BULLETS) sim.bullets.splice(0, sim.bullets.length - MAX_BULLETS)

  return sim.events
}
