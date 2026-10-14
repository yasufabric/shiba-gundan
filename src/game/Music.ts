import { MUSIC } from './config'
import type { Sfx } from './Sfx'

const PENTA = [0, 2, 4, 7, 9]
const LEAD = [4, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 0, -1]
const BASS = [0, -1, 7, -1, 9, -1, 4, 0]
const BOSS_LEAD = [0, 3, 4, 3, 7, 4, 3, 0, 4, 7, 9, 7, 4, 3, 0, -1]

export interface MusicMood {
  boss: boolean
  /** 0 はまだ遠い。1 は隊列の直前。 */
  closeness: number
}

function freq(degree: number, octave: number): number {
  const step = ((degree % PENTA.length) + PENTA.length) % PENTA.length
  const wrap = Math.floor(degree / PENTA.length)
  const semi = (PENTA[step] ?? 0) + 12 * (octave + wrap)
  return 16.3516 * 2 ** (semi / 12)
}

export class Music {
  private nextTime = 0
  private step = 0
  private hold = 0
  private noiseBuffer: AudioBuffer | null = null

  constructor(private readonly sfx: Sfx) {}

  sting(kind: 'clear' | 'lose'): void {
    const live = this.sfx.bus()
    if (!live) return
    const start = live.ctx.currentTime + 0.02
    const notes = kind === 'clear' ? [523.25, 659.25, 783.99, 1046.5] : [392, 311.13, 246.94]
    notes.forEach((freq, index) => {
      this.tone(live.ctx, live.out, start + index * 0.11, freq, kind === 'clear' ? 0.16 : 0.22, 0.07)
    })
    this.hold = start + notes.length * 0.11 + 0.18
    this.nextTime = this.hold
  }

  /** フレームから呼ぶ。音の時刻は currentTime に先予約し、setInterval では鳴らさない。 */
  pump(mood: MusicMood): void {
    const live = this.sfx.bus()
    if (!live) return
    const now = live.ctx.currentTime
    if (now < this.hold) return
    const horizon = now + MUSIC.lookahead
    if (this.nextTime < now) this.nextTime = now + 0.04
    let guard = 0
    while (this.nextTime < horizon && guard < 24) {
      this.playStep(live.ctx, live.out, this.nextTime, mood)
      this.nextTime += this.stepSeconds(mood)
      this.step += 1
      guard += 1
    }
  }

  private stepSeconds(mood: MusicMood): number {
    const bpm = mood.boss
      ? MUSIC.bossBpmFar + (MUSIC.bossBpmNear - MUSIC.bossBpmFar) * mood.closeness
      : MUSIC.bpm
    return 60 / bpm / 2
  }

  private playStep(ctx: AudioContext, out: GainNode, time: number, mood: MusicMood): void {
    const index = this.step % 16
    const beat = index % 8
    const close = mood.closeness
    const snareOn = !mood.boss || close >= 0.28
    const leadOn = !mood.boss || close >= 0.45
    const hatOn = !mood.boss || close >= 0.75
    const harmony = mood.boss && close >= 0.82
    if (beat === 0 || beat === 4 || (mood.boss && beat === 6 && close >= 0.5)) {
      this.tone(ctx, out, time, 150, 0.09, MUSIC.drum, 48)
    }
    if (snareOn && (beat === 2 || beat === 6)) this.snare(ctx, out, time)
    if (hatOn && index % 2 === 0) this.hat(ctx, out, time)
    const bassDegree = BASS[index % BASS.length] ?? -1
    if (bassDegree >= 0) this.tone(ctx, out, time, freq(bassDegree, 2), 0.16, MUSIC.bass)
    if (!leadOn) return
    const line = mood.boss ? BOSS_LEAD : LEAD
    const lead = line[index] ?? -1
    if (lead < 0) return
    this.tone(ctx, out, time, freq(lead, 4), 0.12, MUSIC.lead)
    if (harmony) this.tone(ctx, out, time, freq(lead + 2, 5), 0.1, MUSIC.lead * 0.65)
  }

  private tone(ctx: AudioContext, out: GainNode, time: number, freq: number, decay: number, peak: number, glideTo?: number): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = glideTo ? 'sine' : freq < 200 ? 'triangle' : 'square'
    osc.frequency.setValueAtTime(freq, time)
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, time + decay)
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), time + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
    osc.connect(gain)
    gain.connect(out)
    osc.start(time)
    const end = time + decay + 0.02
    osc.stop(end)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }

  private snare(ctx: AudioContext, out: GainNode, time: number): void {
    this.tone(ctx, out, time, 220, 0.08, MUSIC.drum * 0.7, 90)
    this.noise(ctx, out, time, 0.07, MUSIC.drum * 0.8)
  }

  private hat(ctx: AudioContext, out: GainNode, time: number): void {
    this.noise(ctx, out, time, 0.03, MUSIC.hat)
  }

  private noise(ctx: AudioContext, out: GainNode, time: number, decay: number, peak: number): void {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 0.2)
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buffer
    }
    const src = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    src.buffer = this.noiseBuffer
    filter.type = 'highpass'
    filter.frequency.value = 1800
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), time + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    src.start(time)
    src.stop(time + decay + 0.02)
    src.onended = () => {
      src.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
  }
}
