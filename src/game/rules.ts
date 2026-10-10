import {
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
