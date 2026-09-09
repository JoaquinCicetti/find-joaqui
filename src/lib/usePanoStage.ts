import { useEffect, useRef, useState } from 'react'
import { SYSTEM, Viewer } from '@photo-sphere-viewer/core'
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin'
import { FULL_SPHERE, displaySrc, lowSrc, type MediaItem } from '../data/panoramas'
import { isPanoWarm, markWarmed, prefetchImage, warmPano } from './prefetch'

/** 'idle' = nothing on the sphere yet, 'placeholder' = the 8 KB blur, 'full' = done. */
export type Stage = 'idle' | 'placeholder' | 'full'

/** Cold-path stage-1 dissolve. Just enough to not be a cut. */
const LOW_MS = 400
/** How long we'll sit on an empty stage before admitting we're loading. */
export const LOADER_DELAY_MS = 700

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** True when the browser can actually run the viewer at all. */
export function webglAvailable(): boolean {
  SYSTEM.load() // idempotent, guarded by SYSTEM.loaded
  return SYSTEM.isWebGLSupported
}

interface Options {
  containerRef: React.RefObject<HTMLDivElement | null>
  item: MediaItem
  /** Builds the viewer. Called once per mount — must not close over `item`. */
  build: (container: HTMLElement) => Viewer
  /** Duration of the full-res dissolve, in ms. */
  fullMs: number
  /** Re-create the viewer when any of these change (e.g. navbar, gyro). */
  deps: unknown[]
}

/**
 * Owns a *persistent* Photo Sphere Viewer and drives a two-stage reveal into it.
 *
 * The viewer is created once and reused across items. That is the whole point:
 * tearing it down per item is what produced the blank stage between rounds,
 * because a fresh WebGL context has nothing to dissolve *from*.
 *
 * Stage 1 (the blurred micro thumb) is the cold path only. When the full-res is
 * already warm — which is the steady state, since the game warms every round up
 * front — it is skipped entirely and the previous panorama dissolves straight
 * into the next one. Showing a blurry frame *between two sharp ones* would be
 * worse than the blink we're removing.
 */
export function usePanoStage({
  containerRef,
  item,
  build,
  fullMs,
  deps,
}: Options): {
  viewerRef: React.RefObject<Viewer | null>
  stage: Stage
  ready: boolean
} {
  const viewerRef = useRef<Viewer | null>(null)
  const buildRef = useRef(build)
  buildRef.current = build
  const [ready, setReady] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')

  // --- Effect A: create / destroy. Never keyed on `item`. ---
  useEffect(() => {
    if (!containerRef.current) return
    const viewer = buildRef.current(containerRef.current)
    viewerRef.current = viewer
    viewer.addEventListener('ready', () => setReady(true), { once: true })
    return () => {
      setReady(false)
      setStage('idle')
      // Null the ref *before* destroy so any in-flight chain sees it and bails.
      viewerRef.current = null
      viewer.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // --- Effect B: the item chain. Declared after A, so the viewer exists. ---
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    let cancelled = false
    const alive = () => !cancelled && viewerRef.current === viewer

    const full = displaySrc(item)
    const low = lowSrc(item)
    const reduce = prefersReducedMotion()

    // Framing: with a persistent viewer the player's yaw/pitch/zoom from the
    // previous round would otherwise carry into the next one — a fairness bug
    // in a find-the-thing game. `rotation: false` makes PSV pre-rotate the
    // incoming mesh to compensate, so nothing visibly moves during the reveal.
    const framing = { position: { yaw: 0, pitch: 0 }, zoom: 30 } as const

    // ...but passing position/zoom triggers viewer.stopAll(), and the gyroscope
    // plugin stops itself on that event. Remember, and re-arm afterwards.
    const gp = viewer.getPlugin<GyroscopePlugin>(GyroscopePlugin)
    const wasGyro = gp?.isEnabled() ?? false
    const restoreGyro = () => {
      if (wasGyro && gp && !gp.isEnabled()) gp.start().catch(() => {})
    }

    // Start the real download IMMEDIATELY, before touching the placeholder.
    // Awaiting the placeholder's transition first delayed this request by
    // ~600ms of pure dead time, for bytes we always need.
    const fullReady = warmPano(full)

    ;(async () => {
      const first = !viewer.state.ready // no previous panorama to dissolve from

      if (!isPanoWarm(full)) {
        setStage('placeholder')
        await viewer
          .setPanorama(low, {
            showLoader: false,
            panoData: FULL_SPHERE,
            transition:
              first || reduce
                ? false
                : { speed: LOW_MS, rotation: false, effect: 'fade' },
            ...framing,
          })
          .catch(() => {})
        if (!alive()) return
      }

      // Resolves once the bytes are downloaded AND decoded, so the dissolve
      // can never stall halfway through. Usually already settled by here.
      await fullReady
      if (!alive()) return

      await viewer
        .setPanorama(full, {
          showLoader: false,
          transition: reduce
            ? false
            : { speed: fullMs, rotation: false, effect: 'fade' },
          ...framing,
        })
        .catch(() => {})
      if (!alive()) return

      markWarmed(full)
      restoreGyro()
      setStage('full')
    })()

    // Warm the placeholder for next time even if we skipped it this time.
    prefetchImage(low)

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, fullMs])

  return { viewerRef, stage, ready }
}

/** True once the stage has been empty for longer than a user would tolerate. */
export function useDelayedLoader(stage: Stage): boolean {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (stage !== 'idle') {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), LOADER_DELAY_MS)
    return () => clearTimeout(t)
  }, [stage])
  return show
}
