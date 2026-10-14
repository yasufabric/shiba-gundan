import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOSS_HP,
  BOSS_SPAWN,
  FORMATION,
  GATE_BODY,
  GATE_PAIRS,
  SHIELD_LOSS,
  HORDES,
  HORDE_LANE,
  HORDE_MAX,
  HORDE_ROWS,
  MINI_BOSS,
  SCROLL_SPEED,
  SPAWN_DIST,
  START_DOGS,
  TUTORIAL_GATE,
  bossHpMultiplier,
} from '../src/game/config'
import { beanOffsets, project, troopLabelRect } from '../src/game/layout'
import { buildSchedule, stageFeatures } from '../src/game/level'
import { applyGate, bumpGate, countFontSize, formationHalf, gateLabel, gateTone, isRedGate } from '../src/game/rules'

test('豆柴は1匹から始まり、門は青の＋×と赤の−÷', () => {
  assert.equal(START_DOGS, 1)
  assert.ok(GATE_PAIRS.length >= 4)
  for (const pair of GATE_PAIRS) {
    const same = pair.left.kind === pair.right.kind && pair.left.amount === pair.right.amount
    assert.equal(same, false)
    for (const op of [pair.left, pair.right]) {
      assert.ok(op.kind === 'add' || op.kind === 'mul')
    }
  }
  assert.equal(gateTone({ kind: 'add', amount: 20 }), 'blue')
  assert.equal(gateLabel({ kind: 'add', amount: 20 }), '+20')
  assert.equal(gateTone({ kind: 'add', amount: -4 }), 'red')
  assert.equal(gateLabel({ kind: 'add', amount: -4 }), '−4')
  assert.equal(gateTone({ kind: 'mul', amount: 3 }), 'blue')
  assert.equal(gateLabel({ kind: 'mul', amount: 3 }), '×3')
  assert.equal(gateTone({ kind: 'mul', amount: -6 }), 'red')
  assert.equal(gateLabel({ kind: 'mul', amount: -6 }), '÷6')
  assert.equal(isRedGate({ kind: 'mul', amount: 1 }), false)
  assert.equal(gateLabel({ kind: 'mul', amount: 1 }), '×1')
  assert.equal(applyGate(1, { kind: 'add', amount: -4 }).dogs, 0)
  assert.equal(applyGate(7, { kind: 'add', amount: 20 }).dogs, 27)
  assert.equal(applyGate(7, { kind: 'mul', amount: 3 }).dogs, 21)
  assert.equal(applyGate(7, { kind: 'mul', amount: -2 }).dogs, 3)
  const flipped = bumpGate({ kind: 'add', amount: -1 })
  assert.equal(flipped.amount, 0)
  assert.equal(gateTone(flipped), 'blue')
})

test('隊列の横幅は道の3分の1で止まり、描く豆柴は80匹まで', () => {
  assert.equal(formationHalf(1) < FORMATION.halfMax, true)
  assert.equal(formationHalf(300), FORMATION.halfMax)
  assert.equal(FORMATION.halfMax, 1 / 3)
  const packed = beanOffsets(300, 1)
  assert.equal(packed.length, FORMATION.drawMax)
  assert.ok(packed.every((slot) => Math.abs(slot.lane) <= FORMATION.halfMax + 1e-6))
  const rows = new Set(packed.map((slot) => slot.dist))
  assert.ok(rows.size > 1)
  const small = beanOffsets(4, 1)
  assert.equal(small.length, 4)
  assert.ok(countFontSize(80) < countFontSize(300))
  assert.ok(countFontSize(300) <= FORMATION.countMax)
})

test('最初の加算は増える青だけで、15秒以内に×2を一度見せ、赤と÷は15秒後', () => {
  assert.ok(GATE_PAIRS.length >= 4)
  const opening = GATE_PAIRS.filter((pair) => pair.time <= 15 && !pair.holdMul)
  assert.ok(opening.length >= 2)
  for (const pair of opening) {
    for (const op of [pair.left, pair.right]) {
      assert.equal(isRedGate(op), false)
      assert.equal(op.kind, 'add')
      assert.ok(applyGate(START_DOGS, op).dogs > START_DOGS)
    }
  }
  const earlyMul = GATE_PAIRS.filter((pair) => pair.holdMul)
  assert.equal(earlyMul.length, 1)
  const shown = earlyMul[0]
  assert.ok(shown)
  assert.ok(shown.time <= 15)
  const mulSide = [shown.left, shown.right].find((op) => op.kind === 'mul')
  const addSide = [shown.left, shown.right].find((op) => op.kind === 'add')
  assert.equal(mulSide?.kind, 'mul')
  assert.equal(mulSide?.amount, 2)
  assert.equal(isRedGate(mulSide ?? shown.left), false)
  assert.equal(addSide?.kind, 'add')
  assert.ok((addSide?.amount ?? 0) > 0)
  const later = GATE_PAIRS.filter((pair) => isRedGate(pair.left) || isRedGate(pair.right))
  assert.ok(later.length >= 1)
  for (const pair of later) assert.ok(pair.time > 15)
  for (const pair of GATE_PAIRS) {
    for (const op of [pair.left, pair.right]) {
      if (op.kind === 'mul' && op.amount <= -2) assert.ok(pair.time > 15)
      if (op.kind === 'mul' && op.amount >= 2 && !pair.holdMul) assert.ok(pair.time > 15)
    }
  }
  assert.equal(bumpGate({ kind: 'mul', amount: 2 }, 16).amount, 2)
  let capped = { kind: 'mul' as const, amount: -6 }
  for (let i = 0; i < 30; i += 1) capped = bumpGate(capped, 16)
  assert.equal(capped.amount, 2)
})

test('猫の群れは想定匹数の固定値で、ボスは最後', () => {
  assert.equal(HORDE_ROWS, 1)
  assert.equal(HORDE_LANE, 1)
  assert.ok(HORDES.length >= 2)
  assert.equal(new Set(HORDES.map((horde) => horde.count)).size, 1)
  let total = 0
  for (const horde of HORDES) {
    assert.ok(horde.count >= 8 && horde.count <= HORDE_MAX)
    assert.ok(horde.hp > 0)
    total += horde.count
  }
  const cats = buildSchedule(1).filter((item) => item.kind === 'cat')
  assert.equal(cats.length, total)
  const lanes = cats.map((cat) => (cat.kind === 'cat' ? cat.lane : 0))
  assert.ok(Math.min(...lanes) <= -0.95)
  assert.ok(Math.max(...lanes) >= 0.95)
  assert.ok(BOSS_SPAWN > (HORDES[HORDES.length - 1]?.time ?? 0))
  assert.ok(BOSS_HP > 0)
  const kinds = new Set(buildSchedule(1).map((item) => item.kind))
  assert.equal(kinds.has('gates'), true)
  assert.equal(kinds.has('boss'), true)
})

test('×の門の手前にドラム缶がある', () => {
  const drums = GATE_PAIRS.filter((pair) => pair.drum)
  assert.ok(drums.length >= 1)
  const multiplied = GATE_PAIRS.find((pair) => !pair.holdMul && (pair.left.kind === 'mul' && pair.left.amount >= 2 || pair.right.kind === 'mul' && pair.right.amount >= 2))
  assert.ok(multiplied?.drum)
})

test('1面の並びは変えず、2面以降は要素を1つずつ足す', () => {
  const first = buildSchedule(1)
  const gates = first.filter((item) => item.kind === 'gates')
  assert.equal(gates.length, GATE_PAIRS.length)
  assert.ok(gates.every((item) => item.kind === 'gates' && item.slide === 0 && item.time >= GATE_PAIRS[0].time))
  const bosses = first.filter((item) => item.kind === 'boss')
  assert.equal(bosses.length, 1)
  assert.equal(bosses[0]?.kind === 'boss' ? bosses[0].hp : 0, BOSS_HP)
  assert.equal(stageFeatures(1).pressure, 1)
  assert.equal(stageFeatures(2).slide, true)
  assert.equal(stageFeatures(2).shield, false)
  assert.equal(stageFeatures(2).twin, false)
  assert.equal(stageFeatures(3).shield, true)
  assert.equal(stageFeatures(3).slide, false)
  assert.equal(stageFeatures(4).twin, true)
  assert.equal(stageFeatures(5).slide && stageFeatures(5).shield && stageFeatures(5).twin, true)
  assert.ok(stageFeatures(5).pressure > 1)

  const slide = buildSchedule(2).filter((item) => item.kind === 'gates')
  const tutorial = slide.find((item) => item.kind === 'gates' && item.time === TUTORIAL_GATE.time)
  assert.equal(tutorial?.kind, 'gates')
  if (tutorial?.kind === 'gates') {
    assert.ok(tutorial.time < 10)
    assert.ok(tutorial.slide > 0)
    assert.equal(tutorial.left.amount > 0 && tutorial.right.amount > 0, true)
    const seen = tutorial.time + (tutorial.dist ?? SPAWN_DIST) / SCROLL_SPEED
    assert.ok(seen < 10, String(seen))
    assert.ok(seen > GATE_PAIRS[0].time + SPAWN_DIST / SCROLL_SPEED)
  }
  assert.ok(slide.every((item) => item.kind === 'gates' && item.slide > 0))
  const boss2 = buildSchedule(2).find((item) => item.kind === 'boss')
  assert.equal(boss2?.kind === 'boss' ? boss2.hp : 0, BOSS_HP * bossHpMultiplier(2))

  const shieldCats = buildSchedule(3).filter((item) => item.kind === 'cat')
  const early = shieldCats.filter((item) => item.kind === 'cat' && item.time < 10)
  const late = shieldCats.filter((item) => item.kind === 'cat' && item.time > 10)
  assert.ok(early.length > 0 && early.every((item) => item.kind === 'cat' && item.shield > 0 && item.shield < 20))
  assert.ok(late.every((item) => item.kind === 'cat' && item.shield > 100))

  const twin = buildSchedule(4).filter((item) => item.kind === 'boss')
  assert.equal(twin.length, 3)
  const preview = twin.find((item) => item.kind === 'boss' && item.preview)
  const real = twin.filter((item) => item.kind === 'boss' && !item.preview)
  assert.equal(preview?.kind, 'boss')
  if (preview?.kind === 'boss') {
    assert.ok(preview.time < 10)
    assert.equal(preview.hp, MINI_BOSS.hp)
  }
  assert.equal(real.length, 2)
  assert.ok(real.every((item) => item.kind === 'boss' && item.hp === BOSS_HP * bossHpMultiplier(4) && item.time === BOSS_SPAWN))

  const laterBoss = buildSchedule(5).find((item) => item.kind === 'boss' && !item.preview)
  const stage4Boss = real[0]
  assert.equal(laterBoss?.kind, 'boss')
  assert.equal(stage4Boss?.kind, 'boss')
  if (laterBoss?.kind === 'boss' && stage4Boss?.kind === 'boss') assert.ok(laterBoss.hp > stage4Boss.hp)
})

test('ボス体力は面ごとに上がり、匹数では変えない', () => {
  assert.equal(bossHpMultiplier(1), 1)
  assert.ok(Math.abs(bossHpMultiplier(2) - 1.36) < 1e-9)
  assert.ok(Math.abs(bossHpMultiplier(3) - 1.53) < 1e-9)
  assert.ok(Math.abs(bossHpMultiplier(4) - 1.06) < 1e-9)
  assert.ok(Math.abs(bossHpMultiplier(5) - 1.21) < 1e-9)
  assert.ok(Math.abs(bossHpMultiplier(6) - 1.36) < 1e-9)
  const stage4 = buildSchedule(4).filter((item) => item.kind === 'boss' && !item.preview)
  assert.equal(stage4.length, 2)
  const total = stage4.reduce((sum, item) => sum + (item.kind === 'boss' ? item.hp : 0), 0)
  assert.ok(Math.abs(total - BOSS_HP * 2.12) < 1)
})

test('左端の隊列でも匹数の3桁は画面内に収まる', () => {
  const captain = project(-1, 0)
  const fontSize = 84
  const box = troopLabelRect(captain.x, captain.y, 3, fontSize)
  assert.ok(box.x >= FORMATION.labelMargin, String(box.x))
  assert.ok(box.x + box.w <= 390 - FORMATION.labelMargin, `${box.x}+${box.w}`)
  assert.ok(box.w >= fontSize * 3, String(box.w))
  assert.ok(GATE_BODY > 0)
  assert.equal(SHIELD_LOSS, 3)
})
