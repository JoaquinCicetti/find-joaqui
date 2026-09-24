import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { angleDelta } from 'thinking-orbs'
import { finalizeFrame, paintFrame, radiusScale } from 'thinking-orbs/engine'
import { ORB_TINT } from './Orb'
import { prefersReducedMotion } from '../lib/usePanoStage'

/**
 * The page loader: a dotted sphere (the thinking-orbs "searching" look —
 * depth-shaded lattice, a scan meridian sweeping it) that *becomes* the
 * globe.
 *
 * The dots are placed on real latitude/longitude and projected with the same
 * camera MapLibre uses, so once the map has painted (still invisible) one
 * frame of its canvas is read back and every dot learns whether it sits on
 * land or water. Then:
 *
 *   1. the spin eases into the map's own heading and the scan fades;
 *   2. the water dots dissolve — what remains is a dotted map of the
 *      continents, exactly where the real ones are about to appear;
 *   3. the globe fades in beneath them and the land dots sink into it.
 *
 * If the read-back yields nothing (blocked tiles, a blank canvas) the whole
 * lattice simply dissolves over the fading-in globe.
 */

/** MapLibre's initial camera (see GlobeMap) — the orb has to match it. */
const INTRO_ZOOM = 0.9
const TILE = 512
/** MapLibre's default vertical field of view (36.87°) */
const FOV = 0.6435011087932844

/** the morph timeline, ms from the map's first paint */
const T_ALIGN = 700 // spin settles onto the map's heading, scan fades
const T_WATER0 = 450 // water dots start to go…
const T_WATER1 = 1350 // …and are gone
const T_REVEAL = 1250 // the real globe starts fading in (900ms, CSS)
const T_SINK0 = 1500 // land dots start sinking into it…
const T_SINK1 = 2400 // …done; the loader unmounts
/** never sit behind the orb forever if tiles never arrive */
const GIVE_UP_MS = 9000

/** dot lattice: dense enough that continents read as shapes */
const LAT_RINGS = 42
const LON_DENSITY = 128
/** loading-phase camera: a gentle tilt and a slow spin, like the library's */
const LOAD_TILT = 0.38
const SPIN = 0.5 // rad/s
const SCAN = 1.7 * 2 // rad/s, the searching meridian

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
const ramp = (t: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (t - a) / (b - a)))
const deg = Math.PI / 180

interface Camera {
  /** heading (longitude at screen centre), radians */
  yaw: number
  /** latitude at screen centre, radians */
  tilt: number
  /** mercator globe radius, px */
  R: number
  /** camera focal length, px */
  f: number
  cx: number
  cy: number
}

/** MapLibre's globe camera for a zoom and a viewport. */
function cameraFor(
  zoom: number,
  w: number,
  h: number,
  yaw: number,
  tilt: number,
): Camera {
  const R = (TILE * Math.pow(2, zoom)) / (2 * Math.PI)
  const f = (0.5 * h) / Math.tan(FOV / 2)
  return { yaw, tilt, R, f, cx: w / 2, cy: h / 2 }
}

/** A lattice point (lon, lat on the unit sphere) through the camera. */
function project(cam: Camera, cosLat: number, sinLat: number, lon: number) {
  const dl = lon - cam.yaw
  const x = cosLat * Math.sin(dl)
  const z1 = cosLat * Math.cos(dl)
  const ct = Math.cos(cam.tilt)
  const st = Math.sin(cam.tilt)
  const y = sinLat * ct - z1 * st
  const z = sinLat * st + z1 * ct // 1 = facing the camera
  const D = cam.f + cam.R
  const s = (cam.f * cam.R) / (D - cam.R * z)
  return [cam.cx + x * s, cam.cy - y * s, z] as const
}

interface LatticeDot {
  cosLat: number
  sinLat: number
  lon: number
  /** true once the map has told us it sits on land */
  land: boolean
}

function buildLattice(): LatticeDot[] {
  const dots: LatticeDot[] = []
  for (let li = 0; li <= LAT_RINGS; li++) {
    const lat = -Math.PI / 2 + (li / LAT_RINGS) * Math.PI
    const cosLat = Math.cos(lat)
    const sinLat = Math.sin(lat)
    const n = Math.max(1, Math.round(Math.abs(cosLat) * LON_DENSITY))
    for (let lj = 0; lj < n; lj++) {
      dots.push({ cosLat, sinLat, lon: (lj / n) * 2 * Math.PI, land: false })
    }
  }
  return dots
}

/**
 * Read one painted frame of the (invisible) map and mark the lattice dots
 * that land on the land colour. Returns how many did; 0 means the read gave
 * nothing usable and the caller should fall back to a plain dissolve.
 */
function classify(map: maplibregl.Map, dots: LatticeDot[], cam: Camera): number {
  const src = map.getCanvas()
  const w = src.clientWidth
  const h = src.clientHeight
  if (!w || !h) return 0
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  let px: Uint8ClampedArray
  try {
    ctx.drawImage(src, 0, 0, w, h)
    px = ctx.getImageData(0, 0, w, h).data
  } catch {
    return 0
  }
  let land = 0
  for (const d of dots) {
    const [x, y, z] = project(cam, d.cosLat, d.sinLat, d.lon)
    // the far side and the very rim (where the atmosphere blends in) are
    // never "land" — they dissolve with the water
    if (z < 0.12) continue
    const i = ((y | 0) * w + (x | 0)) * 4
    if (i < 0 || i + 2 >= px.length) continue
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const lum = (r + g + b) / 3
    // land #262c34 (lum 44, faintly warm) vs water #161d28 (29, blue) vs
    // the horizon glow #2b3547 (54, clearly blue)
    if (lum > 36 && b - r < 20) {
      d.land = true
      land++
    }
  }
  return land
}

interface LoaderOrbProps {
  /** the globe, once it has painted — starts the morph */
  map: maplibregl.Map | null
  /** the moment to start fading the real globe in */
  onReveal: () => void
  onDone: () => void
}

export function LoaderOrb({ map, onReveal, onDone }: LoaderOrbProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const mapRef = useRef<maplibregl.Map | null>(null)
  mapRef.current = map

  // Give up gracefully when the globe never reports (tiles blocked, offline).
  useEffect(() => {
    if (map) return
    const t = setTimeout(() => {
      onRevealRef.current()
      onDoneRef.current()
    }, GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [map])

  // Reduced motion: no morph, the globe simply takes over when it is ready.
  useEffect(() => {
    if (map && prefersReducedMotion()) {
      onRevealRef.current()
      onDoneRef.current()
    }
  }, [map])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || prefersReducedMotion()) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const dots = buildLattice()
    // dot radii are tuned against the library's 300pt frame
    const rs = radiusScale(2.4 * cameraFor(INTRO_ZOOM, w, h, 0, 0).R, 0.6)

    // --- the morph, armed once the map is in hand ---
    let morphT0 = 0 // performance.now() of the first morphing frame
    let yaw0 = 0
    let tilt0 = LOAD_TILT
    let target: { yaw: number; tilt: number } | null = null
    let hasLand = false
    let revealed = false
    let done = false

    const arm = (m: maplibregl.Map) => {
      const c = m.getCenter()
      target = { yaw: c.lng * deg, tilt: c.lat * deg }
      const cam = cameraFor(m.getZoom(), w, h, target.yaw, target.tilt)
      // read the frame MapLibre paints next, then classify against it
      m.once('render', () => {
        hasLand = classify(m, dots, cam) > 40
      })
      m.triggerRepaint()
    }

    let raf = 0
    let last = performance.now()
    let loadYaw = 0
    let scan = 0

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const m = mapRef.current
      if (m && !target) arm(m)

      // camera: free spin while loading, easing onto the map's heading after
      let yaw: number
      let tilt: number
      let cam: Camera
      let tMorph = 0
      scan += SCAN * dt
      if (!target || !m) {
        loadYaw += SPIN * dt
        yaw = loadYaw
        tilt = LOAD_TILT
        cam = cameraFor(INTRO_ZOOM, w, h, yaw, tilt)
        yaw0 = yaw
        tilt0 = tilt
      } else {
        if (!morphT0) morphT0 = now
        tMorph = now - morphT0
        const ka = easeInOut(ramp(tMorph, 0, T_ALIGN))
        yaw = yaw0 + angleDelta(target.yaw, yaw0) * ka
        tilt = tilt0 + (target.tilt - tilt0) * ka
        // ride the map: once its intro zoom starts the lattice grows with it
        let zoom = INTRO_ZOOM
        try {
          zoom = m.getZoom()
          if (ka >= 1) {
            const c = m.getCenter()
            yaw = c.lng * deg
            tilt = c.lat * deg
          }
        } catch {
          /* rebuilt map */
        }
        cam = cameraFor(zoom, w, h, yaw, tilt)
        if (!revealed && tMorph >= T_REVEAL) {
          revealed = true
          onRevealRef.current()
        }
        if (!done && tMorph >= T_SINK1) {
          done = true
          onDoneRef.current()
          return
        }
      }

      const kAlign = target ? easeInOut(ramp(tMorph, 0, T_ALIGN)) : 0
      const kWater = target ? easeInOut(ramp(tMorph, T_WATER0, T_WATER1)) : 0
      const kSink = target ? easeOut(ramp(tMorph, T_SINK0, T_SINK1)) : 0
      const kAll = target ? easeInOut(ramp(tMorph, T_WATER0, T_SINK1)) : 0
      const dimBase = 0.45 + 0.55 * kAlign

      const out = []
      for (const d of dots) {
        const [x, y, z] = project(cam, d.cosLat, d.sinLat, d.lon)
        const depth = (z + 1) / 2
        const dl = angleDelta(d.lon - yaw, scan)
        const boost =
          Math.exp(-(dl * dl) / 0.18) * Math.max(0, z) * (1 - kAlign)
        let r = (0.69 + 1.95 * depth + boost) * rs
        let white = 0.62 - 0.54 * depth
        let a = dimBase + (1 - dimBase) * Math.min(1, boost)
        if (target) {
          if (hasLand && d.land) {
            // the continents: tighten, brighten, then sink into the real globe
            white *= 1 - 0.3 * kWater
            r *= (1 + 0.12 * kWater) * (1 - 0.65 * kSink)
            a *= 1 - kSink
          } else {
            // water, the far side, the rim: dissolve (with no land
            // information at all, everything dissolves gently together)
            a *= hasLand ? 1 - kWater : 1 - kAll
          }
        }
        out.push({ x, y, z, r, white, a })
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      paintFrame(ctx, finalizeFrame(out, [], 0.3), true, ORB_TINT)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
    // one animation for the loader's whole life; `map` is read through a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[8] block h-full w-full"
    />
  )
}
