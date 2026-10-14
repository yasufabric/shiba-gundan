import { BOSS_REACH, CLEAR_HOLD, SPAWN_DIST, STAGE_KEY, VIEW_H, VIEW_W } from './config'
import type { Floater, Flyer, Particle, RenderState } from './draw'
import { render, worldPoint } from './draw'
import { Music } from './Music'
import { Sfx, loadMuted } from './Sfx'
import { createSim, step } from './sim'
import { loadSprites } from './sprites'
import type { SimEvent } from './types'

export interface Stage {
  canvas: HTMLCanvasElement
  frame: HTMLElement
  mute: HTMLButtonElement
  rocket: HTMLButtonElement
  live: HTMLElement
}

const STEP = 1 / 60

export class Game {
  private readonly canvas: HTMLCanvasElement
  private readonly frame: HTMLElement
  private readonly mute: HTMLButtonElement
  private readonly rocket: HTMLButtonElement
  private readonly live: HTMLElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly sprites = loadSprites()
  private readonly sfx: Sfx
  private readonly music: Music
  private sim = createSim(1)
  private title = true
  private bestStage = 1
  private particles: Particle[] = []
  private flyers: Flyer[] = []
  private floaters: Floater[] = []
  private shake = 0
  private flash = 0
  private flashColor = '#fff'
  private burst = 0
  private numPop = 0
  private recoil = 0
  private resultAge = 0
  private phaseSeen = 'play'
  private last = 0
  private acc = 0
  private clock = 0
  private slow = 1
  private pointing = false
  private pendingRocket = false
  private flipHold = 0
  private flipLabel = ''
  private rocketHold = 0
  private clashHold = 0
  private targetLane = 0
  private prevLane = 0
  private laneVel = 0
  private liveText = ''

  constructor(stage: Stage) {
    const ctx = stage.canvas.getContext('2d')
    if (!ctx) throw new Error('2d context missing')
    this.canvas = stage.canvas
    this.frame = stage.frame
    this.mute = stage.mute
    this.rocket = stage.rocket
    this.live = stage.live
    this.ctx = ctx
    this.sfx = new Sfx(loadMuted())
    this.music = new Music(this.sfx)
    this.bestStage = loadBestStage()
    this.paintMute()
  }

  /** touchend / pointerup から同期的に呼ぶ。ピンチ防止の preventDefault より前。 */
  unlockAudio(): void {
    this.sfx.unlock()
  }

  start(): void {
    this.fit()
    window.addEventListener('resize', () => this.fit())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.sfx.suspend()
      else this.sfx.resume()
    })
    window.addEventListener('pageshow', () => this.sfx.resume())
    this.canvas.addEventListener('pointerdown', (event) => this.onDown(event))
    this.canvas.addEventListener('pointermove', (event) => this.onMove(event))
    this.canvas.addEventListener('pointerup', () => {
      this.pointing = false
      this.sfx.unlock()
    })
    this.canvas.addEventListener('pointercancel', () => {
      this.pointing = false
    })
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    this.mute.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.sfx.unlock()
      this.sfx.toggle()
      this.paintMute()
    })
    this.rocket.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.sfx.unlock()
      if (this.rocket.hidden || this.rocket.disabled) return
      this.pendingRocket = true
    })
    void document.fonts.load('42px "Dela Gothic One"')
    requestAnimationFrame((now) => this.frameOf(now))
  }

  private paintMute(): void {
    const muted = this.sfx.muted
    this.mute.setAttribute('aria-pressed', muted ? 'true' : 'false')
    this.mute.setAttribute('aria-label', muted ? '音を出す' : '音を消す')
    this.mute.textContent = muted ? '消' : 'おと'
  }

  private fit(): void {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)
    const cssW = Math.max(1, Math.floor(VIEW_W * scale))
    const cssH = Math.max(1, Math.floor(VIEW_H * scale))
    this.frame.style.width = `${cssW}px`
    this.frame.style.height = `${cssH}px`
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.floor(VIEW_W * dpr)
    this.canvas.height = Math.floor(VIEW_H * dpr)
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'low'
  }

  private laneFromEvent(event: PointerEvent): number {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W
    return Math.max(-1, Math.min(1, (x / VIEW_W - 0.5) * 2.05))
  }

  private onDown(event: PointerEvent): void {
    if (event.button !== 0) return
    event.preventDefault()
    this.sfx.unlock()
    if (this.title) {
      this.title = false
      this.rememberStage(1)
      this.pointing = true
      this.targetLane = this.laneFromEvent(event)
      return
    }
    const lock = this.sim.phase === 'clear' ? 0.45 : 0.05
    if (this.sim.phase !== 'play' && this.resultAge >= lock) {
      const next = this.sim.phase === 'clear' ? this.sim.stage + 1 : this.sim.stage
      this.beginStage(next)
      this.pointing = true
      this.targetLane = this.laneFromEvent(event)
      return
    }
    this.pointing = true
    this.targetLane = this.laneFromEvent(event)
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onMove(event: PointerEvent): void {
    if (!this.pointing || this.sim.phase !== 'play') return
    this.targetLane = this.laneFromEvent(event)
  }

  private frameOf(now: number): void {
    const dt = this.last === 0 ? 0 : Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.clock += dt
    if (!this.title) this.acc += dt * this.slow
    while (this.acc >= STEP) {
      this.tick(STEP)
      this.acc -= STEP
    }
    this.decay(dt)
    this.laneVel = dt > 0 ? (this.sim.lane - this.prevLane) / dt : 0
    this.prevLane = this.sim.lane
    const state: RenderState = {
      sim: this.sim,
      sprites: this.sprites,
      particles: this.particles,
      flyers: this.flyers,
      floaters: this.floaters,
      shake: this.shake,
      flash: this.flash,
      flashColor: this.flashColor,
      burst: this.burst,
      numPop: this.numPop,
      time: this.clock,
      resultAge: this.resultAge,
      recoil: this.recoil,
      laneVel: this.laneVel,
      title: this.title,
      bestStage: this.bestStage,
    }
    render(this.ctx, state)
    this.music.pump(this.mood())
    this.publish()
    requestAnimationFrame((next) => this.frameOf(next))
  }

  private tick(dt: number): void {
    if (this.title) return
    const before = this.sim.dogs
    const rocket = this.pendingRocket
    this.pendingRocket = false
    const events = step(this.sim, dt, this.pointing ? this.targetLane : null, rocket)
    if (this.sim.dogs > before) this.burst = 1
    if (this.sim.dogs < before) this.launch(before - this.sim.dogs)
    if (this.sim.dogs !== before) this.numPop = 1
    for (const event of events) this.present(event)
    if (this.sim.phase !== this.phaseSeen) {
      if (this.sim.phase === 'clear') this.music.sting('clear')
      if (this.sim.phase === 'lose') this.music.sting('lose')
      this.phaseSeen = this.sim.phase
      this.resultAge = 0
    }
  }

  private present(event: SimEvent): void {
    switch (event.type) {
      case 'shoot':
        this.recoil = 1
        this.sfx.shoot()
        return
      case 'hit':
        if (event.heavy) {
          this.shake = 18
          this.flash = 0.72
          this.flashColor = 'rgba(255, 160, 32, 0.95)'
          this.sfx.rocket()
          this.burstAt(event.lane, event.dist, ['#fff6df', '#ffd15a', '#ff5a1f', '#ff4ad8'], 42)
          const at = worldPoint(event.lane, event.dist)
          this.particles.push({
            x: at.x,
            y: at.y,
            vx: 0,
            vy: 0,
            life: 0.45,
            max: 0.45,
            size: 28,
            color: '#fff6df',
            kind: 'ring',
            rot: 0,
          })
          return
        }
        if (event.target !== 'gate') this.sfx.hit()
        if (event.target === 'boss') this.shake = Math.max(this.shake, 2.2)
        if (event.target !== 'gate') this.puff(event.lane, event.dist, event.target === 'boss' ? '#ffd15a' : '#fff6df', 3)
        return
      case 'cat-down':
        this.shake = Math.max(this.shake, event.brute ? 6 : 1.2)
        this.sfx.catDown(event.brute)
        this.burstAt(event.lane, event.dist, ['#ffd15a', '#ff8a3a', '#fff6df', '#ff4ad8'], event.brute ? 12 : 6)
        return
      case 'gate-bump':
        this.sfx.gateTick()
        if (event.flipped) {
          this.flipLabel = event.label
          this.flipHold = 0.55
          this.shake = Math.max(this.shake, 6)
          this.flashColor = event.tone === 'blue' ? 'rgba(140, 210, 255, 0.95)' : 'rgba(255, 80, 110, 0.95)'
          this.flash = 0.34
          this.burstAt(event.lane, event.dist, event.tone === 'blue' ? ['#8fd4ff', '#fff'] : ['#ff4d6a', '#ffd0dc'], 14)
        }
        return
      case 'gate': {
        const at = worldPoint(event.lane, 18)
        this.floaters.push({
          x: at.x,
          y: at.y - 40,
          text: event.label,
          life: 0.7,
          max: 0.7,
          color: event.good ? '#8fd4ff' : '#ff6d8a',
        })
        this.flashColor = event.good ? 'rgba(120, 200, 255, 0.9)' : 'rgba(255, 70, 100, 0.9)'
        this.flash = event.good ? 0.22 : 0.28
        this.shake = Math.max(this.shake, 3)
        if (event.good) this.sfx.gateGood()
        else this.sfx.gateBad()
        this.burstAt(event.lane, 10, event.good ? ['#8fd4ff', '#fff'] : ['#ff4d6a', '#ffd0dc'], 16)
        return
      }
      case 'drum':
        this.shake = Math.max(this.shake, 5)
        this.sfx.drum()
        this.burstAt(event.lane, event.dist, ['#c9bdd8', '#d6ff3a', '#fff6df'], 12)
        return
      case 'hurt': {
        this.shake = Math.max(this.shake, 8)
        this.sfx.gateBad()
        this.burstAt(event.lane, event.dist, ['#ff8a3a', '#ff4ad8', '#ffd15a', '#fff6df'], 10)
        this.burstAt(this.sim.lane, 8, ['#fff6df', '#d6ff3a', '#7dffb0', '#ffd15a'], 8)
        if (event.loss === 1) this.clashHold = 0.4
        const at = worldPoint(event.lane, Math.max(0, event.dist))
        this.floaters.push({
          x: at.x,
          y: at.y - 28,
          text: `−${event.loss}`,
          life: 0.7,
          max: 0.7,
          color: '#ffd0dc',
        })
        const ring = worldPoint((event.lane + this.sim.lane) / 2, 12)
        this.particles.push({
          x: ring.x,
          y: ring.y,
          vx: 0,
          vy: 0,
          life: 0.35,
          max: 0.35,
          size: 8,
          color: '#fff6df',
          kind: 'ring',
          rot: 0,
        })
        return
      }
      case 'rocket':
        this.rocketHold = 0.5
        this.shake = Math.max(this.shake, 7)
        this.sfx.rocket()
        this.flashColor = 'rgba(255, 180, 58, 0.9)'
        this.flash = 0.2
        return
      case 'boss-down':
        this.shake = 16
        this.flash = 0.85
        this.flashColor = '#fff6df'
        this.slow = 0.4
        this.sfx.bossDown()
        this.burstAt(0, 360, ['#ffd15a', '#ff4ad8', '#d6ff3a', '#fff', '#8fd4ff'], 70)
        this.particles.push({
          x: VIEW_W / 2,
          y: 420,
          vx: 0,
          vy: 0,
          life: 0.8,
          max: 0.8,
          size: 20,
          color: '#fff6df',
          kind: 'ring',
          rot: 0,
        })
        return
      case 'lose':
        this.shake = 10
        this.flash = 0.35
        this.flashColor = 'rgba(40, 20, 60, 0.8)'
        this.syncLive(true)
        return
      default: {
        const unknown: never = event
        void unknown
      }
    }
  }

  private puff(lane: number, dist: number, color: string, count: number): void {
    const at = worldPoint(lane, dist)
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.18,
        max: 0.18,
        size: 3,
        color,
        kind: 'spark',
        rot: 0,
      })
    }
  }

  private burstAt(lane: number, dist: number, colors: string[], count: number): void {
    const at = worldPoint(lane, dist)
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random()
      const speed = 80 + Math.random() * 220
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.3,
        max: 0.7,
        size: 3 + Math.random() * 5,
        color: colors[i % colors.length] ?? '#fff',
        kind: i % 4 === 0 ? 'bit' : 'spark',
        rot: Math.random() * 6,
      })
    }
  }

  private launch(count: number): void {
    const n = Math.min(6, count)
    for (let i = 0; i < n; i += 1) {
      const at = worldPoint(this.sim.lane + (i - n / 2) * 0.08, -10)
      this.flyers.push({
        x: at.x,
        y: at.y,
        vx: (i - n / 2) * 90,
        vy: -180 - Math.random() * 80,
        life: 0.7,
        rot: 0,
        spin: (Math.random() - 0.5) * 8,
      })
    }
  }

  private decay(dt: number): void {
    if (!this.title && this.sim.phase === 'clear' && this.resultAge >= CLEAR_HOLD) {
      this.advance()
      return
    }
    if (this.sim.phase !== 'play') this.resultAge += dt
    this.shake = Math.max(0, this.shake - dt * 28)
    this.flash = Math.max(0, this.flash - dt * 1.8)
    this.burst = Math.max(0, this.burst - dt * 1.6)
    this.numPop = Math.max(0, this.numPop - dt * 2.4)
    this.recoil = Math.max(0, this.recoil - dt * 8)
    this.flipHold = Math.max(0, this.flipHold - dt)
    this.rocketHold = Math.max(0, this.rocketHold - dt)
    this.clashHold = Math.max(0, this.clashHold - dt)
    if (this.slow < 1) {
      this.slow = Math.min(1, this.slow + dt * 0.7)
    }
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.kind === 'ring' ? 0 : 280) * dt
      if (p.kind === 'ring') p.size += dt * 380
      p.rot += dt * 4
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const flyer of this.flyers) {
      flyer.life -= dt
      flyer.x += flyer.vx * dt
      flyer.y += flyer.vy * dt
      flyer.vy += 520 * dt
      flyer.rot += flyer.spin * dt
    }
    this.flyers = this.flyers.filter((flyer) => flyer.life > 0)
    for (const floater of this.floaters) {
      floater.life -= dt
      floater.y -= 36 * dt
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0)
    if (this.particles.length > 240) this.particles.splice(0, this.particles.length - 240)
  }

  private publish(): void {
    const lead = this.sim.bosses.find((boss) => boss.hp > 0 && !boss.preview)
    this.frame.dataset.time = this.sim.time.toFixed(2)
    this.frame.dataset.phase = this.title ? 'title' : this.sim.phase
    this.frame.dataset.dogs = String(this.sim.dogs)
    this.frame.dataset.stage = String(this.sim.stage)
    this.frame.dataset.boss = lead ? String(Math.max(0, Math.ceil(lead.hp))) : ''
    this.frame.dataset.cats = String(this.sim.cats.length)
    this.frame.dataset.flip = this.flipHold > 0 ? this.flipLabel : ''
    this.frame.dataset.clash = this.clashHold > 0 ? '1' : ''
    const bossUp = Boolean(lead && this.sim.phase === 'play' && !this.title)
    const ready = bossUp && this.sim.rocketCd <= 0
    this.rocket.hidden = !bossUp
    this.rocket.disabled = !ready
    this.rocket.setAttribute('aria-disabled', ready ? 'false' : 'true')
    if (this.rocketHold > 0) this.frame.dataset.rocket = 'shot'
    else if (!bossUp) this.frame.dataset.rocket = ''
    else this.frame.dataset.rocket = ready ? 'ready' : 'cool'
    if (this.sim.phase === 'clear') this.syncLive(false, 'クリア')
    else if (this.sim.phase === 'lose') this.syncLive(false, 'ざんねん')
  }

  private mood(): { boss: boolean; closeness: number } {
    let dist = Infinity
    for (const boss of this.sim.bosses) {
      if (boss.preview || boss.hp <= 0) continue
      if (boss.dist < dist) dist = boss.dist
    }
    if (!Number.isFinite(dist)) return { boss: false, closeness: 0 }
    const span = SPAWN_DIST - BOSS_REACH
    const closeness = 1 - Math.min(1, Math.max(0, (dist - BOSS_REACH) / span))
    return { boss: true, closeness }
  }

  private advance(): void {
    this.beginStage(this.sim.stage + 1)
  }

  private beginStage(stage: number): void {
    this.rememberStage(stage)
    this.sim = createSim(stage)
    this.particles = []
    this.flyers = []
    this.floaters = []
    this.shake = 0
    this.flash = 0
    this.burst = 0
    this.resultAge = 0
    this.phaseSeen = 'play'
    this.title = false
    this.syncLive(true)
  }

  private rememberStage(stage: number): void {
    this.bestStage = Math.max(this.bestStage, stage)
    try {
      localStorage.setItem(STAGE_KEY, String(this.bestStage))
    } catch {
      // 保存できなくても、その場の進行は続く。
    }
  }

  private syncLive(force: boolean, text = ''): void {
    if (!force && text === this.liveText) return
    this.liveText = text
    this.live.textContent = text
  }
}

function loadBestStage(): number {
  try {
    const saved = Number(localStorage.getItem(STAGE_KEY) ?? '1')
    if (!Number.isFinite(saved) || saved < 1) return 1
    return Math.floor(saved)
  } catch {
    return 1
  }
}
