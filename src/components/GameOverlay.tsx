import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MediaItem } from '../data/panoramas'
import {
  allLocations,
  pickRounds,
  playableItems,
  scoreGuess,
  type GuessResult,
  type JoaquiLocation,
} from '../game/joaqui'
import { fetchTop, submitScore, type ScoreEntry } from '../game/api'
import { useLang } from '../i18n'
import { PhotoStage, SphereStage, type StageMarker } from './JoaquiStage'

type Phase = 'intro' | 'guess' | 'reveal' | 'done'

export function GameOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLang()
  const g = t.g
  const locs = useMemo(() => allLocations(), [])
  const playable = useMemo(() => playableItems().length, [])

  const [phase, setPhase] = useState<Phase>('intro')
  const [rounds, setRounds] = useState<MediaItem[]>([])
  const [i, setI] = useState(0)
  const [guess, setGuess] = useState<JoaquiLocation | null>(null)
  const [scores, setScores] = useState<number[]>([])
  const [result, setResult] = useState<GuessResult | null>(null)

  const item = rounds[i]
  const total = scores.reduce((s, n) => s + n, 0)

  const start = () => {
    setRounds(pickRounds())
    setI(0)
    setScores([])
    setGuess(null)
    setResult(null)
    setPhase('guess')
  }

  const confirm = () => {
    if (!guess || !item) return
    const truth = locs[item.id]
    const r = scoreGuess(guess, truth)
    setScores((s) => [...s, r.points])
    setResult(r)
    setPhase('reveal')
  }

  const next = () => {
    if (i + 1 < rounds.length) {
      setI(i + 1)
      setGuess(null)
      setResult(null)
      setPhase('guess')
    } else {
      setPhase('done')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const markers: StageMarker[] = []
  if (guess) markers.push({ id: 'guess', kind: 'reticle', loc: guess })
  if (phase === 'reveal' && item && locs[item.id])
    markers.push({ id: 'truth', kind: 'truth', loc: locs[item.id] })

  return createPortal(
    <div
      className={`fixed inset-0 z-50 ${
        phase === 'intro' || phase === 'done'
          ? 'bg-black/60 backdrop-blur-md'
          : 'bg-paper'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={g.introTitle}
    >
      {phase === 'intro' && (
        <IntroPanel playable={playable} onStart={start} onClose={onClose} />
      )}

      {(phase === 'guess' || phase === 'reveal') && item && (
        <div className="absolute inset-0">
          {item.kind === '360' ? (
            <SphereStage
              item={item}
              markers={markers}
              onPick={phase === 'guess' ? setGuess : undefined}
              navbar={false}
            />
          ) : (
            <PhotoStage
              item={item}
              markers={markers}
              onPick={phase === 'guess' ? setGuess : undefined}
            />
          )}

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            <span className="glass-chip rounded-full px-4 py-1.5 font-mono text-xs">
              {g.round(i + 1, rounds.length)} · {item.place}
            </span>
            <div className="flex items-center gap-2">
              <span className="glass-chip rounded-full px-4 py-1.5 font-mono text-xs text-accent-soft">
                {total} pts
              </span>
              <button
                onClick={onClose}
                aria-label={g.close}
                className="glass-chip pointer-events-auto grid h-8 w-8 cursor-pointer place-items-center rounded-full text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-5">
            {phase === 'guess' && (
              <>
                <span className="glass-chip anim-fade rounded-full px-4 py-2 text-sm text-ink-muted">
                  {guess ? g.adjustHint : g.tapHint}
                </span>
                {guess && (
                  <button
                    onClick={confirm}
                    className="btn-accent anim-rise pointer-events-auto cursor-pointer rounded-full px-8 py-3 text-sm font-semibold shadow-lg"
                  >
                    {g.confirm}
                  </button>
                )}
              </>
            )}
            {phase === 'reveal' && result && (
              <div className="glass anim-rise pointer-events-auto flex flex-col items-center gap-2 rounded-2xl px-8 py-5 text-center">
                <p className="font-display text-2xl font-medium text-accent-soft">
                  {g.points(result.points)}
                </p>
                <p className="text-sm text-ink-muted">
                  {result.points === 1000
                    ? g.found
                    : result.kind === '360'
                      ? g.away360(result.deg.toFixed(0))
                      : g.awayPhoto(result.pct.toFixed(0))}
                </p>
                <button
                  onClick={next}
                  className="btn-accent mt-1 cursor-pointer rounded-full px-8 py-2.5 text-sm font-semibold"
                >
                  {g.next} →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <DonePanel total={total} onAgain={start} onClose={onClose} />
      )}
    </div>,
    document.body,
  )
}

function IntroPanel({
  playable,
  onStart,
  onClose,
}: {
  playable: number
  onStart: () => void
  onClose: () => void
}) {
  const { t } = useLang()
  const g = t.g
  return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <div className="glass anim-scale w-[min(100%,26rem)] rounded-3xl p-7 text-center">
        <p className="text-4xl">🔍</p>
        <h2 className="font-display mt-2 text-3xl font-medium">
          {g.introTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          {g.introBody(playable)}
        </p>
        <ol className="mx-auto mt-5 flex max-w-xs flex-col gap-2 text-left text-sm text-ink-muted">
          {[g.how1, g.how2, g.how3].map((how, n) => (
            <li key={n} className="flex items-start gap-3">
              <span className="glass-chip grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[10px] text-accent-soft">
                {n + 1}
              </span>
              {how}
            </li>
          ))}
        </ol>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="glass-chip cursor-pointer rounded-full px-6 py-2.5 text-sm text-ink-muted hover:text-ink"
          >
            {g.later}
          </button>
          <button
            onClick={onStart}
            className="btn-accent cursor-pointer rounded-full px-8 py-2.5 text-sm font-semibold"
          >
            {g.start} →
          </button>
        </div>
      </div>
    </div>
  )
}

function DonePanel({
  total,
  onAgain,
  onClose,
}: {
  total: number
  onAgain: () => void
  onClose: () => void
}) {
  const { t } = useLang()
  const g = t.g
  const [name, setName] = useState(
    () => localStorage.getItem('joaqui-name') ?? '',
  )
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'local'>(
    'idle',
  )
  const [top, setTop] = useState<ScoreEntry[]>([])

  useEffect(() => {
    fetchTop().then(({ top }) => setTop(top))
  }, [])

  const save = async () => {
    const clean = name.trim().slice(0, 24)
    if (!clean || state === 'saving') return
    localStorage.setItem('joaqui-name', clean)
    setState('saving')
    const { top, remote } = await submitScore(clean, total)
    setTop(top)
    setState(remote ? 'saved' : 'local')
  }

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <div className="glass anim-scale w-[min(100%,26rem)] rounded-3xl p-7">
        <h2 className="font-display text-center text-2xl font-medium">
          {g.results}
        </h2>
        <p className="mt-1 text-center text-xs tracking-widest text-ink-muted uppercase">
          {g.total}
        </p>
        <p className="font-display mt-1 text-center text-5xl font-medium text-accent-soft">
          {total}
        </p>

        {state === 'idle' || state === 'saving' ? (
          <div className="mt-6 flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder={g.namePh}
              maxLength={24}
              className="glass-chip w-full rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-accent-soft"
            />
            <button
              onClick={save}
              disabled={!name.trim() || state === 'saving'}
              className="btn-accent shrink-0 cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-default disabled:opacity-40"
            >
              {state === 'saving' ? g.saving : g.save}
            </button>
          </div>
        ) : (
          state === 'local' && (
            <p className="mt-4 text-center text-xs text-ink-muted">
              {g.savedLocal}
            </p>
          )
        )}

        {top.length > 0 && (
          <div className="mt-6">
            <p className="text-xs tracking-widest text-ink-muted uppercase">
              {g.board}
            </p>
            <ol className="mt-2 flex flex-col gap-1">
              {top.slice(0, 10).map((e, n) => (
                <li
                  key={`${e.name}-${n}`}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="truncate">
                    <span className="font-mono text-xs text-ink-muted">
                      {n + 1}.{' '}
                    </span>
                    {e.name}
                  </span>
                  <span className="font-mono text-xs text-accent-soft">
                    {e.score}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="glass-chip cursor-pointer rounded-full px-6 py-2.5 text-sm text-ink-muted hover:text-ink"
          >
            {g.close}
          </button>
          <button
            onClick={onAgain}
            className="btn-accent cursor-pointer rounded-full px-7 py-2.5 text-sm font-semibold"
          >
            {g.again}
          </button>
        </div>
      </div>
    </div>
  )
}
