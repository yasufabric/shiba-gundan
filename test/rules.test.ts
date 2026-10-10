import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOSS_HP,
  BOSS_SPAWN,
  FORMATION,
  GATE_PAIRS,
  HORDES,
  HORDE_LANE,
  HORDE_MAX,
  HORDE_ROWS,
  START_DOGS,
} from '../src/game/config'
import { beanOffsets } from '../src/game/layout'
import { bossMaxHp, buildSchedule, catHpMul } from '../src/game/level'
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

test('最初の2組は増える青だけで、赤と÷は15秒後', () => {
  assert.ok(GATE_PAIRS.length >= 4)
  const opening = GATE_PAIRS.slice(0, 2)
  for (const pair of opening) {
    assert.ok(pair.time <= 15)
    for (const op of [pair.left, pair.right]) {
      assert.equal(isRedGate(op), false)
      assert.ok(applyGate(START_DOGS, op).dogs > START_DOGS)
    }
  }
  const later = GATE_PAIRS.filter((pair) => isRedGate(pair.left) || isRedGate(pair.right))
  assert.ok(later.length >= 1)
  for (const pair of later) assert.ok(pair.time > 15)
  const divided = GATE_PAIRS.find((pair) => pair.left.kind === 'mul' && pair.left.amount <= -2 || pair.right.kind === 'mul' && pair.right.amount <= -2)
  assert.ok(divided)
  assert.ok((divided?.time ?? 0) > 15)
})

test('猫の群れは想定匹数の固定値で、ボスは最後', () => {
  assert.equal(HORDE_ROWS, 1)
  assert.equal(HORDE_LANE, 1)
  assert.ok(HORDES.length >= 4)
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
  const multiplied = GATE_PAIRS.find((pair) => pair.left.kind === 'mul' && pair.left.amount >= 2 || pair.right.kind === 'mul' && pair.right.amount >= 2)
  assert.ok(multiplied?.drum)
})

test('2ステージ目は猫とボスの数字だけ上がる', () => {
  assert.equal(catHpMul(1), 1)
  assert.ok(catHpMul(2) > 1)
  assert.ok(bossMaxHp(2) > bossMaxHp(1))
  const first = buildSchedule(1).filter((item) => item.kind === 'cat')
  const second = buildSchedule(2).filter((item) => item.kind === 'cat')
  assert.ok(second.length > first.length)
  const boss1 = buildSchedule(1).find((item) => item.kind === 'boss')
  const boss2 = buildSchedule(2).find((item) => item.kind === 'boss')
  assert.equal(boss1?.kind, 'boss')
  assert.equal(boss2?.kind, 'boss')
  if (boss1?.kind === 'boss' && boss2?.kind === 'boss') assert.ok(boss2.hp > boss1.hp)
})
