import { countryCount, media, placeCount } from '../data/panoramas'
import { useLang, type Lang } from '../i18n'

function LangToggle() {
  const { lang, setLang } = useLang()
  const opt = (l: Lang) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`cursor-pointer transition-colors ${
        lang === l ? 'text-ink' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {l.toUpperCase()}
    </button>
  )
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider">
      {opt('es')}
      <span className="text-ink-muted/50">·</span>
      {opt('en')}
    </div>
  )
}

export function Header({ onPlay }: { onPlay?: () => void }) {
  const { t } = useLang()
  return (
    <header className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex items-start justify-between gap-4 p-4 sm:p-6">
      <div className="glass anim-rise pointer-events-auto max-w-md rounded-2xl px-6 py-5">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-accent-soft uppercase">
            Joaquín Cicetti
          </p>
          <span aria-hidden className="h-px flex-1 bg-white/15" />
          <LangToggle />
        </div>
        <h1 className="font-display mt-2 text-3xl leading-tight font-medium sm:text-4xl">
          {t.taglineA}{' '}
          <em className="text-accent-soft italic">{t.taglineB}</em>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t.sub(media.length, placeCount, countryCount)}
        </p>
        {onPlay && (
          <button
            onClick={onPlay}
            className="btn-accent mt-4 cursor-pointer rounded-full px-5 py-2 text-sm font-semibold"
          >
            🔍 {t.g.cta}
          </button>
        )}
      </div>
    </header>
  )
}
