import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Viewer } from '@photo-sphere-viewer/core'
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin'
import '@photo-sphere-viewer/core/index.css'
import { asset, formatCoords, type MediaItem } from '../data/panoramas'
import { countryName, formatDate, useLang } from '../i18n'
import { IconChevron, IconClose } from './icons'
import { RingLoader } from './RingField'

interface MediaModalProps {
  item: MediaItem
  /** the spot's shots — photos first, then 360s — for arrow navigation */
  items: MediaItem[]
  onNavigate: (item: MediaItem) => void
  onClose: () => void
}

function SphereViewer({ item }: { item: MediaItem }) {
  const ref = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    setLoaded(false)
    const viewer = new Viewer({
      container: ref.current,
      panorama: asset(item.src),
      // the gyroscope button only appears on devices with orientation sensors
      navbar: ['zoom', 'move', 'gyroscope', 'fullscreen'],
      plugins: [[GyroscopePlugin, { touchmove: true }]],
      touchmoveTwoFingers: false,
      // ← / → belong to the gallery, not to panning the sphere
      keyboard: false,
      defaultZoomLvl: 30,
    })
    viewer.addEventListener('ready', () => setLoaded(true), { once: true })
    return () => viewer.destroy()
  }, [item])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <div ref={ref} className="h-full w-full" />
      {!loaded && <RingLoader />}
    </div>
  )
}

export function MediaModal({ item, items, onNavigate, onClose }: MediaModalProps) {
  const { t, lang } = useLang()
  const idx = items.findIndex((i) => i.id === item.id)
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < items.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && idx > 0) onNavigate(items[idx - 1])
      else if (e.key === 'ArrowRight' && idx < items.length - 1)
        onNavigate(items[idx + 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, items, onNavigate, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.kind === '360' ? t.view360 : t.viewPhotoAria}: ${item.place}`}
    >
      <div
        className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      {/* full-bleed on phones (the viewer must be bigger than the card that
          opened it), floating panel from sm up */}
      <div
        className="glass anim-scale relative flex h-dvh w-full flex-col rounded-none p-3 sm:h-auto sm:w-[min(100%,72rem)] sm:rounded-3xl sm:p-4"
        style={{ viewTransitionName: 'media-panel' } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          aria-label={t.closeViewer}
          className="glass-chip absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20 grid h-10 w-10 cursor-pointer place-items-center rounded-full text-ink-muted hover:text-ink sm:-top-3 sm:-right-3"
        >
          <IconClose className="h-4 w-4" />
        </button>

        <div className="relative min-h-0 flex-1 sm:h-[min(76vh,46rem)] sm:flex-none">
          {item.kind === '360' ? (
            <SphereViewer item={item} />
          ) : (
            <img
              src={asset(item.src)}
              alt={item.place}
              decoding="async"
              className="h-full w-full rounded-2xl object-contain"
            />
          )}

          {/* lightbox navigation: photos, then 360s */}
          {items.length > 1 && (
            <>
              {hasPrev && (
                <button
                  onClick={() => onNavigate(items[idx - 1])}
                  aria-label={t.prevShot}
                  className="glass-chip absolute top-1/2 left-3 z-20 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink hover:text-ink"
                >
                  <IconChevron className="h-5 w-5 rotate-180" />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={() => onNavigate(items[idx + 1])}
                  aria-label={t.nextShot}
                  className="glass-chip absolute top-1/2 right-3 z-20 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink hover:text-ink"
                >
                  <IconChevron className="h-5 w-5" />
                </button>
              )}
              <span className="glass-chip absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[11px] text-ink-muted">
                {idx + 1} / {items.length}
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:pb-1">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg leading-snug font-medium">
              {item.place}
            </h2>
            <p className="text-xs text-ink-muted">
              {item.country ? `${countryName(item.country, lang)} · ` : ''}
              {formatDate(item.date, lang)}
            </p>
          </div>
          <span className="glass-chip ms-auto rounded-full px-4 py-1.5 font-mono text-xs text-ink-muted">
            {formatCoords(item.coords)}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
