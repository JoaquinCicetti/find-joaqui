import { lazy, Suspense, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Header } from './components/Header'
import { GlobeMap } from './components/GlobeMap'
import { Starfield } from './components/Starfield'
import { RingField } from './components/RingField'
import { spots, type MediaItem, type Spot } from './data/panoramas'
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

function Footer() {
  const { t } = useLang()
  return (
    <footer className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] text-ink-muted sm:left-6">
      {t.footer}
    </footer>
  )
}

function Page() {
  const [selected, setSelected] = useState<Spot | null>(null)
  const [active, setActive] = useState<MediaItem | null>(null)
  const [viewing, setViewing] = useState<MediaItem | null>(null)
  const [gameOpen, setGameOpen] = useState(false)
  const playable = playableItems().length

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
      <Header onPlay={playable ? () => setGameOpen(true) : undefined} />
      <Footer />
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
