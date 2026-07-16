import { asset, type MediaItem, type Spot } from '../data/panoramas'
import { countryName, formatDate, useLang } from '../i18n'
import { IconClose } from './icons'

interface LocationCardProps {
  spot: Spot
  active: MediaItem
  onChangeActive: (item: MediaItem) => void
  onView: (item: MediaItem) => void
  onClose: () => void
}

export function LocationCard(props: LocationCardProps) {
  const { spot, onClose } = props
  const { t } = useLang()
  const photos = spot.items.filter((i) => i.kind === 'photo')
  const panos = spot.items.filter((i) => i.kind === '360')
  const mixed = photos.length > 0 && panos.length > 0

  return (
    <div className="absolute bottom-8 left-1/2 z-10 w-[min(92%,26rem)] -translate-x-1/2">
      <div
        className="glass anim-rise relative rounded-3xl p-4"
        style={{ viewTransitionName: 'media-panel' } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          aria-label={t.closeCard}
          className="glass-chip absolute -top-3 -right-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full text-ink-muted hover:text-ink"
        >
          <IconClose className="h-4 w-4" />
        </button>
        {mixed ? (
          <MixedView {...props} photos={photos} panos={panos} />
        ) : (
          <SimpleView {...props} />
        )}
      </div>
    </div>
  )
}

/** Single-type spot: one big shot, a thumbnail strip, one action. */
function SimpleView({ spot, active, onChangeActive, onView }: LocationCardProps) {
  const { t, lang } = useLang()
  return (
    <>
      <button
        onClick={() => onView(active)}
        className="block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10"
        aria-label={active.kind === '360' ? t.enter : t.viewPhoto}
      >
        <img
          src={asset(active.thumb)}
          alt={active.place}
          loading="lazy"
          decoding="async"
          className="h-32 w-full object-cover"
        />
      </button>
      <Meta spot={spot} item={active} lang={lang} kindLabel={active.kind === '360' ? t.pano : t.photo} />
      {spot.items.length > 1 && (
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {spot.items.map((it) => (
            <ThumbButton
              key={it.id}
              item={it}
              lang={lang}
              selected={it.id === active.id}
              onClick={() => onChangeActive(it)}
            />
          ))}
        </div>
      )}
      <button onClick={() => onView(active)} className="btn-primary mt-3 w-full">
        {active.kind === '360' ? t.enter : t.viewPhoto}
      </button>
    </>
  )
}

/** Both types: a cover shot plus a photos row and a separate 360° row.
 *  Tapping any of them opens the viewer, which is where you arrow through
 *  the shots (photos first, then the 360s). */
function MixedView({
  spot,
  onView,
  photos,
  panos,
}: LocationCardProps & { photos: MediaItem[]; panos: MediaItem[] }) {
  const { t, lang } = useLang()
  const cover = photos[0]

  return (
    <>
      <button
        onClick={() => onView(cover)}
        className="block w-full cursor-pointer overflow-hidden rounded-xl border border-white/10"
        aria-label={t.viewPhoto}
      >
        <img
          src={asset(cover.thumb)}
          alt={cover.place}
          loading="lazy"
          decoding="async"
          className="h-40 w-full object-cover"
        />
      </button>

      <Meta spot={spot} item={cover} lang={lang} kindLabel={t.photo} />

      <ThumbRow label={t.photosRow}>
        {photos.map((it) => (
          <ThumbButton
            key={it.id}
            item={it}
            lang={lang}
            selected={false}
            onClick={() => onView(it)}
          />
        ))}
      </ThumbRow>

      <ThumbRow label={t.panosRow}>
        {panos.map((it) => (
          <ThumbButton
            key={it.id}
            item={it}
            lang={lang}
            selected={false}
            badge="360°"
            onClick={() => onView(it)}
          />
        ))}
      </ThumbRow>
    </>
  )
}

function Meta({
  spot,
  item,
  lang,
  kindLabel,
}: {
  spot: Spot
  item: MediaItem
  lang: 'es' | 'en'
  kindLabel: string
}) {
  return (
    <div className="mt-3 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-accent-soft uppercase">
          {kindLabel}
        </p>
        <h2 className="font-display truncate text-lg leading-snug font-medium">
          {spot.place}
        </h2>
      </div>
      <p className="shrink-0 text-sm text-ink-muted">
        {spot.country ? `${countryName(spot.country, lang)} · ` : ''}
        {formatDate(item.date, lang)}
      </p>
    </div>
  )
}

function ThumbRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <span className="w-9 shrink-0 font-mono text-[10px] tracking-wider text-ink-muted uppercase">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
        {children}
      </div>
    </div>
  )
}

function ThumbButton({
  item,
  lang,
  selected,
  badge,
  onClick,
}: {
  item: MediaItem
  lang: 'es' | 'en'
  selected: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${item.place} · ${formatDate(item.date, lang)}`}
      aria-pressed={selected}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-lg transition-opacity ${
        selected
          ? 'ring-2 ring-accent opacity-100'
          : 'opacity-55 hover:opacity-90'
      }`}
    >
      <img
        src={asset(item.micro)}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-10 w-16 object-cover"
      />
      {badge && (
        <span className="absolute right-0.5 bottom-0.5 rounded bg-black/60 px-1 font-mono text-[8px] leading-tight text-white/90">
          {badge}
        </span>
      )}
    </button>
  )
}
