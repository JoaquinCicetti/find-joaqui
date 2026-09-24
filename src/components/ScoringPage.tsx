import { useEffect, useState } from 'react'
import { fetchTop, type ScoreEntry } from '../game/api'
import { Starfield } from './Starfield'
import { LeaderRow, LeaderSkeleton } from './LeaderRow'
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
            // Skeleton rather than a spinner: the list keeps its shape, so
            // nothing jumps when the real rows arrive.
            <LeaderSkeleton
              rows={6}
              withTime
              className="mt-6 divide-y divide-white/5 [&>li]:py-2"
            />
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
                <span className="w-7" />
                <span className="min-w-0 flex-1">{g.scName}</span>
                <span className="w-12 text-right">{g.scTime}</span>
                <span className="w-14 text-right">{g.scPts}</span>
              </li>
              {top.map((e, n) => (
                <LeaderRow
                  key={`${e.name}-${n}`}
                  entry={e}
                  rank={n + 1}
                  me={me}
                  withTime
                  className="py-2"
                />
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
