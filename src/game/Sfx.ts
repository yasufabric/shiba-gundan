import { MUTE_KEY } from './config'

type Wave = OscillatorType

interface ToneOpts {
  type: Wave
  freq: number
  to?: number
  glide?: number
  peak: number
  attack?: number
  decay: number
  delay?: number
}

interface NoiseOpts {
  filter: BiquadFilterType
  freq: number
  to?: number
  q?: number
  peak: number
  attack?: number
  decay: number
  delay?: number
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx)
  if (!buffer) {
    const length = Math.floor(ctx.sampleRate * 0.4)
    buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buffer)
  }
  return buffer
}

function envelope(gain: GainNode, t: number, peak: number, attack: number, decay: number): number {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return t + attack + decay + 0.02
}

function cleanup(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  source.onended = () => {
    for (const node of nodes) node.disconnect()
  }
}

function tone(ctx: BaseAudioContext, out: AudioNode, t0: number, o: ToneOpts): void {
  const t = t0 + (o.delay ?? 0)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = o.type
  osc.frequency.setValueAtTime(Math.max(o.freq, 1), t)
  if (o.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), t + (o.glide ?? o.decay))
  }
  const end = envelope(gain, t, o.peak, o.attack ?? 0.004, o.decay)
  osc.connect(gain)
  gain.connect(out)
  osc.start(t)
  osc.stop(end)
  cleanup(osc, [osc, gain])
}

function noise(ctx: BaseAudioContext, out: AudioNode, t0: number, o: NoiseOpts): void {
  const t = t0 + (o.delay ?? 0)
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  src.buffer = noiseBuffer(ctx)
  filter.type = o.filter
  filter.Q.value = o.q ?? 0.7
  filter.frequency.setValueAtTime(Math.max(o.freq, 1), t)
  if (o.to !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), t + (o.attack ?? 0.004) + o.decay)
  }
  const end = envelope(gain, t, o.peak, o.attack ?? 0.004, o.decay)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  src.start(t, Math.random() * 0.08)
  src.stop(end)
  cleanup(src, [src, filter, gain])
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private shotAt = 0
  private hitAt = 0
  private catAt = 0
  muted: boolean

  constructor(muted = false) {
    this.muted = muted
  }

  unlock(): void {
    const ctx = this.ensure()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.85
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    } catch {
      // プライベートモードでもボタンは切り替わる。
    }
    return this.muted
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.85
      master.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
    }
    return this.ctx
  }

  private live(): { ctx: AudioContext; out: GainNode } | null {
    if (this.muted) return null
    const ctx = this.ensure()
    if (!this.master || ctx.state !== 'running') return null
    return { ctx, out: this.master }
  }

  shoot(weapon: number): void {
    const now = this.ctx?.currentTime ?? 0
    if (now - this.shotAt < 0.07) return
    const live = this.live()
    if (!live) return
    this.shotAt = live.ctx.currentTime
    const freq = weapon >= 2 ? 680 : weapon === 1 ? 760 : 540
    tone(live.ctx, live.out, live.ctx.currentTime, {
      type: 'square',
      freq,
      to: freq * 0.55,
      glide: 0.05,
      peak: 0.045,
      decay: 0.05,
    })
  }

  hit(): void {
    const live = this.live()
    if (!live) return
    if (live.ctx.currentTime - this.hitAt < 0.045) return
    this.hitAt = live.ctx.currentTime
    noise(live.ctx, live.out, live.ctx.currentTime, {
      filter: 'highpass',
      freq: 1400,
      to: 500,
      q: 0.6,
      peak: 0.05,
      decay: 0.04,
    })
  }

  catDown(brute: boolean): void {
    const live = this.live()
    if (!live) return
    if (!brute && live.ctx.currentTime - this.catAt < 0.07) return
    this.catAt = live.ctx.currentTime
    const t = live.ctx.currentTime
    tone(live.ctx, live.out, t, { type: 'triangle', freq: brute ? 220 : 310, to: 90, glide: 0.12, peak: brute ? 0.12 : 0.07, decay: 0.1 })
    noise(live.ctx, live.out, t, { filter: 'bandpass', freq: 900, to: 240, q: 0.8, peak: brute ? 0.1 : 0.06, decay: 0.08 })
  }

  stamp(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    noise(live.ctx, live.out, t, { filter: 'lowpass', freq: 220, to: 40, q: 0.8, peak: 0.42, decay: 0.32 })
    tone(live.ctx, live.out, t, { type: 'sine', freq: 92, to: 28, glide: 0.22, peak: 0.32, decay: 0.28 })
    tone(live.ctx, live.out, t, { type: 'triangle', freq: 70, to: 36, glide: 0.16, peak: 0.12, decay: 0.2, delay: 0.02 })
  }

  gateGood(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    tone(live.ctx, live.out, t, { type: 'square', freq: 523, peak: 0.06, decay: 0.08 })
    tone(live.ctx, live.out, t, { type: 'square', freq: 659, peak: 0.055, decay: 0.1, delay: 0.06 })
    tone(live.ctx, live.out, t, { type: 'triangle', freq: 784, peak: 0.06, decay: 0.14, delay: 0.12 })
  }

  gateBad(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    tone(live.ctx, live.out, t, { type: 'sawtooth', freq: 240, to: 80, glide: 0.16, peak: 0.05, decay: 0.16 })
    tone(live.ctx, live.out, t, { type: 'square', freq: 180, to: 70, glide: 0.14, peak: 0.04, decay: 0.14, delay: 0.02 })
  }

  weaponUp(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    tone(live.ctx, live.out, t, { type: 'square', freq: 392, peak: 0.07, decay: 0.08 })
    tone(live.ctx, live.out, t, { type: 'square', freq: 523, peak: 0.07, decay: 0.1, delay: 0.07 })
    tone(live.ctx, live.out, t, { type: 'triangle', freq: 784, peak: 0.08, decay: 0.18, delay: 0.14 })
    noise(live.ctx, live.out, t, { filter: 'highpass', freq: 1800, peak: 0.06, decay: 0.08 })
  }

  bossDown(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    noise(live.ctx, live.out, t, { filter: 'lowpass', freq: 240, to: 60, q: 0.6, peak: 0.28, decay: 0.35 })
    tone(live.ctx, live.out, t, { type: 'sine', freq: 130, to: 48, glide: 0.28, peak: 0.22, decay: 0.3 })
    tone(live.ctx, live.out, t, { type: 'square', freq: 523, peak: 0.06, decay: 0.12, delay: 0.12 })
    tone(live.ctx, live.out, t, { type: 'square', freq: 659, peak: 0.06, decay: 0.14, delay: 0.2 })
    tone(live.ctx, live.out, t, { type: 'triangle', freq: 1046, peak: 0.07, decay: 0.28, delay: 0.28 })
  }
}
