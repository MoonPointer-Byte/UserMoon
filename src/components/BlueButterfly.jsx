import { useEffect, useRef, useState } from 'react'
import './BlueButterfly.css'

const VIEW_W = 640
const VIEW_H = 520
const BODY_X = 320
const BODY_Y = 232
const HOLD = 260
const TRAVEL = 1080

const FORE =
  'M336 206 C372 146 438 108 506 106 C558 104 596 138 602 184 C608 232 582 282 526 304 C468 328 392 304 350 262 C334 242 326 224 336 206 Z'
const HIND =
  'M350 260 C396 248 458 274 500 322 C530 358 524 410 476 436 C428 462 372 438 348 388 C334 350 334 294 350 260 Z'
const ANT_L = 'M312 190 C300 158 276 140 262 112'
const ANT_R = 'M328 190 C340 158 364 140 378 112'

const SPRITE_STOPS = [
  ['rgba(255,255,255,1)', 'rgba(226,248,255,0.95)', 'rgba(150,220,255,0)'],
  ['rgba(244,252,255,1)', 'rgba(110,196,255,0.8)', 'rgba(40,130,255,0)'],
  ['rgba(190,224,255,1)', 'rgba(64,126,255,0.62)', 'rgba(30,70,200,0)'],
  ['rgba(246,242,255,1)', 'rgba(176,156,255,0.72)', 'rgba(110,80,230,0)'],
]

function mulberry32(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function easeOutBack(t) {
  const c1 = 1.35
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function clamp01(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

const FOCAL = 920

function project(x, y, z, pitch, yaw) {
  const dx = (x - BODY_X) * 0.9
  const dy = (y - BODY_Y) * 0.9
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const x1 = dx * cy - z * sy
  const z1 = dx * sy + z * cy
  const cx = Math.cos(pitch)
  const sx = Math.sin(pitch)
  const y1 = dy * cx - z1 * sx
  const z2 = dy * sx + z1 * cx
  const persp = FOCAL / (FOCAL - z2)
  return {
    x: BODY_X + x1 * persp,
    y: BODY_Y + y1 * persp,
    persp,
    depth: z2,
  }
}

function fadeStop(color, alpha) {
  return color.replace(/[\d.]+\)$/, `${alpha})`)
}

function makeSprites() {
  return SPRITE_STOPS.map((stops) => {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    glow.addColorStop(0, stops[0])
    glow.addColorStop(0.14, stops[1])
    glow.addColorStop(0.4, fadeStop(stops[1], 0.2))
    glow.addColorStop(1, stops[2])
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, size, size)
    return canvas
  })
}

function pathNode(d) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  node.setAttribute('d', d)
  return node
}

function pointsAlong(d, count, spread, rand) {
  const node = pathNode(d)
  const length = node.getTotalLength()
  const points = []
  for (let index = 0; index < count; index += 1) {
    const distance = length * ((index + rand() * 0.65) / count)
    const current = node.getPointAtLength(Math.min(length - 0.01, distance))
    const next = node.getPointAtLength(Math.min(length - 0.01, distance + 1))
    const dx = next.x - current.x
    const dy = next.y - current.y
    const mag = Math.hypot(dx, dy) || 1
    const offset = (rand() - 0.5) * spread
    points.push({
      x: current.x + (-dy / mag) * offset,
      y: current.y + (dx / mag) * offset,
    })
  }
  return points
}

function buildField() {
  const rand = mulberry32(20261027)
  const field = []

  const add = (x, y, wing, options) => {
    field.push({
      hx: x,
      hy: y,
      wing,
      size: options.size * (0.78 + rand() * 0.5),
      alpha: options.alpha,
      sprite: options.sprite,
      kind: options.kind,
      z: options.z,
      phase: rand() * Math.PI * 2,
      tw: 0.45 + rand() * 1.7,
      drift: options.drift,
    })
  }

  const addWing = (points, style) => {
    points.forEach((point) => {
      const x = point.x - 2
      add(x, point.y, 1, style)
      add(VIEW_W - x, point.y, -1, style)
    })
  }

  const probe = document.createElement('canvas').getContext('2d')

  const rootOrigin = (path, y) => {
    for (let x = 328; x < 520; x += 2) {
      if (probe.isPointInPath(path, x, y)) return { x: x + 8, y }
    }
    return { x: 370, y }
  }

  const addWingLight = (d, rootY) => {
    const path = new Path2D(d)
    const origin = rootOrigin(path, rootY)
    const outline = pointsAlong(d, 160, 0, rand)
    const angles = outline.map((point) => Math.atan2(point.y - origin.y, point.x - origin.x))
    const min = Math.min(...angles)
    const max = Math.max(...angles)
    const rayCount = 84

    for (let index = 0; index <= rayCount; index += 1) {
      const angle = min + ((max - min) * index) / rayCount
      let reach = 0
      let inside = false
      for (let dist = 4; dist <= 340; dist += 3) {
        const x = origin.x + Math.cos(angle) * dist
        const y = origin.y + Math.sin(angle) * dist
        if (probe.isPointInPath(path, x, y)) {
          inside = true
          reach = dist
        } else if (inside) break
      }
      if (reach < 28) continue
      const shift = (index % 4) * 1.8
      for (let dist = 6 + shift; dist <= reach; dist += 7) {
        const t = dist / reach
        addWing([{
          x: origin.x + Math.cos(angle) * dist,
          y: origin.y + Math.sin(angle) * dist,
        }], {
          size: t > 0.92 ? 7.2 : 4.6 + t * 1.8,
          alpha: t > 0.92 ? 1 : 0.34 + t * 0.22,
          sprite: t > 0.88 ? 0 : 2,
          kind: t > 0.92 ? 'edge' : 'ray',
          z: t > 0.92 ? 3 : 1,
          drift: 0.06,
        })
      }
    }

    addWing(pointsAlong(d, 220, 1.4, rand), {
      size: 7.6,
      alpha: 1,
      sprite: 0,
      kind: 'edge',
      z: 4,
      drift: 0.05,
    })

    const mark = (x, y, style) => {
      if (!probe.isPointInPath(path, x, y)) return
      addWing([{ x, y }], style)
    }

    const line = (x0, y0, x1, y1, steps, style) => {
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps
        mark(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, style)
      }
    }

    const vein = (x0, y0, cx, cy, x1, y1) => {
      let prev = null
      for (let step = 0; step <= 34; step += 1) {
        const t = step / 34
        const u = 1 - t
        const x = u * u * x0 + 2 * u * t * cx + t * t * x1
        const y = u * u * y0 + 2 * u * t * cy + t * t * y1
        mark(x, y, { size: 6.4, alpha: 0.98, sprite: 0, kind: 'edge', z: 6, drift: 0.03 })
        if (prev && step % 6 === 0 && step > 4 && step < 30) {
          const dx = x - prev.x
          const dy = y - prev.y
          const mag = Math.hypot(dx, dy) || 1
          const side = step % 12 === 0 ? 1 : -1
          const length = 18 + (step % 5) * 4
          line(x, y, x + (-dy / mag) * length * side, y + (dx / mag) * length * side, 7, {
            size: 4.6,
            alpha: 0.9,
            sprite: 3,
            kind: 'edge',
            z: 6,
            drift: 0.02,
          })
        }
        prev = { x, y }
      }
    }

    const chevron = (points) => {
      for (let index = 0; index < points.length - 1; index += 1) {
        const [x0, y0] = points[index]
        const [x1, y1] = points[index + 1]
        line(x0, y0, x1, y1, 14, {
          size: 5.2,
          alpha: 0.95,
          sprite: index % 2 === 0 ? 0 : 3,
          kind: 'edge',
          z: 6,
          drift: 0.02,
        })
      }
    }

    const star = (cx, cy, outer) => {
      const inner = outer * 0.38
      const verts = []
      for (let index = 0; index < 8; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 4
        const radius = index % 2 === 0 ? outer : inner
        verts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius])
      }
      verts.push(verts[0])
      for (let index = 0; index < verts.length - 1; index += 1) {
        line(verts[index][0], verts[index][1], verts[index + 1][0], verts[index + 1][1], 6, {
          size: 4.2,
          alpha: 0.98,
          sprite: 3,
          kind: 'edge',
          z: 7,
          drift: 0.02,
        })
      }
    }

    const clover = (cx, cy, size) => {
      const steps = 72
      for (let step = 0; step <= steps; step += 1) {
        const theta = (step / steps) * Math.PI * 2
        const radius = Math.sin(theta * 2) * size
        mark(cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius, {
          size: 4.4,
          alpha: 0.98,
          sprite: 0,
          kind: 'edge',
          z: 7,
          drift: 0.02,
        })
      }
      line(cx, cy + size * 0.15, cx, cy + size * 0.95, 8, {
        size: 3.6,
        alpha: 0.85,
        sprite: 3,
        kind: 'edge',
        z: 7,
        drift: 0.02,
      })
    }

    if (rootY < 260) {
      vein(362, 208, 470, 132, 575, 150)
      vein(360, 228, 500, 196, 590, 205)
      vein(358, 246, 470, 248, 545, 286)
      chevron([[430, 145], [490, 172], [545, 150], [590, 178]])
      chevron([[415, 235], [485, 214], [555, 242]])
      clover(500, 168, 26)
      clover(455, 232, 18)
      star(560, 198, 16)
      star(418, 186, 12)
    } else {
      vein(364, 300, 470, 345, 545, 400)
      vein(360, 328, 440, 400, 490, 455)
      chevron([[410, 330], [470, 360], [530, 345], [565, 390]])
      chevron([[400, 390], [455, 420], [510, 400]])
      clover(485, 372, 24)
      clover(430, 410, 16)
      star(535, 430, 15)
      star(395, 355, 11)
    }
  }

  addWingLight(FORE, 214)
  addWingLight(HIND, 330)

  const cluster = (cx, cy, rx, ry, count, style) => {
    for (let index = 0; index < count; index += 1) {
      const angle = rand() * Math.PI * 2
      const radius = Math.sqrt(rand())
      add(cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius, 0, style)
    }
  }

  cluster(320, 198, 11, 13, 28, { size: 14, alpha: 0.9, sprite: 0, kind: 'body', z: 4, drift: 0.35 })
  cluster(320, 226, 8, 16, 26, { size: 13, alpha: 0.85, sprite: 1, kind: 'body', z: 4, drift: 0.3 })
  for (let index = 0; index < 34; index += 1) {
    const t = index / 33
    cluster(320, 248 + t * 98, 6.5 * (1 - t * 0.72), 3.2, 2, {
      size: 11 - t * 4,
      alpha: 0.8,
      sprite: t > 0.65 ? 2 : 0,
      kind: 'body',
      z: 4,
      drift: 0.25,
    })
  }

  pointsAlong(ANT_L, 16, 1.2, rand).forEach((point, index, list) => {
    const tip = index > list.length - 3
    add(point.x, point.y, -1, {
      size: tip ? 12 : 5.5,
      alpha: tip ? 1 : 0.8,
      sprite: 0,
      kind: 'antenna',
      z: 5,
      drift: 0.2,
    })
  })
  pointsAlong(ANT_R, 16, 1.2, rand).forEach((point, index, list) => {
    const tip = index > list.length - 3
    add(point.x, point.y, 1, {
      size: tip ? 12 : 5.5,
      alpha: tip ? 1 : 0.8,
      sprite: 0,
      kind: 'antenna',
      z: 5,
      drift: 0.2,
    })
  })

  const motes = []
  for (let index = 0; index < 28; index += 1) {
    const angle = rand() * Math.PI * 2
    const radius = 40 + rand() * 90
    motes.push({
      hx: BODY_X + Math.cos(angle) * radius,
      hy: BODY_Y + Math.sin(angle) * radius * 0.72,
      size: 4 + rand() * 7,
      alpha: 0.15 + rand() * 0.35,
      sprite: rand() > 0.8 ? 3 : 1,
      phase: rand() * Math.PI * 2,
      tw: 0.25 + rand() * 0.8,
      orbit: 8 + rand() * 18,
    })
  }

  field.forEach((particle) => {
    const distance = Math.hypot(particle.hx - BODY_X, particle.hy - BODY_Y)
    particle.delay = (distance / 320) * 460
    particle.closedX = BODY_X + (particle.hx - BODY_X) * 0.045
    particle.closedY = BODY_Y + (particle.hy - BODY_Y) * 0.62
  })

  field.sort((a, b) => a.z - b.z)
  return { field, motes }
}

function makeSparks(rand) {
  return Array.from({ length: 42 }, () => {
    const angle = rand() * Math.PI * 2
    return {
      angle,
      speed: 90 + rand() * 190,
      life: 700 + rand() * 500,
      delay: rand() * 220,
      size: 6 + rand() * 8,
      sprite: rand() > 0.7 ? 0 : 1,
    }
  })
}

let sharedField = null
let sharedSprites = null

function getAssets() {
  if (!sharedField) sharedField = buildField()
  if (!sharedSprites) sharedSprites = makeSprites()
  return { field: sharedField, sprites: sharedSprites }
}

export default function BlueButterfly({
  size = 780,
  autoBloom = true,
  bloomWhenVisible = false,
  replayToken = 0,
  reactToPointer = false,
  showParticles = true,
  decorative = false,
  label = '蓝色蝴蝶绽放',
  className = '',
  onBloomEnd,
  onBurst,
  gatherToken = 0,
  cover = false,
}) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const onEndRef = useRef(onBloomEnd)
  const onBurstRef = useRef(onBurst)
  const burstRef = useRef(0)
  const gatherRef = useRef(0)
  const enterAt = useRef(0)
  const pointerRef = useRef({ x: 0, y: 0, active: false })
  const [alive, setAlive] = useState(false)
  const [burst, setBurst] = useState(false)
  const [returning, setReturning] = useState(false)
  const [reduceMotion] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  const [flightDir] = useState(() => (Math.random() < 0.5 ? -1 : 1))
  const [flightAngle] = useState(() => Math.random() * Math.PI * 2)
  const [entering, setEntering] = useState(!reduceMotion)
  pointerRef.current.active = reactToPointer

  useEffect(() => {
    onEndRef.current = onBloomEnd
  }, [onBloomEnd])

  useEffect(() => {
    onBurstRef.current = onBurst
  }, [onBurst])

  useEffect(() => {
    if (!entering) return undefined
    enterAt.current = performance.now()
    const node = rootRef.current
    const timer = window.setTimeout(() => {
      if (node) {
        node.style.transform = ''
        node.style.opacity = ''
      }
      setEntering(false)
    }, cover ? 4600 : 7000)
    return () => window.clearTimeout(timer)
  }, [cover, entering])

  useEffect(() => {
    burstRef.current = 0
    gatherRef.current = 0
    setBurst(false)
    setReturning(false)
  }, [replayToken])

  useEffect(() => {
    if (!gatherToken || !burstRef.current) return undefined
    gatherRef.current = performance.now()
    setBurst(false)
    setReturning(true)
    return undefined
  }, [gatherToken])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { field, sprites } = getAssets()
    const rand = mulberry32(replayToken + 17)
    const sparks = makeSparks(rand)
    const ctx = canvas.getContext('2d')
    let frame = 0
    let startedAt = null
    let ended = false
    let aliveSet = false
    let cancelled = false
    let yaw = cover || entering ? 0 : 0.42
    let pitch = cover || entering ? 0 : 0.12
    let flightSettled = false
    const flightFrom = flightDir
    burstRef.current = 0
    let dust = null

    const draw = (now) => {
      if (cover && rootRef.current && window.visualViewport) {
        const box = window.visualViewport
        const node = rootRef.current
        node.style.setProperty('width', `${Math.round(box.width)}px`, 'important')
        node.style.setProperty('height', `${Math.round(box.height)}px`, 'important')
      }
      const cssWidth = canvas.clientWidth
      const cssHeight = canvas.clientHeight
      if (!cssWidth || !cssHeight) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.round(cssWidth * dpr)
      const pixelHeight = Math.round(cssHeight * dpr)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      const elapsed = startedAt == null ? 0 : now - startedAt
      const time = now / 1000
      const flyingIn = startedAt == null && !reduce
      const flightMs = cover ? 3200 : 5600
      const flightT = flyingIn && enterAt.current ? clamp01((now - enterAt.current) / flightMs) : 0
      const phase = flightT * 5.6 * Math.PI * 2 * 1.22
      const beat = Math.sin(phase)
      const glideU = clamp01((flightT - 0.86) / 0.14)
      const glide = glideU * glideU * (3 - 2 * glideU)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const narrow = cssWidth < 760
      if (cover) {
        const wingW = narrow ? 600 : VIEW_W
        const wingH = narrow ? 360 : VIEW_H
        const wingCx = 320
        const wingCy = narrow ? 280 : VIEW_H / 2
        const scale = narrow
          ? (canvas.width / wingW) * 1.08
          : Math.max(canvas.width / wingW, canvas.height / wingH)
        const remain = flyingIn && flightT < 1 ? (1 - flightT) * (1 - flightT) : 0
        const dist = Math.hypot(canvas.width, canvas.height) * 0.58
        ctx.setTransform(
          scale, 0, 0, scale,
          canvas.width / 2 - wingCx * scale + Math.cos(flightAngle) * dist * remain,
          canvas.height / 2 - wingCy * scale + Math.sin(flightAngle) * dist * remain,
        )
      } else {
        ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0)
      }
      ctx.globalCompositeOperation = 'lighter'

      const formed = reduce ? 1 : clamp01((elapsed - HOLD) / (TRAVEL + 460))
      let burstT = 0
      if (gatherRef.current) {
        const back = clamp01((now - gatherRef.current) / (reduce ? 1 : 1400))
        const eased = back * back * (3 - 2 * back)
        burstT = 1 - eased
        if (back >= 1) {
          gatherRef.current = 0
          burstRef.current = 0
          burstT = 0
          if (!cancelled) setReturning(false)
        }
      } else if (burstRef.current) {
        burstT = clamp01((now - burstRef.current) / (reduce ? 1 : 1300))
      }
      const pointer = pointerRef.current
      const aimYaw = flyingIn
        ? (cover ? Math.cos(flightAngle) * -0.28 : flightFrom * -0.04) * (1 - flightT)
        : narrow
          ? 0
          : Math.max(-0.42, Math.min(0.5,
            0.16 + Math.sin(time * 0.35) * 0.1 + (pointer.active ? pointer.x * 0.36 : 0),
          ))
      const aimPitch = flyingIn
        ? 0.02
        : narrow
          ? 0
          : Math.max(-0.22, Math.min(0.26,
            0.06 + Math.sin(time * 0.3) * 0.04 + (pointer.active ? pointer.y * -0.22 : 0),
          ))
      const turn = reduce ? 1 : flyingIn ? 0.14 : 0.07
      yaw += (aimYaw - yaw) * turn
      pitch += (aimPitch - pitch) * turn

      if (flyingIn && rootRef.current && !flightSettled) {
        if (cover) {
          rootRef.current.style.opacity = String(flightT === 0 ? 1 : clamp01(flightT / 0.08))
          rootRef.current.style.transform = ''
        } else {
          const along = flightT < 0.16
            ? (flightT / 0.16) * 0.38
            : flightT < 0.8
              ? 0.38 + (flightT - 0.16) / 0.64 * 0.44
              : 0.82 + (1 - (1 - (flightT - 0.8) / 0.2) ** 2) * 0.18
          const box = rootRef.current.offsetWidth || size
          const off = window.innerWidth * 0.5 + box * 0.56
          const x = (1 - along) * flightFrom * off
          const path = Math.sin(flightT * Math.PI * 2) * 48 + Math.sin(flightT * Math.PI) * -20
          const bob = path * (1 - glide * 0.65) - beat * 16 * (1 - glide)
          const bank = flightFrom * (1 - along) * -7 + Math.cos(flightT * Math.PI * 2) * 8 + beat * 2.5
          rootRef.current.style.opacity = String(clamp01(flightT / 0.05))
          rootRef.current.style.transform = `translate3d(${x}px, ${bob}px, 0) rotate(${bank}deg)`
        }
        if (flightT >= 1) {
          flightSettled = true
          rootRef.current.style.transform = ''
          rootRef.current.style.opacity = ''
          if (!cancelled) setEntering(false)
        }
      }

      const core = project(BODY_X, BODY_Y, 24, pitch, yaw)
      const pulse = 0.55 + Math.sin(time * 2.2) * 0.08
      const glowFade = burstT < 0.4 ? 1 : 1 - (burstT - 0.4) / 0.6
      const glowStrength = (reduce ? 0.28 : 0.55 * (1 - formed) + 0.22) * glowFade
      const glowRadius = (78 + formed * 46) * core.persp * (1 + burstT * 2.2)
      const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, glowRadius)
      glow.addColorStop(0, `rgba(236,248,255,${0.45 * glowStrength})`)
      glow.addColorStop(0.45, `rgba(70,150,255,${0.16 * pulse})`)
      glow.addColorStop(1, 'rgba(40,80,180,0)')
      ctx.globalAlpha = 1
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(core.x, core.y, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      const parts = field.field
      parts.forEach((particle) => {
        const travel = reduce ? 1 : clamp01((elapsed - HOLD - particle.delay) / TRAVEL)
        const open = easeOutBack(travel)
        const span = flyingIn ? 1 - glide : open
        let x = particle.closedX + (particle.hx - particle.closedX) * span
        let y = particle.closedY + (particle.hy - particle.closedY) * span
        if (particle.kind === 'antenna' && !flyingIn && travel > 0.8) {
          const sway = Math.sin(time * 1.35) * 6 * particle.wing
          x += sway * clamp01((200 - particle.hy) / 90)
        }
        x += Math.sin(time * particle.tw + particle.phase) * particle.drift
        y += Math.cos(time * particle.tw * 0.82 + particle.phase) * particle.drift * 0.65

        const sinceOpen = elapsed - HOLD - particle.delay - TRAVEL
        const flapMix = reduce ? 1 : clamp01(sinceOpen / 420)
        const foldScale = particle.kind === 'body' ? 0 : particle.kind === 'antenna' ? 0.3 : 1
        const flightFold = (0.52 - beat * 0.36) * (1 - glide) + 1.05 * glide
        const fold = (flyingIn
          ? flightFold
          : (1 - clamp01(open)) * 1.05 + Math.sin(time * 1.7) * 0.16 * flapMix
        ) * foldScale
        const lx = x - BODY_X
        const camber = particle.kind === 'body' ? 6 : 0
        const angle = particle.wing * fold
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const x3 = BODY_X + lx * cos
        const z3 = camber * cos - lx * sin + Math.sin(time * particle.tw + particle.phase) * particle.drift
        const projected = project(x3, y, z3, pitch, yaw)

        const wave = 0.5 + 0.5 * Math.sin(time * particle.tw + particle.phase)
        let flicker = particle.kind === 'fill' ? 0.25 + 0.75 * wave ** 1.45 : 0.72 + 0.28 * wave
        if (particle.kind === 'glow') flicker *= 0.75 + formed * 0.25
        particle.px = projected.x
        particle.py = projected.y
        particle.ps = particle.size * projected.persp
        particle.pa = particle.alpha * flicker * (0.58 + projected.persp * 0.42)
        particle.depth = projected.depth
      })

      if (burstT > 0) {
        const ease = burstT * burstT * (3 - 2 * burstT)
        const fade = burstT < 0.58 ? 1 : 1 - (burstT - 0.58) / 0.42
        parts.forEach((particle) => {
          const dx = particle.hx - BODY_X
          const dy = (particle.hy - BODY_Y) * 0.92
          const mag = Math.hypot(dx, dy) || 1
          const dist = (36 + mag * 2.8) * ease
          particle.px += (dx / mag) * dist
          particle.py += (dy / mag) * dist
          particle.ps *= 1 + ease * 1.15
          particle.pa *= fade
        })
        if (!dust) {
          const rand = mulberry32(replayToken + 91)
          dust = Array.from({ length: 200 }, () => ({
            angle: rand() * Math.PI * 2,
            len: 24 + rand() * 560,
            size: 1.2 + rand() * 3.4,
            delay: rand() * 180,
            sprite: rand() > 0.72 ? 0 : 1,
          }))
        }
        const gathering = gatherRef.current > 0
        dust.forEach((star) => {
          const age = now - burstRef.current - star.delay
          if (!gathering && age <= 0) return
          const progress = gathering ? burstT : clamp01(age / 1000)
          const distance = star.len * (1 - (1 - progress) ** 2)
          const drawSize = star.size * (1 + progress)
          const half = drawSize / 2
          ctx.globalAlpha = Math.sin(Math.min(progress, 1) * Math.PI) * 0.9
          ctx.drawImage(
            sprites[star.sprite],
            BODY_X + Math.cos(star.angle) * distance - half,
            BODY_Y + Math.sin(star.angle) * distance * 0.78 - half,
            drawSize,
            drawSize,
          )
        })
      }

      parts.sort((a, b) => a.depth - b.depth)
      parts.forEach((particle) => {
        const half = particle.ps / 2
        ctx.globalAlpha = Math.max(0, Math.min(1, particle.pa))
        ctx.drawImage(sprites[particle.sprite], particle.px - half, particle.py - half, particle.ps, particle.ps)
      })

      if (showParticles && burstT < 0.85) {
        const moteFade = (reduce ? 0.7 : clamp01((elapsed - 700) / 900)) * (1 - burstT)
        field.motes.forEach((mote) => {
          const spin = time * mote.tw + mote.phase
          const projected = project(
            mote.hx + Math.cos(spin) * mote.orbit,
            mote.hy + Math.sin(spin * 0.7) * mote.orbit * 0.55,
            Math.sin(spin) * 110,
            pitch,
            yaw,
          )
          const drawSize = mote.size * projected.persp
          const half = drawSize / 2
          ctx.globalAlpha = Math.max(0, Math.min(1,
            mote.alpha * moteFade * (0.4 + 0.6 * Math.sin(spin) ** 2) * projected.persp,
          ))
          ctx.drawImage(sprites[mote.sprite], projected.x - half, projected.y - half, drawSize, drawSize)
        })

        sparks.forEach((spark) => {
          const age = elapsed - 180 - spark.delay
          if (age < 0 || age > spark.life) return
          const progress = age / spark.life
          const distance = spark.speed * progress
          const projected = project(
            BODY_X + Math.cos(spark.angle) * distance,
            BODY_Y + Math.sin(spark.angle) * distance * 0.72,
            Math.cos(spark.angle * 2) * distance * 0.45,
            pitch,
            yaw,
          )
          const drawSize = spark.size * projected.persp
          const half = drawSize / 2
          ctx.globalAlpha = Math.max(0, Math.min(1, (1 - progress) * 0.85))
          ctx.drawImage(sprites[spark.sprite], projected.x - half, projected.y - half, drawSize, drawSize)
        })
      }

      if (!ended && (reduce || elapsed > 1880)) {
        ended = true
        onEndRef.current?.()
      }
      if (!aliveSet && !cancelled && (reduce || elapsed > 1700)) {
        aliveSet = true
        setAlive(true)
      }
    }

    const loop = (now) => {
      if (cancelled) return
      draw(now)
      frame = requestAnimationFrame(loop)
    }

    const begin = () => {
      startedAt = performance.now()
      if (reduce) {
        draw(startedAt + 20000)
        return
      }
      frame = requestAnimationFrame(loop)
    }

    setAlive(false)

    let observer
    if (reduce) {
      begin()
    } else if (entering) {
      frame = requestAnimationFrame(loop)
    } else if (bloomWhenVisible) {
      frame = requestAnimationFrame(loop)
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting || startedAt != null) return
          observer.disconnect()
          startedAt = performance.now()
        },
        { threshold: 0.45 },
      )
      observer.observe(rootRef.current)
    } else if (autoBloom || replayToken > 0) {
      begin()
    } else {
      startedAt = performance.now() - 20000
      setAlive(true)
      frame = requestAnimationFrame(loop)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      if (rootRef.current) {
        rootRef.current.style.transform = ''
        rootRef.current.style.opacity = ''
      }
    }
  }, [autoBloom, bloomWhenVisible, cover, entering, flightAngle, flightDir, replayToken, showParticles, size])

  const onPointerMove = (event) => {
    if (!reactToPointer || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    pointerRef.current.x = (event.clientX - rect.left) / rect.width - 0.5
    pointerRef.current.y = (event.clientY - rect.top) / rect.height - 0.5
  }

  const onPointerLeave = () => {
    pointerRef.current.x = 0
    pointerRef.current.y = 0
  }

  const ignite = () => {
    if (!alive || burstRef.current || decorative || entering) return
    burstRef.current = performance.now()
    setBurst(true)
    onBurstRef.current?.()
  }

  return (
    <div
      ref={rootRef}
      className={`bb ${entering ? 'entering' : ''} ${alive ? 'alive' : ''} ${burst ? 'burst' : ''} ${returning ? 'returning' : ''} ${className}`.trim()}
      style={cover ? undefined : { width: size }}
      role={decorative ? undefined : 'button'}
      tabIndex={decorative ? undefined : 0}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : burst ? '星云已展开' : label}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={ignite}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        ignite()
      }}
    >
      <div className="bb-halo" />
      <div className="bb-tilt">
        <div className="bb-float">
          <canvas ref={canvasRef} className="bb-canvas" />
        </div>
      </div>
    </div>
  )
}
