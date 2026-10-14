import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MUTE_KEY } from '../src/game/config'
import { loadMuted } from '../src/game/Sfx'

test('消音は保存が1のときだけで、初期値は鳴る', () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
    },
  })
  assert.equal(loadMuted(), false)
  values.set(MUTE_KEY, '0')
  assert.equal(loadMuted(), false)
  values.set(MUTE_KEY, 'true')
  assert.equal(loadMuted(), false)
  values.set(MUTE_KEY, '1')
  assert.equal(loadMuted(), true)
})
