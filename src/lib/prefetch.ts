import { asset } from '../data/panoramas'

const warmed = new Set<string>()

/**
 * Warm the browser cache for an image URL. Photos and 360° panos are both
 * plain image files, so this speeds up both <img> tags and the Photo Sphere
 * Viewer's texture fetch. De-duped so re-prefetching a URL is free.
 */
export function prefetchImage(src: string): void {
  const url = asset(src)
  if (warmed.has(url)) return
  warmed.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

/** Run non-urgent work when the browser is idle (with a timeout fallback). */
export function onIdle(fn: () => void): void {
  if (typeof window === 'undefined') return
  const ric = (
    window as typeof window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number
    }
  ).requestIdleCallback
  if (ric) ric(fn, { timeout: 2000 })
  else setTimeout(fn, 300)
}
