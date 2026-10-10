import {
  BOSS_DOG_EXP,
  BOSS_WEAPON_POWER,
  DOG_POWER_EXP,
  FORMATION,
  type GateDef,
} from './config'
import type { Army, GateTone, WeaponLevel } from './types'

export function clampWeapon(level: number): WeaponLevel {
  if (level <= 0) return 0
  if (level >= 2) return 2
  return 1
}

export function dogPower(dogs: number): number {
  return Math.pow(Math.max(1, dogs), DOG_POWER_EXP)
}

/**
 * 10匹以上は弱い累乗。10匹未満は、肉球で削れた残りがボスを溶かしきらないように落とす。
 */
function bossDogFactor(dogs: number): number {
  const counted = Math.max(1, dogs)
  const atTen = Math.pow(10, BOSS_DOG_EXP)
  if (counted >= 10) return Math.pow(counted, BOSS_DOG_EXP)
  return atTen * Math.pow(counted / 10, 2)
}

/** ボスに当たった1発。合計は武器の係数 × 匹数の上乗せで、弾数では割る。 */
export function bossBulletDamage(dogs: number, weapon: WeaponLevel, streams: number): number {
  const power = BOSS_WEAPON_POWER[weapon] * bossDogFactor(dogs)
  return power / Math.max(1, streams)
}

/**
 * 次の肉球は左右どちらか。直前の2回と同じ側には落とさない。
 * roll は 0 以上 1 未満。
 */
export function rollStampSide(recent: readonly (-1 | 1)[], roll: number): -1 | 1 {
  const want: -1 | 1 = roll < 0.5 ? -1 : 1
  const prev = recent[recent.length - 1]
  const before = recent[recent.length - 2]
  if (before !== undefined && before === prev && want === prev) return prev === -1 ? 1 : -1
  return want
}

export function formationHalf(dogs: number): number {
  const grown = FORMATION.halfBase + Math.max(0, dogs) * FORMATION.halfPerDog
  return Math.min(FORMATION.halfMax, grown)
}

export function gateLabel(op: GateDef): string {
  switch (op.kind) {
    case 'add':
      return op.amount < 0 ? `−${Math.abs(op.amount)}` : `+${op.amount}`
    case 'mul':
      return `×${op.amount}`
    case 'weapon':
      return '武器↓'
    default: {
      const unknown: never = op.kind
      return unknown
    }
  }
}

export function gateTone(op: GateDef): GateTone {
  switch (op.kind) {
    case 'add':
      return op.amount < 0 ? 'red' : 'blue'
    case 'mul':
      return 'blue'
    case 'weapon':
      return 'red'
    default: {
      const unknown: never = op.kind
      return unknown
    }
  }
}

export function isRedGate(op: GateDef): boolean {
  return gateTone(op) === 'red'
}

export function applyGate(army: Army, op: GateDef): { army: Army; good: boolean } {
  switch (op.kind) {
    case 'add': {
      const dogs = Math.max(0, army.dogs + op.amount)
      return { army: { dogs, weapon: army.weapon }, good: op.amount >= 0 }
    }
    case 'mul': {
      const dogs = Math.max(0, Math.round(army.dogs * op.amount))
      return { army: { dogs, weapon: army.weapon }, good: true }
    }
    case 'weapon': {
      const weapon = clampWeapon(army.weapon + op.amount)
      return { army: { dogs: army.dogs, weapon }, good: op.amount >= 0 }
    }
    default: {
      const unknown: never = op.kind
      return unknown
    }
  }
}

export function laneOfSide(side: -1 | 1): number {
  return side < 0 ? -0.78 : 0.78
}
