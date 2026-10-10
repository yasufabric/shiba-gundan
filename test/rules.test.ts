import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOSS_HP,
  BOSS_SPAWN,
  CRATE_TIMES,
  GATE_INTERVAL,
  GATE_PAIRS,
  HORDES,
  HORDE_LANE,
  HORDE_MAX,
  HORDE_ROWS,
  START_DOGS,
  STAMP_INTERVALS,
  STAMP_MIN,
  STAMP_WARN,
  WEAPON_CAP_DOGS,
} from '../src/game/config'
import { bossMaxHp, buildSchedule, catHpMul } from '../src/game/level'
import { applyGate, gateLabel, isRedGate, stampLoss } from '../src/game/rules'

test('豆柴は5匹から始まり、門は左右とも得で中身だけちがう', () => {
  assert.equal(START_DOGS, 5)
  assert.ok(GATE_PAIRS.length >= 4)
  let doubles = 0
  for (const pair of GATE_PAIRS) {
    assert.equal(isRedGate(pair.left), false)
    assert.equal(isRedGate(pair.right), false)
    const same = pair.left.kind === pair.right.kind && pair.left.amount === pair.right.amount
    assert.equal(same, false)
    for (const op of [pair.left, pair.right]) {
      if (op.kind === 'add') assert.ok(op.amount >= 8 && op.amount <= 15)
      if (op.kind === 'mul') {
        assert.equal(op.amount, 2)
        doubles += 1
      }
      if (op.kind === 'weapon') assert.equal(op.amount, 1)
    }
  }
  assert.equal(doubles, 1)
  const doubled = GATE_PAIRS.find((pair) => pair.left.kind === 'mul' || pair.right.kind === 'mul')
  assert.ok(doubled && doubled.time >= 25)
  const army = { dogs: START_DOGS, weapon: 0 as const }
  assert.equal(applyGate(army, { kind: 'add', amount: 10 }).army.dogs, 15)
  assert.equal(applyGate(army, { kind: 'weapon', amount: 1 }).army.weapon, 1)
  assert.equal(gateLabel({ kind: 'mul', amount: 2 }), '×2')
})

test('武器の門は約10秒に1回で、最大のあとには出さない', () => {
  const weaponTimes: number[] = []
  for (let i = 1; i < GATE_PAIRS.length; i += 1) {
    const prev = GATE_PAIRS[i - 1]
    const next = GATE_PAIRS[i]
    assert.ok(prev && next)
    assert.equal(next.time - prev.time, GATE_INTERVAL)
  }
  for (const pair of GATE_PAIRS) {
    const weapons = [pair.left, pair.right].filter((op) => op.kind === 'weapon')
    assert.ok(weapons.length <= 1)
    if (weapons.length === 1) weaponTimes.push(pair.time)
  }
  assert.deepEqual(weaponTimes, [15, 25])
  const first = GATE_PAIRS.find((pair) => pair.time === 15)
  const second = GATE_PAIRS.find((pair) => pair.time === 25)
  assert.equal(first?.left.kind, 'weapon')
  assert.equal(second?.right.kind, 'weapon')
})

test('武器が最大のとき武器↑は豆柴を1匹足す', () => {
  const op = { kind: 'weapon' as const, amount: 1 }
  assert.equal(WEAPON_CAP_DOGS, 1)
  assert.equal(gateLabel(op, 2), '+1')
  assert.deepEqual(applyGate({ dogs: 8, weapon: 2 }, op).army, { dogs: 9, weapon: 2 })
  assert.equal(applyGate({ dogs: 4, weapon: 0 }, { kind: 'weapon', amount: -1 }).army.weapon, 0)
  assert.equal(applyGate({ dogs: 4, weapon: 2 }, { kind: 'weapon', amount: -1 }).army.weapon, 1)
})

test('木箱は武器の門が2回通ったあとに壊れ、ボスは45秒', () => {
  assert.equal(CRATE_TIMES.length, 2)
  assert.ok(CRATE_TIMES[0] >= 30 && CRATE_TIMES[0] <= 36)
  assert.ok(CRATE_TIMES[1] > CRATE_TIMES[0] && CRATE_TIMES[1] < BOSS_SPAWN)
  assert.equal(BOSS_SPAWN, 45)
  assert.ok(BOSS_HP > 0)
})

test('猫は道の端から端まで、10〜20匹の1列', () => {
  assert.equal(HORDE_ROWS, 1)
  assert.equal(HORDE_LANE, 1)
  assert.ok(HORDES.length >= 4)
  let total = 0
  for (const horde of HORDES) {
    assert.ok(horde.count >= 10 && horde.count <= HORDE_MAX)
    assert.ok(horde.hp > 0)
    total += horde.count
  }
  assert.ok(total > 23)
  const cats = buildSchedule(1).filter((item) => item.kind === 'cat')
  assert.equal(cats.length, total)
  const lanes = cats.filter((cat) => cat.kind === 'cat').map((cat) => cat.lane)
  assert.ok(Math.min(...lanes) <= -0.95)
  assert.ok(Math.max(...lanes) >= 0.95)
})

test('肉球は4分の1を切り上げた数と5匹の多いほう', () => {
  assert.equal(STAMP_WARN, 0.8)
  assert.equal(STAMP_MIN, 5)
  assert.equal(stampLoss(0), 0)
  assert.equal(stampLoss(3), 5)
  assert.equal(stampLoss(16), 5)
  assert.equal(stampLoss(21), 6)
  assert.equal(stampLoss(24), 6)
  assert.equal(stampLoss(40), 10)
  assert.ok(STAMP_INTERVALS.length >= 2)
  for (const interval of STAMP_INTERVALS) assert.ok(interval >= 2 && interval <= 3)
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
