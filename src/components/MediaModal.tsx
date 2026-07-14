import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Viewer } from '@photo-sphere-viewer/core'
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin'
import '@photo-sphere-viewer/core/index.css'
import { asset, formatCoords, type MediaItem } from '../data/panoramas'
import { countryName, formatDate, useLang } from '../i18n'

interface MediaModalProps {
  item: MediaItem
  onClose: () => void
}

function SphereViewer({ item }: { item: MediaItem }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const viewer = new Viewer({
      container: ref.current,
      panorama: asset(item.src),
      // the gyroscope button only appears on devices with orientation sensors
      navbar: ['zoom', 'move', 'gyroscope', 'fullscreen'],
      plugins: [[GyroscopePlugin, { touchmove: true }]],
      touchmoveTwoFingers: false,
      defaultZoomLvl: 30,
    })
    return () => viewer.destroy()
  }, [item])

  return (
    <div
      ref={ref}
      className="h-[min(76vh,46rem)] w-full overflow-hidden rounded-2xl"
    />
  )
}

export function MediaModal({ item, onClose }: MediaModalProps) {
  const { t, lang } = useLang()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.kind === '360' ? t.view360 : t.viewPhotoAria}: ${item.place}`}
    >
      <div
        className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className="glass anim-scale relative w-[min(100%,72rem)] rounded-3xl p-3 sm:p-4"
        style={{ viewTransitionName: 'media-panel' } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          aria-label={t.closeViewer}
          className="glass-chip absolute -top-3 -right-3 z-10 grid h-10 w-10 cursor-pointer place-items-center rounded-full text-ink-muted hover:text-ink"
        >
          ✕
        </button>
        {item.kind === '360' ? (
          <SphereViewer item={item} />
        ) : (
          <img
            src={asset(item.src)}
            alt={item.place}
            loading="lazy"
            decoding="async"
            className="max-h-[76vh] w-full rounded-2xl object-contain"
          />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-3 pb-1">
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
