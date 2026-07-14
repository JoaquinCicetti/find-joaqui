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
  const best = Number(localStorage.getItem('joaqui-best') ?? 0)
  return (
    <header className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex items-start justify-between gap-4 sm:p-6">
      {/* translucent edge-to-edge bar on phones, floating card from sm up */}
      <div className="glass anim-rise pointer-events-auto w-full border-x-0 border-t-0 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] sm:w-auto sm:max-w-md sm:rounded-2xl sm:border sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl leading-tight font-medium sm:text-4xl">
            {t.taglineA}{' '}
            <em className="text-accent-soft italic">{t.taglineB}</em>
          </h1>
          <div className="mt-1.5">
            <LangToggle />
          </div>
        </div>
        <p className="mt-2 hidden text-sm leading-relaxed text-ink-muted sm:block">
          {t.sub(media.length, placeCount, countryCount)}
        </p>
        {onPlay && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-4">
            <button onClick={onPlay} className="btn-primary">
              {t.g.cta}
            </button>
            {best > 0 && (
              <span className="glass-chip rounded-full px-3.5 py-1.5 font-mono text-[11px] text-ink-muted">
                {t.g.best(best)}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
