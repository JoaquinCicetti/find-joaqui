const warmed = new Set<string>()
// Retain in-flight <img> objects so the browser doesn't garbage-collect (and
// cancel) the download before it finishes — the bug that made prefetch flaky.
const inflight = new Map<string, HTMLImageElement>()

/**
 * Warm the browser cache for a ready-to-load image URL (pass `displaySrc(item)`,
 * not the raw multi-MB original). De-duped; retried on error. Photos and 360°
 * panos are both plain images, so this speeds up <img> tags and the Photo
 * Sphere Viewer's texture fetch alike.
 */
export function prefetchImage(url: string): void {
  if (!url || warmed.has(url) || inflight.has(url)) return
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    inflight.delete(url)
    warmed.add(url)
  }
  img.onerror = () => {
    inflight.delete(url) // leave un-warmed so a later attempt can retry
  }
  inflight.set(url, img)
  img.src = url
}

/** Has this exact URL been loaded (via prefetch or by actually being viewed)?
 *  Used to skip the loading spinner on images we already have. */
export const isWarmed = (url: string): boolean => warmed.has(url)

/** Record that a URL is loaded — call from a viewer/img once it finishes. */
export const markWarmed = (url: string): void => {
  warmed.add(url)
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
