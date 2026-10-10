import { VIEW_H, VIEW_W, WEAPONS } from './config'
import type { Floater, Flyer, Particle, RenderState } from './draw'
import { render, worldPoint } from './draw'
import { Sfx, loadMuted } from './Sfx'
import { createSim, step } from './sim'
import { loadSprites } from './sprites'
import type { SimEvent } from './types'

export interface Stage {
  canvas: HTMLCanvasElement
  frame: HTMLElement
  mute: HTMLButtonElement
  live: HTMLElement
}

const STEP = 1 / 60

export class Game {
  private readonly canvas: HTMLCanvasElement
  private readonly frame: HTMLElement
  private readonly mute: HTMLButtonElement
  private readonly live: HTMLElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly sprites = loadSprites()
  private readonly sfx: Sfx
  private sim = createSim(1)
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
    this.live = stage.live
    this.ctx = ctx
    this.sfx = new Sfx(loadMuted())
    this.paintMute()
  }

  start(): void {
    this.fit()
    window.addEventListener('resize', () => this.fit())
    this.canvas.addEventListener('pointerdown', (event) => this.onDown(event))
    this.canvas.addEventListener('pointermove', (event) => this.onMove(event))
    this.canvas.addEventListener('pointerup', () => {
      this.pointing = false
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
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    this.canvas.width = Math.floor(VIEW_W * dpr)
    this.canvas.height = Math.floor(VIEW_H * dpr)
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
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
    const lock = this.sim.phase === 'clear' ? 0.45 : 0.05
    if (this.sim.phase !== 'play' && this.resultAge >= lock) {
      const next = this.sim.phase === 'clear' ? this.sim.stage + 1 : this.sim.stage
      this.sim = createSim(next)
      this.particles = []
      this.flyers = []
      this.floaters = []
      this.shake = 0
      this.flash = 0
      this.burst = 0
      this.resultAge = 0
      this.phaseSeen = 'play'
      this.pointing = true
      this.targetLane = this.laneFromEvent(event)
      this.syncLive(true)
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
    this.acc += dt * this.slow
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
    }
    render(this.ctx, state)
    this.publish()
    requestAnimationFrame((next) => this.frameOf(next))
  }

  private tick(dt: number): void {
    const before = this.sim.dogs
    const events = step(this.sim, dt, this.pointing ? this.targetLane : null)
    if (this.sim.dogs > before) this.burst = 1
    if (this.sim.dogs < before) this.launch(before - this.sim.dogs)
    if (this.sim.dogs !== before) this.numPop = 1
    for (const event of events) this.present(event)
    if (this.sim.phase !== this.phaseSeen) {
      this.phaseSeen = this.sim.phase
      this.resultAge = 0
    }
  }

  private present(event: SimEvent): void {
    switch (event.type) {
      case 'shoot':
        this.recoil = 1
        this.sfx.shoot(event.weapon)
        return
      case 'hit':
        this.sfx.hit()
        if (event.target === 'boss') this.shake = Math.max(this.shake, 2.2)
        this.puff(event.lane, event.dist, event.target === 'boss' ? '#ffd15a' : '#fff6df', 3)
        return
      case 'cat-down':
        this.shake = Math.max(this.shake, event.brute ? 6 : 1.2)
        this.sfx.catDown(event.brute)
        this.burstAt(event.lane, event.dist, ['#ffd15a', '#ff8a3a', '#fff6df', '#ff4ad8'], event.brute ? 12 : 4)
        return
      case 'stamp':
        this.shake = Math.max(this.shake, event.hit ? 14 : 10)
        this.sfx.stamp()
        this.flashColor = 'rgba(32, 10, 16, 0.85)'
        this.flash = event.hit ? 0.24 : 0.1
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
      case 'crate':
        this.shake = Math.max(this.shake, 6)
        this.sfx.weaponUp()
        this.flashColor = 'rgba(214, 255, 58, 0.85)'
        this.flash = 0.3
        this.floaters.push({
          x: worldPoint(event.lane, event.dist).x,
          y: worldPoint(event.lane, event.dist).y - 30,
          text: WEAPONS[event.weapon].name,
          life: 0.8,
          max: 0.8,
          color: '#d6ff3a',
        })
        this.burstAt(event.lane, event.dist, ['#e8b15a', '#d6ff3a', '#fff6df'], 14)
        return
      case 'hurt':
        this.shake = Math.max(this.shake, 7)
        this.sfx.gateBad()
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
    if (this.sim.phase !== 'play') this.resultAge += dt
    this.shake = Math.max(0, this.shake - dt * 28)
    this.flash = Math.max(0, this.flash - dt * 1.8)
    this.burst = Math.max(0, this.burst - dt * 1.6)
    this.numPop = Math.max(0, this.numPop - dt * 2.4)
    this.recoil = Math.max(0, this.recoil - dt * 8)
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
    this.frame.dataset.time = this.sim.time.toFixed(2)
    this.frame.dataset.phase = this.sim.phase
    this.frame.dataset.dogs = String(this.sim.dogs)
    this.frame.dataset.weapon = String(this.sim.weapon)
    this.frame.dataset.stage = String(this.sim.stage)
    this.frame.dataset.boss = this.sim.boss ? String(Math.max(0, Math.ceil(this.sim.boss.hp))) : ''
    this.frame.dataset.cats = String(this.sim.cats.length)
    const warning = this.sim.stamps.find((stamp) => !stamp.resolved)
    const slamming = this.sim.stamps.some((stamp) => stamp.resolved)
    this.frame.dataset.stamp = warning ? 'warn' : slamming ? 'slam' : ''
    this.frame.dataset.stampWarn = warning ? warning.warn.toFixed(2) : ''
    if (this.sim.phase === 'clear') this.syncLive(false, 'クリア')
    else if (this.sim.phase === 'lose') this.syncLive(false, 'ざんねん')
  }

  private syncLive(force: boolean, text = ''): void {
    if (!force && text === this.liveText) return
    this.liveText = text
    this.live.textContent = text
  }
}
