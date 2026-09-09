import { useEffect, useRef, useState } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin'
import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/markers-plugin/index.css'
import { displaySrc, lowSrc, type MediaItem } from '../data/panoramas'
import { isWarmed, markWarmed } from '../lib/prefetch'
import { DissolveAdapter } from '../lib/DissolveAdapter'
import {
  useDelayedLoader,
  usePanoStage,
  webglAvailable,
} from '../lib/usePanoStage'
import { isSphereLoc, type JoaquiLocation } from '../game/joaqui'
import { useLang } from '../i18n'
import { IconCompass } from './icons'
import { RingLoader } from './RingField'

/** The game's reveal is the hero moment — unhurried on purpose. */
const GAME_DISSOLVE_MS = 4200

/** A marker drawn on a stage: the player's reticle or Joaqui's real spot. */
export interface StageMarker {
  id: string
  kind: 'reticle' | 'truth'
  loc: JoaquiLocation
}

const MARKER_HTML: Record<StageMarker['kind'], string> = {
  reticle: '<div class="ar-reticle"><i></i></div>',
  truth: '<div class="ar-truth"></div>',
}

const MARKER_SIZE: Record<StageMarker['kind'], number> = {
  reticle: 64,
  truth: 96,
}

interface SphereStageProps {
  item: MediaItem
  markers: StageMarker[]
  onPick?: (loc: JoaquiLocation) => void
  navbar?: boolean
  /** show a device-orientation ("look by moving the phone") toggle */
  gyro?: boolean
  /** when set, the camera glides to this view (e.g. the reveal) */
  focus?: { yaw: number; pitch: number } | null
}

/** 360° pano that reports clicked view angles and renders AR markers. */
export function SphereStage({
  item,
  markers,
  onPick,
  navbar = true,
  gyro = false,
  focus = null,
}: SphereStageProps) {
  const { t } = useLang()
  const ref = useRef<HTMLDivElement>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [gyroAvail, setGyroAvail] = useState(false)
  const [gyroOn, setGyroOn] = useState(false)
  const webgl = webglAvailable()

  const { viewerRef, stage, ready } = usePanoStage({
    containerRef: ref,
    item,
    fullMs: GAME_DISSOLVE_MS,
    deps: [navbar, gyro, webgl],
    build: (container) => {
      const viewer = new Viewer({
        container,
        // No `panorama` here on purpose: usePanoStage drives every load through
        // the same path, so the first item isn't a special case.
        adapter: DissolveAdapter.withConfig({}),
        defaultTransition: {
          speed: GAME_DISSOLVE_MS,
          rotation: false,
          effect: 'fade',
        },
        canvasBackground: 'transparent',
        navbar: navbar ? ['zoom', 'move', 'fullscreen'] : false,
        plugins: gyro
          ? [MarkersPlugin, [GyroscopePlugin, { touchmove: true }]]
          : [MarkersPlugin],
        touchmoveTwoFingers: false,
        defaultZoomLvl: 30,
      })
      viewer.addEventListener('click', ({ data }) => {
        if (!data.rightclick) {
          onPickRef.current?.({ yaw: data.yaw, pitch: data.pitch })
        }
      })
      if (gyro) {
        const plugin = viewer.getPlugin<GyroscopePlugin>(GyroscopePlugin)
        plugin?.isSupported().then(setGyroAvail).catch(() => {})
        plugin?.addEventListener('gyroscope-updated', (e) =>
          setGyroOn(e.gyroscopeEnabled),
        )
      }
      return viewer
    },
  })

  const showLoader = useDelayedLoader(stage)

  // The viewer now outlives the item, so stale markers would hover over the new
  // sphere. Clear them up front; positions are yaw/pitch, so nothing else needs
  // recomputing when the panorama changes.
  useEffect(() => {
    const plugin = viewerRef.current?.getPlugin<MarkersPlugin>(MarkersPlugin)
    try {
      plugin?.setMarkers([])
    } catch {
      // viewer torn down mid-update — safe to ignore
    }
  }, [item.id, viewerRef])

  const toggleGyro = () => {
    const plugin = viewerRef.current?.getPlugin<GyroscopePlugin>(GyroscopePlugin)
    if (!plugin) return
    // start() asks for motion permission on iOS; if refused, stay off
    if (plugin.isEnabled()) plugin.stop()
    else plugin.start().catch(() => setGyroOn(false))
  }

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !ready) return
    const plugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin)
    try {
      plugin?.setMarkers(
        markers
          .filter((m) => isSphereLoc(m.loc))
          .map((m) => {
            const loc = m.loc as { yaw: number; pitch: number }
            return {
              id: m.id,
              position: { yaw: loc.yaw, pitch: loc.pitch },
              html: MARKER_HTML[m.kind],
              size: { width: MARKER_SIZE[m.kind], height: MARKER_SIZE[m.kind] },
              anchor: 'center center',
            }
          }),
      )
    } catch {
      // viewer being torn down mid-update — safe to ignore
    }
  }, [markers, ready, viewerRef])

  useEffect(() => {
    const viewer = viewerRef.current
    // Gated on `stage`, not `ready`: `ready` fires once for the whole viewer
    // lifetime now, so it would let the reveal animate the *previous* sphere.
    if (!viewer || stage !== 'full' || !focus) return
    viewer.animate({ yaw: focus.yaw, pitch: focus.pitch, speed: '4rpm' })
  }, [focus, stage, viewerRef])

  if (!webgl) {
    // A flat equirectangular image isn't a sphere, but it beats an error card.
    return (
      <div className="relative grid h-full w-full place-items-center overflow-hidden">
        <img
          src={displaySrc(item)}
          alt={item.place}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Paints from cache on the first frame, so there is never a blank stage
          under the transparent canvas. */}
      <img
        src={lowSrc(item)}
        alt=""
        aria-hidden
        className={`pano-placeholder ${stage === 'full' ? 'is-hidden' : ''}`}
      />
      <div ref={ref} className="relative h-full w-full" />
      {gyro && gyroAvail && (
        <button
          onClick={toggleGyro}
          aria-label={t.g.gyro}
          aria-pressed={gyroOn}
          title={t.g.gyro}
          className={`glass-chip absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full ${
            gyroOn ? 'text-accent-soft' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <IconCompass className="h-5 w-5" />
        </button>
      )}
      {showLoader && <RingLoader />}
    </div>
  )
}

interface PhotoStageProps {
  item: MediaItem
  markers: StageMarker[]
  onPick?: (loc: JoaquiLocation) => void
}

/** Flat photo that reports normalized click coords and renders AR markers. */
export function PhotoStage({ item, markers, onPick }: PhotoStageProps) {
  const src = displaySrc(item)
  const [loaded, setLoaded] = useState(() => isWarmed(src))
  useEffect(() => setLoaded(isWarmed(src)), [src])
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden p-2">
      <div className="relative max-h-full max-w-full">
        {/* Blurred stand-in underneath, so the full-res resolves *into* it
            instead of replacing a blank box. */}
        <img
          src={lowSrc(item)}
          alt=""
          aria-hidden
          draggable={false}
          className={`photo-placeholder ${loaded ? 'is-hidden' : ''}`}
        />
        <img
          src={src}
          alt={item.place}
          draggable={false}
          onLoad={() => {
            setLoaded(true)
            markWarmed(src)
          }}
          className={`photo-full relative block max-h-[86vh] max-w-full select-none ${
            loaded ? 'is-shown' : ''
          } ${onPick ? 'cursor-crosshair' : ''}`}
          onClick={(e) => {
            if (!onPick) return
            const rect = e.currentTarget.getBoundingClientRect()
            onPick({
              x: (e.clientX - rect.left) / rect.width,
              y: (e.clientY - rect.top) / rect.height,
            })
          }}
        />
        {markers
          .filter((m) => !isSphereLoc(m.loc))
          .map((m) => {
            const loc = m.loc as { x: number; y: number }
            return (
              <div
                key={m.id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${loc.x * 100}%`, top: `${loc.y * 100}%` }}
              >
                {m.kind === 'reticle' ? (
                  <div className="ar-reticle">
                    <i />
                  </div>
                ) : (
                  <div className="ar-truth" />
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
