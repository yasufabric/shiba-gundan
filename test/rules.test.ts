import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOSS_HP,
  BOSS_SPAWN,
  CRATE_TIMES,
  GATE_INTERVAL,
  GATE_PAIRS,
  RED_GATE_AFTER,
  START_DOGS,
} from '../src/game/config'
import { bossMaxHp, buildSchedule, catHpMul } from '../src/game/level'
import { applyGate, gateLabel, isRedGate } from '../src/game/rules'

test('豆柴は5匹から始まり、1組目の門はどちらも10匹になる', () => {
  assert.equal(START_DOGS, 5)
  const first = GATE_PAIRS[0]
  assert.ok(first)
  const army = { dogs: START_DOGS, weapon: 0 as const }
  assert.equal(isRedGate(first.left), false)
  assert.equal(isRedGate(first.right), false)
  assert.equal(applyGate(army, first.left).army.dogs, 10)
  assert.equal(applyGate(army, first.right).army.dogs, 10)
  assert.equal(gateLabel(first.left), '+5')
  assert.equal(gateLabel(first.right), '×2')
})

test('2組目からは結果が分かれる', () => {
  const second = GATE_PAIRS[1]
  assert.ok(second)
  const army = { dogs: 10, weapon: 0 as const }
  const left = applyGate(army, second.left).army.dogs
  const right = applyGate(army, second.right).army.dogs
  assert.notEqual(left, right)
  assert.ok(Math.abs(left - right) >= 5)
})

test('門は約5秒ごと、赤い門は15秒を過ぎてから', () => {
  for (let i = 1; i < GATE_PAIRS.length; i += 1) {
    const prev = GATE_PAIRS[i - 1]
    const next = GATE_PAIRS[i]
    assert.ok(prev && next)
    assert.equal(next.time - prev.time, GATE_INTERVAL)
  }
  for (const pair of GATE_PAIRS) {
    for (const op of [pair.left, pair.right]) {
      if (isRedGate(op)) assert.ok(pair.time > RED_GATE_AFTER)
    }
  }
  assert.ok(GATE_PAIRS.some((pair) => pair.time > RED_GATE_AFTER && (isRedGate(pair.left) || isRedGate(pair.right))))
})

test('木箱は20秒以内と40秒以内に1つずつ、ボスは45秒', () => {
  assert.equal(CRATE_TIMES.length, 2)
  assert.ok(CRATE_TIMES[0] > 0 && CRATE_TIMES[0] <= 20)
  assert.ok(CRATE_TIMES[1] > CRATE_TIMES[0] && CRATE_TIMES[1] <= 40)
  assert.equal(BOSS_SPAWN, 45)
  assert.ok(BOSS_HP > 0)
  assert.ok(CRATE_TIMES[1] < BOSS_SPAWN)
})

test('武器↓は1段下がり、0未満にはならない。減算は0で止まる', () => {
  assert.deepEqual(applyGate({ dogs: 4, weapon: 2 }, { kind: 'weapon', amount: -1 }).army, {
    dogs: 4,
    weapon: 1,
  })
  assert.equal(applyGate({ dogs: 4, weapon: 0 }, { kind: 'weapon', amount: -1 }).army.weapon, 0)
  assert.equal(applyGate({ dogs: 3, weapon: 0 }, { kind: 'add', amount: -5 }).army.dogs, 0)
  assert.equal(applyGate({ dogs: 3, weapon: 1 }, { kind: 'add', amount: -5 }).good, false)
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
