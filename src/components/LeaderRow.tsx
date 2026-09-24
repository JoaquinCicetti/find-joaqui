import { formatSeconds, type ScoreEntry } from '../game/api'
import { PlayerAvatar } from './PlayerAvatar'

/**
 * One leaderboard row — rank, bot avatar, name, (time), score. Shared by the
 * intro and results panels and by /scoring so the three lists read as one.
 */
export function LeaderRow({
  entry,
  rank,
  me,
  withTime = false,
  celebrate = false,
  className = '',
}: {
  entry: ScoreEntry
  rank: number
  /** the visitor's own name — their row is tinted */
  me?: string | null
  withTime?: boolean
  /** the row's bot hops for a bit (a just-saved score) */
  celebrate?: boolean
  className?: string
}) {
  const mine = Boolean(me) && entry.name === me
  return (
    <li className={`flex items-center gap-3 text-sm ${className}`}>
      <span className="w-5 shrink-0 font-mono text-xs text-ink-muted">
        {rank}.
      </span>
      <PlayerAvatar name={entry.name} state={celebrate ? 'working' : 'default'} />
      <span className={`min-w-0 flex-1 truncate ${mine ? 'text-accent-soft' : ''}`}>
        {entry.name}
      </span>
      {withTime && (
        <span className="w-12 shrink-0 text-right font-mono text-xs text-ink-muted">
          {entry.time != null ? formatSeconds(entry.time) : '—'}
        </span>
      )}
      <span className="w-14 shrink-0 text-right font-mono text-xs text-accent-soft">
        {entry.score}
      </span>
    </li>
  )
}

/** Placeholder rows: keeps the panel's height stable so nothing below it
 *  jumps when the scores land. Mirrors LeaderRow's slots. */
export function LeaderSkeleton({
  rows,
  withTime = false,
  className = '',
}: {
  rows: number
  withTime?: boolean
  className?: string
}) {
  return (
    <ol aria-hidden className={`flex flex-col ${className}`}>
      {Array.from({ length: rows }, (_, n) => (
        <li key={n} className="flex items-center gap-3 py-[3px]">
          <span className="skeleton h-3 w-5 rounded-full" />
          <span className="skeleton h-7 w-7 shrink-0 rounded-full" />
          <span
            className="skeleton h-3 flex-1 rounded-full"
            style={{ maxWidth: `${7 - (n % 3) * 1.25}rem` }}
          />
          {withTime && <span className="skeleton h-3 w-12 rounded-full" />}
          <span className="skeleton h-3 w-14 rounded-full" />
        </li>
      ))}
    </ol>
  )
}
