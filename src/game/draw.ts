import { LOOK, SCROLL_SPEED, VIEW_H, VIEW_W } from './config'
import { beanOffsets, project } from './layout'
import { countFontSize, gateLabel, gateTone } from './rules'
import type { SpriteSet } from './sprites'
import type { Bullet, Cat, Drum, Gate, Sim } from './types'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  kind: 'spark' | 'bit' | 'ring'
  rot: number
}

export interface Flyer {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  rot: number
  spin: number
}

export interface Floater {
  x: number
  y: number
  text: string
  life: number
  max: number
  color: string
}

export interface RenderState {
  sim: Sim
  sprites: SpriteSet
  particles: Particle[]
  flyers: Flyer[]
  floaters: Floater[]
  shake: number
  flash: number
  flashColor: string
  burst: number
  numPop: number
  time: number
  resultAge: number
  recoil: number
  laneVel: number
}

const INK = '#1a1024'
const FONT = '"Dela Gothic One", sans-serif'

interface Fur {
  body: string
  shade: string
  belly: string
  stripe: string
  ear: string
  eye: string
}

const FURS: readonly Fur[] = [
  { body: '#f6a13a', shade: '#e07d22', belly: '#ffe6c4', stripe: '#c86a1e', ear: '#ffb4c6', eye: '#1a1024' },
  { body: '#8d96b0', shade: '#5c657f', belly: '#f4f6fd', stripe: '#46506a', ear: '#f0b4c4', eye: '#1a1024' },
  { body: '#3c354c', shade: '#262033', belly: '#7a718c', stripe: '#171320', ear: '#e7a0b6', eye: '#ffe56a' },
  { body: '#f4ebdd', shade: '#dcc7aa', belly: '#fffaf4', stripe: '#c9b499', ear: '#f3b3c2', eye: '#1a1024' },
]

const BOSS_FUR: Fur = {
  body: '#ffb03c',
  shade: '#e07a18',
  belly: '#fff1d4',
  stripe: '#c45c12',
  ear: '#ff9eb4',
  eye: '#1a1024',
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string, width = 3.5): void {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = width
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  h: number,
  tilt = 0,
): void {
  if (!img.complete || img.naturalWidth === 0) return
  const w = h * (img.naturalWidth / img.naturalHeight)
  if (tilt === 0) {
    ctx.drawImage(img, x - w / 2, y - h, w, h)
    return
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.drawImage(img, -w / 2, -h, w, h)
  ctx.restore()
}

function drawSky(ctx: CanvasRenderingContext2D, time: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, LOOK.horizonY + 40)
  sky.addColorStop(0, '#140824')
  sky.addColorStop(0.45, '#3a1868')
  sky.addColorStop(0.78, '#ff6a3a')
  sky.addColorStop(1, '#ffd27a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, LOOK.horizonY + 50)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 67) % VIEW_W
    const y = (i * 41) % (LOOK.horizonY - 20)
    const tw = 0.4 + ((i * 17) % 5) * 0.15 + Math.sin(time * 2 + i) * 0.25
    ctx.globalAlpha = 0.35 + tw * 0.4
    ctx.beginPath()
    ctx.arc(x, y, 1.1 + (i % 3) * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const moonX = 312
  const moonY = 78
  const moon = ctx.createRadialGradient(moonX - 8, moonY - 8, 8, moonX, moonY, 36)
  moon.addColorStop(0, '#fff7d2')
  moon.addColorStop(1, '#ffc56a')
  ctx.fillStyle = moon
  ctx.beginPath()
  ctx.arc(moonX, moonY, 32, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 186, 92, 0.45)'
  ctx.beginPath()
  ctx.arc(moonX + 8, moonY + 6, 7, 0, Math.PI * 2)
  ctx.arc(moonX - 10, moonY - 4, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath()
  ctx.ellipse(80, 120, 46, 16, -0.2, 0, Math.PI * 2)
  ctx.ellipse(120, 128, 34, 12, 0.1, 0, Math.PI * 2)
  ctx.fill()
}

function drawBuildings(ctx: CanvasRenderingContext2D, time: number): void {
  const scroll = (time * 28) % 160
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i += 1) {
      const depth = ((i * 160 - scroll) % 1120 + 1120) % 1120
      const t = depth / 1120
      const y = LOOK.horizonY + 8 + t * 210
      const h = 70 + (1 - t) * 120
      const w = 46 + (i % 3) * 10
      const edge = project(side, 0)
      const x = side < 0 ? 8 + (1 - t) * 18 : VIEW_W - w - 8 - (1 - t) * 18
      void edge
      ctx.fillStyle = i % 2 === 0 ? '#24143c' : '#1a1030'
      ctx.fillRect(x, y - h, w, h)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.strokeRect(x, y - h, w, h)
      const win = i % 2 === 0 ? '#ff4ad8' : '#d6ff3a'
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          const lit = (i + row + col) % 3 !== 0
          ctx.fillStyle = lit ? win : '#120818'
          ctx.globalAlpha = lit ? 0.85 : 1
          ctx.fillRect(x + 8 + col * 16, y - h + 12 + row * 18, 8, 10)
        }
      }
      ctx.globalAlpha = 1
    }
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, time: number): void {
  const nearL = project(-1, 0)
  const nearR = project(1, 0)
  const farL = project(-1, 980)
  const farR = project(1, 980)
  const bottom = VIEW_H + 40
  ctx.beginPath()
  ctx.moveTo(farL.x, farL.y)
  ctx.lineTo(farR.x, farR.y)
  ctx.lineTo(nearR.x + 30, bottom)
  ctx.lineTo(nearL.x - 30, bottom)
  ctx.closePath()
  const road = ctx.createLinearGradient(0, LOOK.horizonY, 0, VIEW_H)
  road.addColorStop(0, '#4a2a58')
  road.addColorStop(0.35, '#2a1840')
  road.addColorStop(1, '#1a1028')
  ctx.fillStyle = road
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(farL.x, farL.y)
  ctx.lineTo(nearL.x - 30, bottom)
  ctx.lineTo(nearL.x - 8, bottom)
  ctx.lineTo(farL.x + 8, farL.y)
  ctx.closePath()
  ctx.fillStyle = '#ff4ad8'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(farR.x, farR.y)
  ctx.lineTo(nearR.x + 30, bottom)
  ctx.lineTo(nearR.x + 8, bottom)
  ctx.lineTo(farR.x - 8, farR.y)
  ctx.closePath()
  ctx.fillStyle = '#d6ff3a'
  ctx.fill()

  const dash = (time * SCROLL_SPEED * 0.45) % 70
  ctx.strokeStyle = 'rgba(255, 236, 180, 0.8)'
  ctx.lineWidth = 4
  ctx.setLineDash([18, 22])
  ctx.lineDashOffset = -dash
  ctx.beginPath()
  ctx.moveTo(VIEW_W / 2, LOOK.horizonY + 6)
  ctx.lineTo(VIEW_W / 2, bottom)
  ctx.stroke()
  ctx.setLineDash([])

  for (let i = 0; i < 8; i += 1) {
    const dist = ((i * 120 - time * SCROLL_SPEED) % 960 + 960) % 960
    const mark = project(0, dist)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.ellipse(mark.x, mark.y, 26 * mark.scale, 8 * mark.scale, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawGate(ctx: CanvasRenderingContext2D, gate: Gate): void {
  const dist = Math.max(0, gate.dist)
  const sideLane = gate.side < 0 ? -0.52 : 0.52
  const at = project(sideLane, dist)
  const edge = project(gate.side < 0 ? -1 : 1, dist)
  const mid = project(0, dist)
  const width = Math.max(54, Math.abs(edge.x - mid.x) * 0.9)
  const height = LOOK.gateH * at.scale
  const tone = gateTone(gate.op)
  const pop = gate.pop
  const swell = 1 + pop * 0.22
  const hop = pop * 22 * Math.max(0.45, at.scale)
  const x = -width / 2
  const y = -height * 0.72
  ctx.save()
  ctx.translate(at.x, at.y - hop)
  ctx.scale(swell, swell)
  if (gate.flash > 0) ctx.globalAlpha = 0.72 + gate.flash * 0.28
  const glow = ctx.createLinearGradient(x, y, x, y + height)
  if (tone === 'blue') {
    glow.addColorStop(0, '#b9ecff')
    glow.addColorStop(0.45, '#3b8dff')
    glow.addColorStop(1, '#163a9a')
  } else {
    glow.addColorStop(0, '#ffe0e8')
    glow.addColorStop(0.45, '#ff3d62')
    glow.addColorStop(1, '#9a1038')
  }
  roundRect(ctx, x, y, width, height, 16 * at.scale)
  ctx.fillStyle = glow
  ctx.fill()
  ctx.lineWidth = Math.max(3, 7 * at.scale)
  ctx.strokeStyle = gate.flash > 0.2 ? '#fff6df' : INK
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  roundRect(ctx, x + 6 * at.scale, y + 6 * at.scale, width - 12 * at.scale, height * 0.28, 8 * at.scale)
  ctx.fill()

  const label = gateLabel(gate.op)
  const fontSize = Math.max(18, (label.length > 3 ? 30 : label.length > 2 ? 36 : 48) * at.scale) * (1 + pop * 0.18)
  ctx.font = `${fontSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, fontSize * 0.12)
  ctx.strokeStyle = INK
  ctx.strokeText(label, 0, y + height * 0.58)
  ctx.fillStyle = '#fffdf8'
  ctx.fillText(label, 0, y + height * 0.58)
  if (gate.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = `rgba(255,255,255,${0.35 + gate.flash * 0.65})`
    roundRect(ctx, x, y, width, height, 16 * at.scale)
    ctx.fill()
  }
  ctx.restore()
}

function paintDrum(ctx: CanvasRenderingContext2D, drum: Drum): void {
  const at = project(drum.lane, Math.max(0, drum.dist))
  const h = LOOK.drumH * at.scale
  const w = h * 0.92
  const x = at.x - w / 2
  const y = at.y - h * 0.9
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(at.x, at.y + 2, w * 0.42, Math.max(3, h * 0.1), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(at.x, y + h * 0.16, w * 0.5, Math.max(4, h * 0.12), 0, 0, Math.PI * 2)
  ctx.fillStyle = '#fff6df'
  ctx.fill()
  ctx.lineWidth = Math.max(2, 3 * at.scale)
  ctx.strokeStyle = INK
  ctx.stroke()
  roundRect(ctx, x, y + h * 0.16, w, h * 0.78, 8 * at.scale)
  const body = ctx.createLinearGradient(x, y, x + w, y)
  body.addColorStop(0, '#6d5a86')
  body.addColorStop(0.45, '#c9bdd8')
  body.addColorStop(1, '#3a2c4e')
  ctx.fillStyle = body
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#d6ff3a'
  ctx.fillRect(x + 2, y + h * 0.42, w - 4, Math.max(6, h * 0.16))
  ctx.strokeRect(x + 2, y + h * 0.42, w - 4, Math.max(6, h * 0.16))
  if (drum.hp < drum.maxHp) {
    const ratio = Math.max(0, drum.hp / drum.maxHp)
    ctx.fillStyle = INK
    ctx.fillRect(x, y + h * 0.95, w, 4)
    ctx.fillStyle = '#d6ff3a'
    ctx.fillRect(x, y + h * 0.95, w * ratio, 4)
  }
  if (drum.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = `rgba(255,255,255,${drum.flash * 0.55})`
    roundRect(ctx, x, y + h * 0.16, w, h * 0.78, 8 * at.scale)
    ctx.fill()
  }
  ctx.restore()
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, fur: Fur, angry: boolean): void {
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(x, y, angry ? 5.2 : 6.2, angry ? 6.4 : 7.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = fur.eye
  ctx.beginPath()
  ctx.ellipse(x + 0.6, y + 0.8, angry ? 2.4 : 3.1, angry ? 3.6 : 4.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x - 1.4, y - 1.6, 1.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.2
  ctx.beginPath()
  if (angry) {
    ctx.moveTo(x - 7, y - 7)
    ctx.quadraticCurveTo(x, y - 4, x + 7, y - 9)
  } else {
    ctx.moveTo(x - 6, y - 8)
    ctx.quadraticCurveTo(x, y - 10, x + 6, y - 7)
  }
  ctx.stroke()
}

function drawCat(ctx: CanvasRenderingContext2D, cat: Cat, time: number): void {
  const at = project(cat.lane, Math.max(0, cat.dist))
  const bob = Math.sin(time * 8 + cat.variant) * 1.4 * at.scale
  const h = LOOK.catH * (cat.brute ? LOOK.bruteMul : LOOK.hordeMul) * at.scale
  const fur = FURS[cat.variant] ?? FURS[0]
  if (cat.brute) paintCat(ctx, at.x, at.y + bob, h / 84, fur, false, cat.flash, time + cat.id)
  else paintHordeCat(ctx, at.x, at.y + bob, h / 84, fur, cat.flash)
}

function drawBoss(ctx: CanvasRenderingContext2D, sim: Sim, time: number): void {
  const boss = sim.boss
  if (!boss || boss.hp <= 0) return
  const at = project(0, boss.dist)
  const bob = Math.sin(time * 3.2) * 3
  const h = LOOK.catH * LOOK.bossMul * at.scale
  paintCat(ctx, at.x, at.y + bob, h / 84, BOSS_FUR, true, boss.flash, time)
}

function paintCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  fur: Fur,
  boss: boolean,
  flash: number,
  time: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(0, 2, boss ? 34 : 24, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  const sway = Math.sin(time * 6) * 3
  ctx.strokeStyle = fur.shade
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-10, -18)
  ctx.quadraticCurveTo(-36, -10 + sway, -28, -42 + sway)
  ctx.stroke()
  ctx.strokeStyle = INK
  ctx.lineWidth = 10
  ctx.globalCompositeOperation = 'destination-over'
  ctx.beginPath()
  ctx.moveTo(-10, -18)
  ctx.quadraticCurveTo(-36, -10 + sway, -28, -42 + sway)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = fur.body
  ctx.beginPath()
  ctx.arc(-28, -44 + sway, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(0, -30, boss ? 28 : 22, boss ? 20 : 16, 0, 0, Math.PI * 2)
  fillStroke(ctx, fur.body, 3.5)
  ctx.beginPath()
  ctx.ellipse(2, -24, 12, 10, 0, 0, Math.PI * 2)
  ctx.fillStyle = fur.belly
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(-14, -12, 7, 5, 0.4, 0, Math.PI * 2)
  fillStroke(ctx, fur.shade, 2.5)
  ctx.beginPath()
  ctx.ellipse(14, -12, 7, 5, -0.4, 0, Math.PI * 2)
  fillStroke(ctx, fur.shade, 2.5)

  ctx.beginPath()
  ctx.arc(0, -52, boss ? 24 : 20, 0, Math.PI * 2)
  fillStroke(ctx, fur.body, 3.5)

  const ears: Array<[number, number, number]> = [
    [-14, -64, -1],
    [14, -64, 1],
  ]
  for (const [ex, ey, dir] of ears) {
    ctx.beginPath()
    ctx.moveTo(ex - 8 * dir, ey + 8)
    ctx.lineTo(ex + 2 * dir, ey - (boss && dir < 0 ? 8 : 16))
    ctx.lineTo(ex + 10 * dir, ey + 6)
    ctx.closePath()
    fillStroke(ctx, fur.body, 3)
    ctx.beginPath()
    ctx.moveTo(ex - 4 * dir, ey + 4)
    ctx.lineTo(ex + 2 * dir, ey - 8)
    ctx.lineTo(ex + 6 * dir, ey + 3)
    ctx.closePath()
    ctx.fillStyle = fur.ear
    ctx.fill()
  }
  if (boss) {
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-22, -70)
    ctx.lineTo(-16, -62)
    ctx.stroke()
  }

  ctx.fillStyle = fur.stripe
  ctx.beginPath()
  ctx.moveTo(-6, -68)
  ctx.quadraticCurveTo(0, -60, 0, -54)
  ctx.quadraticCurveTo(0, -60, 6, -68)
  ctx.fill()

  eye(ctx, -8, -54, fur, boss)
  eye(ctx, 8, -54, fur, boss)

  ctx.beginPath()
  ctx.ellipse(0, -46, 8, 6, 0, 0, Math.PI * 2)
  ctx.fillStyle = fur.belly
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, -45)
  ctx.lineTo(-2.2, -42.2)
  ctx.lineTo(2.2, -42.2)
  ctx.closePath()
  ctx.fillStyle = '#ff8fab'
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(0, -42)
  ctx.lineTo(-4, -38)
  ctx.moveTo(0, -42)
  ctx.lineTo(4, -38)
  ctx.stroke()
  if (boss) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(-5, -40)
    ctx.lineTo(-3, -36)
    ctx.lineTo(-1, -40)
    ctx.moveTo(5, -40)
    ctx.lineTo(3, -36)
    ctx.lineTo(1, -40)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(26,16,36,0.65)'
  ctx.lineWidth = 1.2
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(dir * 10, -46)
    ctx.lineTo(dir * 24, -44)
    ctx.moveTo(dir * 10, -43)
    ctx.lineTo(dir * 24, -40)
    ctx.stroke()
  }

  ctx.fillStyle = '#1f6f78'
  roundRect(ctx, -12, -34, 24, 7, 3)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -28, boss ? 6 : 4.5, 0, Math.PI * 2)
  fillStroke(ctx, '#ffd15a', 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.arc(-1.2, -29.4, 1.3, 0, Math.PI * 2)
  ctx.fill()

  if (boss) {
    ctx.strokeStyle = '#a33b3b'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(12, -60)
    ctx.lineTo(18, -52)
    ctx.stroke()
  }

  if (flash > 0) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, flash)})`
    ctx.fillRect(-40, -90, 80, 100)
  }
  ctx.restore()
}

function paintHordeCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  fur: Fur,
  flash: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 2, 18, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.ellipse(0, -28, 16, 12, 0, 0, Math.PI * 2)
  fillStroke(ctx, fur.body, 3)
  ctx.beginPath()
  ctx.arc(0, -46, 15, 0, Math.PI * 2)
  fillStroke(ctx, fur.body, 3)

  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(dir * 6, -52)
    ctx.lineTo(dir * 4, -68)
    ctx.lineTo(dir * 16, -50)
    ctx.closePath()
    fillStroke(ctx, fur.body, 2.5)
    ctx.beginPath()
    ctx.moveTo(dir * 7, -52)
    ctx.lineTo(dir * 6, -62)
    ctx.lineTo(dir * 13, -50)
    ctx.closePath()
    ctx.fillStyle = fur.ear
    ctx.fill()
  }

  eye(ctx, -6, -48, fur, false)
  eye(ctx, 6, -48, fur, false)
  ctx.beginPath()
  ctx.moveTo(0, -42)
  ctx.lineTo(-2, -39)
  ctx.lineTo(2, -39)
  ctx.closePath()
  ctx.fillStyle = '#ff8fab'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(0, -24, 3.2, 0, Math.PI * 2)
  fillStroke(ctx, '#ffd15a', 1.6)

  if (flash > 0) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, flash)})`
    ctx.fillRect(-30, -74, 60, 80)
  }
  ctx.restore()
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet): void {
  const at = project(bullet.lane, bullet.dist)
  const trail = bullet.kind === 'rocket' ? 46 : 28
  const behind = project(bullet.lane, bullet.dist - trail)
  const color = bullet.kind === 'rocket' ? '#ffb43a' : '#d6ff3a'
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.85
  ctx.lineWidth = bullet.kind === 'rocket' ? 7 : 3
  ctx.beginPath()
  ctx.moveTo(behind.x, behind.y)
  ctx.lineTo(at.x, at.y)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = bullet.kind === 'rocket' ? '#fff6df' : color
  ctx.beginPath()
  ctx.arc(at.x, at.y, (bullet.kind === 'rocket' ? 11 : 5) * Math.max(0.45, at.scale), 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
}

function drawArmy(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { sim, sprites } = state
  const spread = 1 + state.burst * 0.95
  const slots = beanOffsets(sim.dogs, spread)
  const wave = Math.sin(state.time * 9) * 2
  slots.forEach((slot, index) => {
    const at = project(sim.lane + slot.lane, slot.dist)
    const h = LOOK.beanH * at.scale * (1 + state.burst * 0.18)
    drawSprite(ctx, sprites.idle, at.x, at.y + (index % 2 === 0 ? wave : -wave), h)
  })

  const captain = project(sim.lane, 0)
  const pose =
    sim.phase === 'lose'
      ? sprites.dizzy
      : state.laneVel < -0.35
        ? sprites.left
        : state.laneVel > 0.35
          ? sprites.right
          : sprites.idle
  const jump = sim.phase === 'clear' ? Math.abs(Math.sin(state.time * 7)) * 16 : 0
  const h = LOOK.captainH * (1 + state.recoil * 0.06)
  ctx.fillStyle = 'rgba(0,0,0,0.32)'
  ctx.beginPath()
  ctx.ellipse(captain.x, captain.y + 4, h * 0.34, h * 0.09, 0, 0, Math.PI * 2)
  ctx.fill()
  drawSprite(ctx, pose, captain.x, captain.y - jump - state.recoil * 6, h)

  const pop = 1 + state.numPop * 0.35
  const label = String(sim.dogs)
  const fontSize = countFontSize(sim.dogs) * pop
  ctx.font = `${fontSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(label).width
  const bw = Math.max(fontSize, tw + fontSize * 0.55)
  const bh = fontSize * 1.15
  const bx = captain.x - bw / 2
  const by = captain.y - h - bh * 0.35 - jump
  roundRect(ctx, bx, by, bw, bh, 10)
  ctx.fillStyle = '#fff6df'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.fillText(label, captain.x, by + bh / 2 + 1)
}

function drawFloaters(ctx: CanvasRenderingContext2D, floaters: Floater[]): void {
  for (const floater of floaters) {
    const t = floater.life / floater.max
    ctx.globalAlpha = Math.max(0, t)
    ctx.font = `28px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.strokeText(floater.text, floater.x, floater.y)
    ctx.fillStyle = floater.color
    ctx.fillText(floater.text, floater.x, floater.y)
    ctx.globalAlpha = 1
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const t = Math.max(0, p.life / p.max)
    ctx.globalAlpha = t
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = 4 * t
      ctx.beginPath()
      ctx.arc(0, 0, p.size, 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.kind === 'bit') {
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7)
    } else {
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(0, 0, p.size * t, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }
}

function drawFlyers(ctx: CanvasRenderingContext2D, state: RenderState): void {
  for (const flyer of state.flyers) {
    ctx.globalAlpha = Math.max(0, flyer.life / 0.7)
    drawSprite(ctx, state.sprites.idle, flyer.x, flyer.y, 48, flyer.rot)
    ctx.globalAlpha = 1
  }
}

function drawBossBar(ctx: CanvasRenderingContext2D, sim: Sim): void {
  const boss = sim.boss
  if (!boss) return
  const ratio = Math.max(0, boss.hp / boss.maxHp)
  const x = 70
  const y = 14
  const w = VIEW_W - 96
  const h = 16
  roundRect(ctx, x, y, w, h, 8)
  ctx.fillStyle = '#1a1024'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#fff6df'
  ctx.stroke()
  if (ratio > 0) {
    roundRect(ctx, x + 3, y + 3, (w - 6) * ratio, h - 6, 5)
    const fill = ctx.createLinearGradient(x, y, x + w, y)
    fill.addColorStop(0, '#ffd15a')
    fill.addColorStop(1, '#ff3d62')
    ctx.fillStyle = fill
    ctx.fill()
  }
}

function drawResult(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { sim, resultAge } = state
  if (sim.phase === 'play') return
  if (sim.phase === 'clear' && resultAge < 0.35) return
  if (sim.phase === 'lose' && resultAge < 0.12) return
  ctx.fillStyle = sim.phase === 'clear' ? 'rgba(20, 8, 32, 0.28)' : 'rgba(8, 4, 16, 0.45)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  const word = sim.phase === 'clear' ? 'クリア' : 'ざんねん'
  const pulse = 1 + Math.sin(state.time * 5) * 0.04
  ctx.save()
  ctx.translate(VIEW_W / 2, sim.phase === 'clear' ? 300 : 250)
  ctx.scale(pulse, pulse)
  ctx.font = `64px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 10
  ctx.strokeStyle = INK
  ctx.strokeText(word, 0, 0)
  const grad = ctx.createLinearGradient(0, -30, 0, 30)
  if (sim.phase === 'clear') {
    grad.addColorStop(0, '#fff4b8')
    grad.addColorStop(1, '#ffb43a')
  } else {
    grad.addColorStop(0, '#d7e4ff')
    grad.addColorStop(1, '#8aa4d4')
  }
  ctx.fillStyle = grad
  ctx.fillText(word, 0, 0)
  ctx.restore()
}

function drawWorldItem(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  kind: 'gate' | 'drum' | 'cat' | 'bullet',
  index: number,
): void {
  const { sim } = state
  switch (kind) {
    case 'gate': {
      const gate = sim.gates[index]
      if (gate) drawGate(ctx, gate)
      return
    }
    case 'drum': {
      const drum = sim.drums[index]
      if (drum) paintDrum(ctx, drum)
      return
    }
    case 'cat': {
      const cat = sim.cats[index]
      if (cat) drawCat(ctx, cat, state.time)
      return
    }
    case 'bullet': {
      const bullet = sim.bullets[index]
      if (bullet) drawBullet(ctx, bullet)
      return
    }
    default: {
      const unknown: never = kind
      void unknown
    }
  }
}

export function render(ctx: CanvasRenderingContext2D, state: RenderState): void {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  const mag = state.shake
  const ox = Math.sin(state.time * 48) * mag
  const oy = Math.cos(state.time * 37) * mag
  ctx.save()
  ctx.translate(ox, oy)
  drawSky(ctx, state.time)
  drawBuildings(ctx, state.time)
  drawRoad(ctx, state.time)

  const order: { dist: number; kind: 'gate' | 'drum' | 'cat' | 'bullet'; index: number }[] = []
  state.sim.gates.forEach((gate, index) => order.push({ dist: gate.dist, kind: 'gate', index }))
  state.sim.drums.forEach((drum, index) => order.push({ dist: drum.dist, kind: 'drum', index }))
  state.sim.cats.forEach((cat, index) => order.push({ dist: cat.dist, kind: 'cat', index }))
  state.sim.bullets.forEach((bullet, index) => order.push({ dist: bullet.dist, kind: 'bullet', index }))
  order.sort((a, b) => b.dist - a.dist)
  for (const item of order) drawWorldItem(ctx, state, item.kind, item.index)
  drawBoss(ctx, state.sim, state.time)
  drawArmy(ctx, state)
  drawFlyers(ctx, state)
  ctx.restore()

  drawParticles(ctx, state.particles)
  drawFloaters(ctx, state.floaters)
  drawBossBar(ctx, state.sim)

  if (state.flash > 0) {
    ctx.fillStyle = state.flashColor
    ctx.globalAlpha = Math.min(0.65, state.flash)
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = 1
  }
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 180, VIEW_W / 2, VIEW_H / 2, 520)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  drawResult(ctx, state)
}

export function worldPoint(lane: number, dist: number): { x: number; y: number } {
  const at = project(lane, dist)
  return { x: at.x, y: at.y }
}
