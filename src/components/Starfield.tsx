import { useEffect, useRef } from 'react'

/** Static, seeded starfield painted once per resize — the space behind the globe. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = (canvas.width = canvas.offsetWidth * dpr)
      const h = (canvas.height = canvas.offsetHeight * dpr)
      ctx.clearRect(0, 0, w, h)

      // deterministic PRNG so the sky doesn't reshuffle on resize
      let seed = 20260711
      const rand = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }

      const count = Math.round((w * h) / (14000 * dpr))
      for (let i = 0; i < count; i++) {
        const x = rand() * w
        const y = rand() * h
        const r = (rand() * 1.1 + 0.3) * dpr
        const a = rand() * 0.4 + 0.08
        const blue = rand() > 0.75
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = blue
          ? `rgba(150, 180, 255, ${a})`
          : `rgba(220, 228, 245, ${a})`
        ctx.fill()
      }
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  )
}
