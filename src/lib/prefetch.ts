const warmed = new Set<string>()
// Retain in-flight <img> objects so the browser doesn't garbage-collect (and
// cancel) the download before it finishes — the bug that made prefetch flaky.
const inflight = new Map<string, HTMLImageElement>()
const panoInflight = new Map<string, Promise<void>>()

/**
 * Warm the browser cache for a ready-to-load image URL (pass `displaySrc(item)`,
 * not the raw multi-MB original). De-duped; retried on error. Use this for
 * anything the DOM will render as an <img>; for a panorama the sphere will load,
 * use `warmPano` instead — see the note there.
 */
export function prefetchImage(url: string): void {
  if (!url || warmed.has(url) || inflight.has(url)) return
  const img = new Image()
  img.decoding = 'async'
  // Cross-origin (Blob storage) images must be fetched in CORS mode, or the
  // cache entry is opaque and can't be reused by anything that reads pixels.
  if (/^https?:\/\//.test(url) && !url.startsWith(location.origin)) {
    img.crossOrigin = 'anonymous'
  }
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

/**
 * Warm a panorama into Photo Sphere Viewer's *own* cache, so `setPanorama`
 * resolves with zero network work and the dissolve starts immediately.
 *
 * This is not the same as `prefetchImage`. PSV loads panoramas by XHR-to-Blob,
 * never via <img>, and Safari will not hand a no-cors <img> cache entry to a
 * CORS XHR — so an <img> prefetch does nothing at all for the sphere path on
 * cross-origin Blob URLs. `EquirectangularAdapter` calls
 * `loadFile(path, onProgress, cacheKey = path)`, hence url === key below.
 */
export function warmPano(url: string): Promise<void> {
  if (!url || warmed.has(url)) return Promise.resolve()
  let p = panoInflight.get(url)
  if (!p) {
    p = (async () => {
      try {
        // PSV is imported dynamically on purpose: this module is reached from
        // the eagerly-loaded App, and a static import would drag PSV and
        // three.js (~625 kB) out of their lazy chunk into the main bundle.
        const [blob, psv] = await Promise.all([
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(String(r.status))
            return r.blob()
          }),
          import('@photo-sphere-viewer/core'),
        ])
        psv.Cache.add(url, url, blob)
        warmed.add(url)
      } catch {
        /* leave un-warmed so a later attempt can retry */
      } finally {
        panoInflight.delete(url)
      }
    })()
    panoInflight.set(url, p)
  }
  return p
}

/** Has this exact URL been loaded (via prefetch or by actually being viewed)? */
export const isWarmed = (url: string): boolean => warmed.has(url)

/** Same question, named for the panorama call sites. */
export const isPanoWarm = (url: string): boolean => warmed.has(url)

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
