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

/** 保存がちょうど '1' のときだけ消音。未設定や別の値では鳴らす。 */
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function armPlaybackSession(): void {
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (!nav.audioSession) return
  nav.audioSession.type = 'playback'
}

/** 無音の短い WAV。着信音オフでも Web Audio を鳴らすための <audio> 用。 */
function silentWavUrl(): string {
  const sampleRate = 8000
  const samples = 800
  const dataBytes = samples * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, dataBytes, true)
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:audio/wav;base64,${btoa(binary)}`
}

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private shotAt = 0
  private hitAt = 0
  private catAt = 0
  private tickAt = 0
  private unlocked = false
  private silence: HTMLAudioElement | null = null
  muted: boolean

  constructor(muted = false) {
    this.muted = muted
  }

  /**
   * 指を離した処理の中で同期的に呼ぶ。
   * iOS は touchstart では解錠しないことがあり、running 以外なら次のタップでもう一度再開する。
   */
  unlock(): void {
    this.unlocked = true
    armPlaybackSession()
    this.armSilence()
    const ctx = this.ensure()
    if (ctx.state !== 'running') {
      void ctx.resume()
      this.kick(ctx)
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume(): void {
    if (!this.unlocked || !this.ctx) return
    armPlaybackSession()
    if (this.ctx.state !== 'running') void this.ctx.resume()
    if (this.silence && this.silence.paused) void this.silence.play().catch(() => undefined)
  }

  /** 曲が音を予約できるときだけ返す。ミュート中と、まだタップしていないときは null。 */
  bus(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.unlocked || this.muted || !this.ctx || !this.master) return null
    if (this.ctx.state !== 'running') return null
    return { ctx: this.ctx, out: this.master }
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
      armPlaybackSession()
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.85
      master.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
    }
    return this.ctx
  }

  /** 無音バッファをジェスチャーの中で start し、Web Audio 自体を起こす。 */
  private kick(ctx: AudioContext): void {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buffer
    gain.gain.value = 0
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(0)
  }

  /** 着信音スイッチが消音でも、再生中の <audio> があると Web Audio が鳴る。 */
  private armSilence(): void {
    if (!this.silence) {
      const audio = document.createElement('audio')
      audio.loop = true
      audio.preload = 'auto'
      audio.setAttribute('playsinline', '')
      audio.setAttribute('webkit-playsinline', '')
      audio.src = silentWavUrl()
      document.body.append(audio)
      this.silence = audio
    }
    if (!this.silence.paused) return
    void this.silence.play().catch(() => undefined)
  }

  private live(): { ctx: AudioContext; out: GainNode } | null {
    if (this.muted) return null
    const ctx = this.ensure()
    if (!this.master || ctx.state !== 'running') return null
    return { ctx, out: this.master }
  }

  shoot(): void {
    const now = this.ctx?.currentTime ?? 0
    if (now - this.shotAt < 0.07) return
    const live = this.live()
    if (!live) return
    this.shotAt = live.ctx.currentTime
    tone(live.ctx, live.out, live.ctx.currentTime, {
      type: 'square',
      freq: 620,
      to: 340,
      glide: 0.05,
      peak: 0.04,
      decay: 0.05,
    })
  }

  gateTick(): void {
    const live = this.live()
    if (!live) return
    if (live.ctx.currentTime - this.tickAt < 0.06) return
    this.tickAt = live.ctx.currentTime
    tone(live.ctx, live.out, live.ctx.currentTime, {
      type: 'square',
      freq: 880,
      to: 1320,
      glide: 0.04,
      peak: 0.045,
      decay: 0.05,
    })
  }

  rocket(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    noise(live.ctx, live.out, t, { filter: 'bandpass', freq: 420, to: 140, q: 0.8, peak: 0.16, decay: 0.22 })
    tone(live.ctx, live.out, t, { type: 'sawtooth', freq: 180, to: 70, glide: 0.18, peak: 0.06, decay: 0.2 })
  }

  drum(): void {
    const live = this.live()
    if (!live) return
    const t = live.ctx.currentTime
    noise(live.ctx, live.out, t, { filter: 'bandpass', freq: 240, to: 90, q: 1.2, peak: 0.16, decay: 0.16 })
    tone(live.ctx, live.out, t, { type: 'triangle', freq: 160, to: 60, glide: 0.1, peak: 0.08, decay: 0.12 })
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
