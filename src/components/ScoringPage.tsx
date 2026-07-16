import { useEffect, useState } from 'react'
import { fetchTop, formatSeconds, type ScoreEntry } from '../game/api'
import { Starfield } from './Starfield'
import { useLang } from '../i18n'

/** Standalone /scoring page: the full leaderboard — name, time, points. */
export function ScoringPage() {
  const { t } = useLang()
  const g = t.g
  const [top, setTop] = useState<ScoreEntry[] | null>(null)
  const me = localStorage.getItem('joaqui-name')

  useEffect(() => {
    fetchTop().then(({ top }) => setTop(top))
  }, [])

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Starfield />
      <div className="relative grid min-h-dvh place-items-center overflow-y-auto p-4">
        <div className="glass anim-scale my-auto w-[min(100%,28rem)] rounded-3xl p-7">
          <h1 className="font-display text-center text-3xl font-medium">
            {g.board}
          </h1>

          {top === null ? (
            <p className="mt-6 text-center text-sm text-ink-muted">…</p>
          ) : top.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-muted">
              {g.scEmpty}
            </p>
          ) : (
            <ol className="mt-6 flex flex-col divide-y divide-white/5">
              <li
                aria-hidden
                className="flex items-baseline gap-3 pb-2 text-[10px] tracking-widest text-ink-muted uppercase"
              >
                <span className="w-5" />
                <span className="min-w-0 flex-1">{g.scName}</span>
                <span className="w-12 text-right">{g.scTime}</span>
                <span className="w-14 text-right">{g.scPts}</span>
              </li>
              {top.map((e, n) => (
                <li
                  key={`${e.name}-${n}`}
                  className="flex items-baseline gap-3 py-2 text-sm"
                >
                  <span className="w-5 font-mono text-xs text-ink-muted">
                    {n + 1}.
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      e.name === me ? 'text-accent-soft' : ''
                    }`}
                  >
                    {e.name}
                  </span>
                  <span className="w-12 text-right font-mono text-xs text-ink-muted">
                    {e.time != null ? formatSeconds(e.time) : '—'}
                  </span>
                  <span className="w-14 text-right font-mono text-sm text-accent-soft">
                    {e.score}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-7 flex justify-center">
            <a href="/" className="btn-primary px-7">
              {g.scBack}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
