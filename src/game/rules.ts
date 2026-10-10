import { BOSS_DOG_EXP, BOSS_POWER, CAT_DOG_EXP, CAT_HIT, FORMATION, type GateDef } from './config'
import type { GateTone } from './types'

/** 猫への1斉射の合計威力。 */
export function volleyCatDamage(dogs: number): number {
  return CAT_HIT * Math.pow(Math.max(1, dogs), CAT_DOG_EXP)
}

/** ボスへの1斉射の合計威力。弾の本数では割る。 */
export function bossBulletDamage(dogs: number, streams: number): number {
  const total = BOSS_POWER * Math.pow(Math.max(1, dogs), BOSS_DOG_EXP)
  return total / Math.max(1, streams)
}

export function formationHalf(dogs: number): number {
  const grown = FORMATION.halfBase + Math.max(0, dogs) * FORMATION.halfPerDog
  return Math.min(FORMATION.halfMax, grown)
}

/** 80匹を超えると頭上の数字を大きくする。 */
export function countFontSize(dogs: number): number {
  const extra = Math.max(0, dogs - FORMATION.drawMax)
  return Math.min(FORMATION.countMax, FORMATION.countBase + extra * FORMATION.countPer)
}

export function gateLabel(op: GateDef): string {
  switch (op.kind) {
    case 'add':
      return op.amount < 0 ? `−${Math.abs(op.amount)}` : `+${op.amount}`
    case 'mul':
      if (op.amount <= -2) return `÷${Math.abs(op.amount)}`
      if (op.amount >= 2) return `×${op.amount}`
      return '×1'
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
      return op.amount <= -2 ? 'red' : 'blue'
    default: {
      const unknown: never = op.kind
      return unknown
    }
  }
}

export function isRedGate(op: GateDef): boolean {
  return gateTone(op) === 'red'
}

/** 弾1発で、門の数を1増やす。 */
export function bumpGate(op: GateDef): GateDef {
  return { kind: op.kind, amount: op.amount + 1 }
}

export function applyGate(dogs: number, op: GateDef): { dogs: number; good: boolean } {
  switch (op.kind) {
    case 'add': {
      const next = Math.max(0, dogs + op.amount)
      return { dogs: next, good: op.amount >= 0 }
    }
    case 'mul': {
      if (op.amount >= 2) return { dogs: Math.max(0, Math.round(dogs * op.amount)), good: true }
      if (op.amount <= -2) return { dogs: Math.max(0, Math.floor(dogs / Math.abs(op.amount))), good: false }
      return { dogs, good: true }
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
