import { asset, type MediaItem, type Spot } from '../data/panoramas'
import { countryName, formatDate, useLang } from '../i18n'

interface LocationCardProps {
  spot: Spot
  active: MediaItem
  onChangeActive: (item: MediaItem) => void
  onView: () => void
  onClose: () => void
}

export function LocationCard({
  spot,
  active,
  onChangeActive,
  onView,
  onClose,
}: LocationCardProps) {
  const { t, lang } = useLang()
  return (
    <div className="absolute bottom-8 left-1/2 z-10 w-[min(92%,26rem)] -translate-x-1/2">
      <div
        key={spot.id}
        className="glass anim-rise relative rounded-3xl p-4"
        style={{ viewTransitionName: 'media-panel' } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          aria-label={t.closeCard}
          className="glass-chip absolute -top-3 -right-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full text-sm text-ink-muted hover:text-ink"
        >
          ✕
        </button>
        <img
          src={asset(active.thumb)}
          alt={active.place}
          loading="lazy"
          decoding="async"
          className="h-32 w-full rounded-xl border border-white/10 object-cover"
        />
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-accent-soft uppercase">
              {active.kind === '360' ? t.pano : t.photo}
            </p>
            <h2 className="font-display truncate text-lg leading-snug font-medium">
              {spot.place}
            </h2>
          </div>
          <p className="shrink-0 text-sm text-ink-muted">
            {spot.country ? `${countryName(spot.country, lang)} · ` : ''}
            {formatDate(active.date, lang)}
          </p>
        </div>
        {spot.items.length > 1 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {spot.items.map((it) => (
              <button
                key={it.id}
                onClick={() => onChangeActive(it)}
                aria-label={`${spot.place} · ${formatDate(it.date, lang)}`}
                aria-pressed={it.id === active.id}
                className={`shrink-0 cursor-pointer overflow-hidden rounded-lg transition-opacity ${
                  it.id === active.id
                    ? 'ring-2 ring-accent opacity-100'
                    : 'opacity-55 hover:opacity-90'
                }`}
              >
                <img
                  src={asset(it.micro)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-16 object-cover"
                />
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onView}
          className="btn-accent mt-3 w-full cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          {active.kind === '360' ? t.enter : t.viewPhoto}
        </button>
      </div>
    </div>
  )
}
