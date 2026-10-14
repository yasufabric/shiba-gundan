import {
  BOSS_FACE,
  BOSS_HIT_HALF,
  BOSS_REACH,
  BOSS_SPEED,
  GATE_SLIDE_RATE,
  BULLET_HIT_DIST,
  BULLET_HIT_LANE,
  BULLET_SPEED,
  BULLET_START,
  DRUM_AHEAD,
  DRUM_BODY,
  DRUM_HIT_HALF,
  DRUM_LANE,
  DRUM_LOSS,
  FIRE_INTERVAL,
  FORMATION,
  DRUM_RANGE,
  GATE_GAP,
  GATE_HIT_DIST,
  GATE_RANGE,
  HORDE_SPAWN,
  LANE_SPEED,
  MAX_BULLETS,
  MAX_STREAMS,
  PLAYER_CLEARANCE,
  ROCKET_COOLDOWN,
  ROCKET_DAMAGE,
  ROCKET_SPEED,
  SCROLL_SPEED,
  SPAWN_DIST,
  START_DOGS,
  START_LANE,
} from './config'
import { buildSchedule, type Spawn } from './level'
import { applyGate, bossBulletDamage, bumpGate, formationHalf, gateLabel, gateTone, volleyCatDamage } from './rules'
import type { Boss, Bullet, Cat, Drum, Gate, Sim, SimEvent } from './types'

export function createSim(stage = 1): Sim {
  return {
    stage: Math.max(1, Math.floor(stage)),
    time: 0,
    phase: 'play',
    dogs: START_DOGS,
    lane: START_LANE,
    fireCd: 0.12,
    rocketCd: 0,
    gates: [],
    cats: [],
    drums: [],
    bullets: [],
    boss: null,
    bosses: [],
    clearedAt: null,
    catLeaks: 0,
    nextId: 1,
    cursor: 0,
    schedule: buildSchedule(Math.max(1, Math.floor(stage))),
    events: [],
  }
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
          dist: item.dist ?? SPAWN_DIST,
          op: { kind: side.op.kind, amount: side.op.amount },
          passed: false,
          flash: 0,
          pop: 0,
          sealed: false,
          slide: item.slide,
          phase: item.time,
          shift: 0,
        }
        sim.gates.push(gate)
      }
      if (item.drum) {
        const side: -1 | 1 = item.drum.side === 'left' ? -1 : 1
        const drum: Drum = {
          id: sim.nextId++,
          side,
          lane: side * DRUM_LANE,
          dist: SPAWN_DIST - DRUM_AHEAD,
          hp: item.drum.hp,
          maxHp: item.drum.hp,
          alive: true,
          flash: 0,
          baseLane: side * DRUM_LANE,
        }
        sim.drums.push(drum)
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
        shield: item.shield,
        maxShield: item.shield,
      }
      sim.cats.push(cat)
      return
    }
    case 'boss': {
      const boss: Boss = {
        dist: SPAWN_DIST + (item.behind || 0),
        lane: item.lane || 0,
        hp: item.hp,
        maxHp: item.hp,
        flash: 0,
        spawnedAt: sim.time,
        stoppedAt: null,
        preview: item.preview === true,
      }
      sim.bosses.push(boss)
      syncLead(sim)
      return
    }
    default: {
      const unknown: never = item
      void unknown
    }
  }
}

function fire(sim: Sim): void {
  if (sim.dogs <= 0 || sim.phase !== 'play') return
  const streams = Math.min(MAX_STREAMS, Math.max(1, sim.dogs))
  const half = formationHalf(sim.dogs)
  const damage = volleyCatDamage(sim.dogs) / streams
  const bossDamage = bossBulletDamage(sim.dogs, streams)
  for (let i = 0; i < streams; i += 1) {
    const u = streams === 1 ? 0.5 : i / (streams - 1)
    const bullet: Bullet = {
      kind: 'pellet',
      lane: sim.lane + (u - 0.5) * 2 * half,
      dist: BULLET_START,
      damage,
      bossDamage,
      alive: true,
    }
    sim.bullets.push(bullet)
  }
  sim.events.push({ type: 'shoot' })
}

function launchRocket(sim: Sim): void {
  const boss = sim.boss
  if (!boss || boss.hp <= 0 || sim.phase !== 'play' || sim.rocketCd > 0) return
  sim.rocketCd = ROCKET_COOLDOWN
  const rocket: Bullet = {
    kind: 'rocket',
    lane: sim.lane,
    dist: BULLET_START,
    damage: 0,
    bossDamage: ROCKET_DAMAGE,
    alive: true,
  }
  sim.bullets.push(rocket)
  sim.events.push({ type: 'rocket' })
}

function gateCovers(gate: Gate, lane: number): boolean {
  const center = gate.shift
  if (gate.side < 0) return lane <= center - GATE_GAP
  return lane >= center + GATE_GAP
}

function syncLead(sim: Sim): void {
  let lead: Boss | null = null
  for (const boss of sim.bosses) {
    if (boss.hp <= 0) continue
    if (!lead || boss.dist < lead.dist) lead = boss
  }
  sim.boss = lead ?? sim.bosses[sim.bosses.length - 1] ?? null
}

function realBosses(sim: Sim): Boss[] {
  return sim.bosses.filter((boss) => !boss.preview)
}

function maybeClear(sim: Sim): void {
  const real = realBosses(sim)
  if (real.length === 0 || sim.phase !== 'play') return
  if (real.every((boss) => boss.hp <= 0)) {
    sim.phase = 'clear'
    sim.clearedAt = sim.time
    sim.events.push({ type: 'boss-down' })
  }
}

function overlapsFormation(sim: Sim, lane: number, radius: number): boolean {
  const half = formationHalf(Math.max(1, sim.dogs))
  return Math.abs(lane - sim.lane) <= half + radius
}

function resolveGates(sim: Sim): void {
  const ready = new Set<number>()
  for (const gate of sim.gates) {
    if (!gate.passed && gate.dist <= 0) ready.add(gate.pairId)
  }
  for (const pairId of ready) {
    const center = sim.gates.find((gate) => gate.pairId === pairId)?.shift ?? 0
    const side: -1 | 1 = sim.lane < center ? -1 : 1
    const chosen = sim.gates.find((gate) => gate.pairId === pairId && gate.side === side)
    for (const gate of sim.gates) {
      if (gate.pairId !== pairId) continue
      gate.passed = true
      gate.dist = Math.min(gate.dist, 0)
      gate.flash = gate === chosen ? 1 : 0.35
    }
    if (!chosen || sim.phase !== 'play') continue
    const next = applyGate(sim.dogs, chosen.op)
    sim.dogs = next.dogs
    sim.events.push({
      type: 'gate',
      good: next.good,
      lane: sim.lane,
      dist: 0,
      dogsAfter: sim.dogs,
      label: gateLabel(chosen.op),
    })
    if (sim.dogs <= 0) lose(sim)
  }
}

function gateForDrum(sim: Sim, drum: Drum): Gate | undefined {
  let best: Gate | undefined
  let gap = Infinity
  for (const gate of sim.gates) {
    if (gate.passed || gate.side !== drum.side) continue
    const delta = Math.abs(gate.dist - drum.dist - DRUM_AHEAD)
    if (delta < gap) {
      gap = delta
      best = gate
    }
  }
  return best
}

function resolveDrums(sim: Sim): void {
  for (const drum of sim.drums) {
    if (!drum.alive || drum.dist > PLAYER_CLEARANCE) continue
    const gate = gateForDrum(sim, drum)
    if (gate) gate.sealed = true
    const hit = overlapsFormation(sim, drum.lane, DRUM_BODY)
    drum.alive = false
    if (!hit || sim.phase !== 'play') continue
    sim.dogs = Math.max(0, sim.dogs - DRUM_LOSS)
    sim.events.push({ type: 'hurt', lane: drum.lane, dist: drum.dist, loss: DRUM_LOSS })
    if (sim.dogs <= 0) lose(sim)
  }
}

function resolveCats(sim: Sim): void {
  for (const cat of sim.cats) {
    if (!cat.alive || cat.dist > PLAYER_CLEARANCE) continue
    const hit = overlapsFormation(sim, cat.lane, FORMATION.catBody)
    if (!hit) continue
    cat.alive = false
    if (sim.phase !== 'play') continue
    sim.dogs = Math.max(0, sim.dogs - 1)
    sim.catLeaks += 1
    sim.events.push({ type: 'hurt', lane: cat.lane, dist: cat.dist, loss: 1 })
    if (sim.dogs <= 0) lose(sim)
  }
}

function strikeDrum(sim: Sim, bullet: Bullet): boolean {
  let closest: Drum | null = null
  let closestGap = Infinity
  for (const drum of sim.drums) {
    if (!drum.alive || drum.dist > DRUM_RANGE) continue
    const gap = Math.abs(bullet.dist - drum.dist)
    if (gap > BULLET_HIT_DIST) continue
    if (Math.abs(bullet.lane - drum.lane) > DRUM_HIT_HALF) continue
    if (gap < closestGap) {
      closest = drum
      closestGap = gap
    }
  }
  if (!closest) return false
  bullet.alive = false
  closest.hp -= bullet.damage
  closest.flash = 1
  sim.events.push({ type: 'hit', lane: closest.lane, dist: closest.dist, target: 'drum' })
  if (closest.hp <= 0) {
    closest.alive = false
    sim.events.push({ type: 'drum', lane: closest.lane, dist: closest.dist })
  }
  return true
}

function strikeGate(sim: Sim, bullet: Bullet): boolean {
  let closest: Gate | null = null
  let closestGap = Infinity
  for (const gate of sim.gates) {
    if (gate.passed || gate.sealed || gate.dist > GATE_RANGE) continue
    const gap = Math.abs(bullet.dist - gate.dist)
    if (gap > GATE_HIT_DIST) continue
    if (!gateCovers(gate, bullet.lane)) continue
    if (gap < closestGap) {
      closest = gate
      closestGap = gap
    }
  }
  if (!closest) return false
  bullet.alive = false
  const before = gateTone(closest.op)
  const next = bumpGate(closest.op, sim.time)
  const changed = next.amount !== closest.op.amount || next.kind !== closest.op.kind
  closest.op = next
  const tone = gateTone(closest.op)
  closest.flash = 1
  if (changed) {
    closest.pop = 1
    sim.events.push({
      type: 'gate-bump',
      lane: closest.side < 0 ? -0.52 : 0.52,
      dist: closest.dist,
      label: gateLabel(closest.op),
      tone,
      flipped: before !== tone,
    })
  }
  sim.events.push({ type: 'hit', lane: bullet.lane, dist: closest.dist, target: 'gate' })
  return true
}

function strikeCat(sim: Sim, bullet: Bullet): boolean {
  let closest: Cat | null = null
  let closestGap = Infinity
  for (const cat of sim.cats) {
    if (!cat.alive) continue
    const gap = Math.abs(bullet.dist - cat.dist)
    if (gap > BULLET_HIT_DIST) continue
    if (Math.abs(bullet.lane - cat.lane) > BULLET_HIT_LANE + 0.16) continue
    if (gap < closestGap) {
      closest = cat
      closestGap = gap
    }
  }
  if (!closest) return false
  bullet.alive = false
  if (closest.shield > 0) closest.shield = Math.max(0, closest.shield - bullet.damage)
  else closest.hp -= bullet.damage
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
  return true
}

function strikeBoss(sim: Sim, bullet: Bullet): boolean {
  let boss: Boss | null = null
  let best = Infinity
  for (const candidate of sim.bosses) {
    if (candidate.hp <= 0) continue
    if (Math.abs(bullet.dist - candidate.dist) > BOSS_FACE) continue
    const laneGap = Math.abs(bullet.lane - candidate.lane)
    if (laneGap > BOSS_HIT_HALF) continue
    const rank = candidate.dist + laneGap * 40
    if (rank < best) {
      boss = candidate
      best = rank
    }
  }
  if (!boss) return false
  bullet.alive = false
  boss.hp -= bullet.bossDamage
  boss.flash = 1
  sim.events.push({ type: 'hit', lane: bullet.lane, dist: boss.dist, target: 'boss' })
  if (boss.hp <= 0) {
    boss.hp = 0
    if (!boss.preview) maybeClear(sim)
  }
  return true
}

function strike(sim: Sim, bullet: Bullet): void {
  if (bullet.kind === 'rocket') {
    strikeBoss(sim, bullet)
    return
  }
  if (strikeDrum(sim, bullet)) return
  if (strikeGate(sim, bullet)) return
  if (strikeCat(sim, bullet)) return
  strikeBoss(sim, bullet)
}

export function step(sim: Sim, dt: number, targetLane: number | null, rocket = false): SimEvent[] {
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
    gate.pop = Math.max(0, gate.pop - stepDt * 3.4)
    gate.shift = gate.slide === 0 ? 0 : Math.sin(sim.time * GATE_SLIDE_RATE + gate.phase) * gate.slide
    if (gate.passed) gate.flash = Math.max(0, gate.flash - stepDt * 2.4)
    else {
      gate.dist -= SCROLL_SPEED * stepDt
      gate.flash = Math.max(0, gate.flash - stepDt * 3.2)
    }
  }
  for (const cat of sim.cats) {
    if (!cat.alive) continue
    cat.dist -= SCROLL_SPEED * stepDt
    cat.flash = Math.max(0, cat.flash - stepDt * 7)
  }
  for (const drum of sim.drums) {
    if (!drum.alive) continue
    const gate = gateForDrum(sim, drum)
    drum.lane = drum.baseLane + (gate?.shift ?? 0)
    drum.dist -= SCROLL_SPEED * stepDt
    drum.flash = Math.max(0, drum.flash - stepDt * 6)
  }
  for (const boss of sim.bosses) {
    if (boss.hp <= 0) continue
    boss.flash = Math.max(0, boss.flash - stepDt * 5)
    boss.dist = Math.max(BOSS_REACH, boss.dist - BOSS_SPEED * stepDt)
  }

  sim.rocketCd = Math.max(0, sim.rocketCd - stepDt)
  if (rocket) launchRocket(sim)

  sim.fireCd -= stepDt
  let shots = 0
  while (sim.fireCd <= 0 && shots < 4 && sim.phase === 'play') {
    sim.fireCd += FIRE_INTERVAL
    fire(sim)
    shots += 1
  }

  for (const bullet of sim.bullets) {
    if (!bullet.alive) continue
    const speed = bullet.kind === 'rocket' ? ROCKET_SPEED : BULLET_SPEED
    bullet.dist += speed * stepDt
    if (bullet.dist > SPAWN_DIST + 80) {
      bullet.alive = false
      continue
    }
    strike(sim, bullet)
  }

  resolveGates(sim)
  resolveDrums(sim)
  resolveCats(sim)
  for (const boss of sim.bosses) {
    if (boss.hp <= 0 || boss.dist > BOSS_REACH || sim.phase !== 'play') continue
    boss.dist = BOSS_REACH
    if (boss.preview) {
      boss.hp = 0
      continue
    }
    boss.stoppedAt = sim.time
    lose(sim)
    break
  }
  syncLead(sim)

  sim.gates = sim.gates.filter((gate) => !gate.passed || gate.flash > 0)
  sim.cats = sim.cats.filter((cat) => cat.alive && cat.dist > -80)
  sim.drums = sim.drums.filter((drum) => drum.alive && drum.dist > -40)
  sim.bullets = sim.bullets.filter((bullet) => bullet.alive)
  if (sim.bullets.length > MAX_BULLETS) sim.bullets.splice(0, sim.bullets.length - MAX_BULLETS)

  return sim.events
}
