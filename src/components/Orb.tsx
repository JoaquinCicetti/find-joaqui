import { useEffect, useRef, type CanvasHTMLAttributes } from 'react'
import { MODE_FRAMES, paintFrame, resolvePreset } from 'thinking-orbs/engine'
import { scaleCounts, scaleRadii, type OrbState } from 'thinking-orbs'
import { prefersReducedMotion } from '../lib/usePanoStage'

/**
 * A "thinking orb" (libraries.dev/orbs) drawn at any size.
 *
 * The library's <ThinkingOrb> only ships 20/32/64px presets, so this goes
 * through its exported geometry engine instead: the 64px preset supplies the
 * tuned look, density and dot radii are rescaled for the requested size, and
 * the library's own painter puts the frame on a 2D canvas. Dark ink only —
 * the site has no light theme.
 */

export interface OrbTint {
  r: number
  g: number
  b: number
}

interface OrbProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, 'style'> {
  size: number
  state?: OrbState
  /** ink tint; omit for the stock grayscale */
  tint?: OrbTint
  speed?: number
  style?: React.CSSProperties
}

/** `#rrggbb` → the engine's tint triple */
export const hexTint = (hex: string): OrbTint => {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** the site's soft accent — reads as the same family as the starfield */
export const ORB_TINT = hexTint('#9db1d9')

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function Orb({
  size,
  state = 'searching',
  tint = ORB_TINT,
  speed = 1,
  style,
  ...rest
}: OrbProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { mode, speed: base, opts: preset } = resolvePreset(state, 64)
    // The 64px preset is tuned for its own area; a bigger sphere needs more
    // dots to stay a lattice rather than a sparse scatter.
    let opts = scaleCounts(preset, clamp((size / 64) * 0.9, 1, 4.5))
    opts = scaleRadii(opts, size > 96 ? 1.15 : 1)
    const frameFn = MODE_FRAMES[mode]
    const effSpeed = base * speed

    const paint = (tSec: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      paintFrame(ctx, frameFn(size, tSec, opts), true, tint)
    }

    if (prefersReducedMotion()) {
      paint(0.6)
      return
    }

    let raf = 0
    let running = false
    const loop = () => {
      paint((performance.now() / 1000) * effSpeed)
      if (running) raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }
    paint((performance.now() / 1000) * effSpeed)

    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && document.visibilityState !== 'hidden') start()
      else stop()
    })
    io.observe(canvas)
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop()
      else if (visible) start()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [size, state, tint, speed])

  return (
    <canvas
      ref={ref}
      role="img"
      style={{ width: size, height: size, display: 'block', ...style }}
      {...rest}
    />
  )
}

/**
 * The in-viewer loader: a small searching orb over a soft pool of shadow, so
 * the blurred stand-in it sits on stays legible — the picture develops in
 * around it rather than behind a veil.
 */
export function StageLoader() {
  return (
    <div
      aria-hidden
      className="stage-loader pointer-events-none absolute inset-0 z-10 grid place-items-center"
    >
      <Orb size={64} />
    </div>
  )
}
