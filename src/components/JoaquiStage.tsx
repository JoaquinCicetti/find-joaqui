import { useEffect, useRef, useState } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin'
import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/markers-plugin/index.css'
import { asset, type MediaItem } from '../data/panoramas'
import { isSphereLoc, type JoaquiLocation } from '../game/joaqui'

/** A marker drawn on a stage: the player's reticle or Joaqui's real spot. */
export interface StageMarker {
  id: string
  kind: 'reticle' | 'truth'
  loc: JoaquiLocation
}

const MARKER_HTML: Record<StageMarker['kind'], string> = {
  reticle: '<div class="ar-reticle"><i></i></div>',
  truth: '<div class="ar-truth">🙋</div>',
}

interface SphereStageProps {
  item: MediaItem
  markers: StageMarker[]
  onPick?: (loc: JoaquiLocation) => void
  navbar?: boolean
  /** when set, the camera glides to this view (e.g. the reveal) */
  focus?: { yaw: number; pitch: number } | null
}

/** 360° pano that reports clicked view angles and renders AR markers. */
export function SphereStage({
  item,
  markers,
  onPick,
  navbar = true,
  focus = null,
}: SphereStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const [ready, setReady] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    const viewer = new Viewer({
      container: ref.current,
      panorama: asset(item.src),
      navbar: navbar ? ['zoom', 'move', 'fullscreen'] : false,
      plugins: [MarkersPlugin],
      touchmoveTwoFingers: false,
      defaultZoomLvl: 30,
    })
    viewer.addEventListener('click', ({ data }) => {
      if (!data.rightclick) onPickRef.current?.({ yaw: data.yaw, pitch: data.pitch })
    })
    viewer.addEventListener('ready', () => setReady((r) => r + 1), {
      once: true,
    })
    viewerRef.current = viewer
    return () => {
      viewer.destroy()
      viewerRef.current = null
    }
  }, [item, navbar])

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
              size: { width: 64, height: 64 },
              anchor: 'center center',
            }
          }),
      )
    } catch {
      // viewer being torn down mid-update — safe to ignore
    }
  }, [markers, ready])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !ready || !focus) return
    viewer.animate({ yaw: focus.yaw, pitch: focus.pitch, speed: '4rpm' })
  }, [focus, ready])

  return <div ref={ref} className="h-full w-full" />
}

interface PhotoStageProps {
  item: MediaItem
  markers: StageMarker[]
  onPick?: (loc: JoaquiLocation) => void
}

/** Flat photo that reports normalized click coords and renders AR markers. */
export function PhotoStage({ item, markers, onPick }: PhotoStageProps) {
  return (
    <div className="grid h-full w-full place-items-center overflow-hidden p-2">
      <div className="relative max-h-full max-w-full">
        <img
          src={asset(item.src)}
          alt={item.place}
          draggable={false}
          className={`block max-h-[86vh] max-w-full select-none ${
            onPick ? 'cursor-crosshair' : ''
          }`}
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
                  <div className="ar-truth">🙋</div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
