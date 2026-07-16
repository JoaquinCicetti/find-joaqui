import { lazy, Suspense, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Header } from './components/Header'
import { GlobeMap } from './components/GlobeMap'
import { Starfield } from './components/Starfield'
import { RingField } from './components/RingField'
import {
  countryCount,
  media,
  placeCount,
  spots,
  type MediaItem,
  type Spot,
} from './data/panoramas'
import { playableItems } from './game/joaqui'
import { LangProvider, useLang } from './i18n'

// Photo Sphere Viewer pulls in three.js — only load it when a viewer is opened
const MediaModal = lazy(() =>
  import('./components/MediaModal').then((m) => ({ default: m.MediaModal })),
)
const GameOverlay = lazy(() =>
  import('./components/GameOverlay').then((m) => ({ default: m.GameOverlay })),
)
const CalibrationSuite = lazy(() =>
  import('./components/CalibrationSuite').then((m) => ({
    default: m.CalibrationSuite,
  })),
)

// admin mode to place Joaqui in every shot (see CalibrationSuite)
const isCalibrate =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('calibrate')

const supportsVT =
  typeof document !== 'undefined' && 'startViewTransition' in document

/** Run a state change inside a view transition so the location card
 *  morphs into the viewer (and back) in browsers that support it. */
function withTransition(fn: () => void) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (supportsVT && !reduced) {
    ;(
      document as Document & {
        startViewTransition: (cb: () => void) => void
      }
    ).startViewTransition(() => flushSync(fn))
  } else {
    fn()
  }
}

/** Bottom CTA bar: description + Play + record. Slides away when a card is
 *  open above so the two never fight for attention. */
function GameFooter({
  onPlay,
  hidden,
}: {
  onPlay?: () => void
  hidden: boolean
}) {
  const { t } = useLang()
  const best = Number(localStorage.getItem('joaqui-best') ?? 0)
  return (
    <div
      className={`pointer-events-none absolute right-0 bottom-0 left-0 z-10 flex justify-center transition-[transform,opacity] duration-500 ease-out sm:p-6 ${
        hidden ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* translucent edge-to-edge bar on phones, floating card from sm up */}
      <div className="glass anim-rise pointer-events-auto flex w-full items-center gap-4 border-x-0 border-b-0 pt-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:w-auto sm:max-w-2xl sm:rounded-2xl sm:border sm:px-6 sm:py-4">
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-sm leading-relaxed text-ink-muted">
            {t.sub(media.length, placeCount, countryCount)}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted/70">{t.footer}</p>
        </div>
        {onPlay && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 sm:flex-none">
            {best > 0 && (
              <span className="glass-chip rounded-full px-3.5 py-1.5 font-mono text-[11px] text-ink-muted">
                {t.g.best(best)}
              </span>
            )}
            <button onClick={onPlay} className="btn-primary">
              {t.g.cta}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Page() {
  const [selected, setSelected] = useState<Spot | null>(null)
  const [active, setActive] = useState<MediaItem | null>(null)
  const [viewing, setViewing] = useState<MediaItem | null>(null)
  const [gameOpen, setGameOpen] = useState(false)
  const playable = playableItems().length
  // any surface shown above the globe hides the footer so they don't collide
  const anyCardShown = Boolean(selected || viewing || gameOpen)

  useEffect(() => {
    document.documentElement.classList.toggle('vt', supportsVT)
  }, [])

  // alert first-time visitors about the game (once, and only if it has content)
  useEffect(() => {
    if (!playable || localStorage.getItem('joaqui-intro-seen')) return
    const id = setTimeout(() => setGameOpen(true), 2200)
    return () => clearTimeout(id)
  }, [playable])

  const closeGame = () => {
    localStorage.setItem('joaqui-intro-seen', '1')
    setGameOpen(false)
  }

  const selectSpot = (spot: Spot | null) => {
    setSelected(spot)
    setActive(spot ? spot.items[spot.items.length - 1] : null)
  }

  const openViewer = (item: MediaItem) =>
    withTransition(() => {
      setViewing(item)
      setSelected(null) // the card hands its snapshot to the viewer
    })

  const closeViewer = () => {
    const item = viewing
    withTransition(() => {
      setViewing(null)
      if (item) {
        // …and the viewer morphs back into the card, on the same shot
        setSelected(spots.find((s) => s.items.includes(item)) ?? null)
        setActive(item)
      }
    })
  }

  return (
    <div className="relative h-full overflow-hidden">
      <Starfield />
      <RingField />
      <GlobeMap
        selected={selected}
        active={active}
        onSelect={selectSpot}
        onChangeActive={setActive}
        onView={openViewer}
      />
      {/* cinematic vignette over the globe edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(4, 6, 10, 0.5) 100%)',
        }}
      />
      {/* film grain over everything, incl. the glass panels */}
      <div
        aria-hidden
        className="grain pointer-events-none absolute inset-0 z-[6]"
      />
      <Header />
      <GameFooter
        onPlay={playable ? () => setGameOpen(true) : undefined}
        hidden={anyCardShown}
      />
      {viewing && (
        <Suspense fallback={null}>
          <MediaModal item={viewing} onClose={closeViewer} />
        </Suspense>
      )}
      {gameOpen && (
        <Suspense fallback={null}>
          <GameOverlay onClose={closeGame} />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  return (
    <LangProvider>
      {isCalibrate ? (
        <Suspense fallback={null}>
          <CalibrationSuite />
        </Suspense>
      ) : (
        <Page />
      )}
    </LangProvider>
  )
}
