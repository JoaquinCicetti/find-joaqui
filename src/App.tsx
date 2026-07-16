import { lazy, Suspense, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Header } from './components/Header'
import { IconArrow } from './components/icons'
import { GlobeMap } from './components/GlobeMap'
import { ScoringPage } from './components/ScoringPage'
import { Starfield } from './components/Starfield'
import { RingField } from './components/RingField'
import { media, spots, type MediaItem, type Spot } from './data/panoramas'
import { playableItems, playableStats } from './game/joaqui'
import { onIdle, prefetchImage } from './lib/prefetch'
import { LangProvider, useLang } from './i18n'

// Photo Sphere Viewer pulls in three.js — only load it when a viewer is opened.
// The import factories are named so we can warm the chunk *before* the click
// (on idle / on button press) and have the surface open instantly.
const importMediaModal = () =>
  import('./components/MediaModal').then((m) => ({ default: m.MediaModal }))
const importGameOverlay = () =>
  import('./components/GameOverlay').then((m) => ({ default: m.GameOverlay }))
const MediaModal = lazy(importMediaModal)
const GameOverlay = lazy(importGameOverlay)
const CalibrationSuite = lazy(() =>
  import('./components/CalibrationSuite').then((m) => ({
    default: m.CalibrationSuite,
  })),
)

// admin mode to place Joaqui in every shot (see CalibrationSuite)
const isCalibrate =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('calibrate')

// standalone leaderboard page (vercel.json rewrites /scoring to the SPA)
const isScoring =
  typeof window !== 'undefined' && window.location.pathname === '/scoring'

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

// ---- Deep-linkable selection: ?spot=<id> opens a place card,
//      ?view=<mediaId> opens a shot in the viewer. The address bar stays in
//      sync so any view is shareable, and back/forward restores it. ----
type Selection = { spot?: string; view?: string }

function readUrlSelection(): Selection {
  const p = new URLSearchParams(window.location.search)
  return { spot: p.get('spot') ?? undefined, view: p.get('view') ?? undefined }
}

function urlFor(sel: Selection): string {
  const p = new URLSearchParams(window.location.search)
  p.delete('spot')
  p.delete('view')
  if (sel.view) p.set('view', sel.view)
  else if (sel.spot) p.set('spot', sel.spot)
  const q = p.toString()
  return `${window.location.pathname}${q ? `?${q}` : ''}`
}

function writeUrl(sel: Selection, push: boolean) {
  const url = urlFor(sel)
  if (url === `${window.location.pathname}${window.location.search}`) return
  if (push) window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

/** Resolve the current URL to the state it represents (used on load and on
 *  browser back/forward). A ?view wins over ?spot. */
function resolveSelection(sel: Selection): {
  selected: Spot | null
  active: MediaItem | null
  viewing: MediaItem | null
} {
  if (sel.view) {
    const item = media.find((m) => m.id === sel.view)
    if (item) return { selected: null, active: item, viewing: item }
  }
  if (sel.spot) {
    const spot = spots.find((s) => s.id === sel.spot)
    if (spot)
      return {
        selected: spot,
        active: spot.items[spot.items.length - 1],
        viewing: null,
      }
  }
  return { selected: null, active: null, viewing: null }
}

/** Floating bottom CTA bar: a line about the game + Play + record.
 *  Slides away when a card is open above so the two never fight for
 *  attention. Text stays visible on phones. */
function GameFooter({
  onPlay,
  hidden,
}: {
  onPlay?: () => void
  hidden: boolean
}) {
  const { t } = useLang()
  const best = Number(localStorage.getItem('joaqui-best') ?? 0)
  // count the shots Joaqui is actually hidden in — not the whole library
  const stats = playableStats()
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pt-3 pb-[calc(2.5rem+env(safe-area-inset-bottom))] transition-[transform,opacity] duration-500 ease-out sm:px-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] ${
        hidden ? 'pointer-events-none translate-y-[130%] opacity-0' : 'opacity-100'
      }`}
    >
      <div className="glass anim-rise pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-muted sm:text-sm">
          {t.sub(stats.count, stats.places, stats.countries)}
        </p>
        {onPlay && (
          <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
            {best > 0 && (
              <span className="font-mono text-[11px] tracking-wide text-ink-muted">
                {t.g.best(best)}
              </span>
            )}
            <button
              onClick={onPlay}
              onPointerDown={() => importGameOverlay()}
              onMouseEnter={() => importGameOverlay()}
              className="btn-primary"
            >
              {t.g.cta}
              <IconArrow className="btn-arrow h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Page() {
  const [selected, setSelected] = useState<Spot | null>(
    () => resolveSelection(readUrlSelection()).selected,
  )
  const [active, setActive] = useState<MediaItem | null>(
    () => resolveSelection(readUrlSelection()).active,
  )
  const [viewing, setViewing] = useState<MediaItem | null>(
    () => resolveSelection(readUrlSelection()).viewing,
  )
  const [gameOpen, setGameOpen] = useState(false)
  const playable = playableItems().length
  // any surface shown above the globe hides the footer so they don't collide
  const anyCardShown = Boolean(selected || viewing || gameOpen)

  useEffect(() => {
    document.documentElement.classList.toggle('vt', supportsVT)
  }, [])

  // Warm the heavy viewer/game chunks (Photo Sphere Viewer + three.js) once the
  // page is idle, so the first Play / open-viewer feels instant instead of
  // waiting on a fresh download.
  useEffect(() => {
    onIdle(() => {
      importMediaModal()
      if (playable) importGameOverlay()
    })
  }, [playable])

  // keep state in sync with the URL on browser back/forward (and manual edits)
  useEffect(() => {
    const onPop = () => {
      const next = resolveSelection(readUrlSelection())
      setViewing(next.viewing)
      setSelected(next.selected)
      setActive(next.active)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const closeGame = () => setGameOpen(false)

  const selectSpot = (spot: Spot | null) => {
    setSelected(spot)
    setActive(spot ? spot.items[spot.items.length - 1] : null)
    writeUrl(spot ? { spot: spot.id } : {}, Boolean(spot))
    // While the card is open, warm the viewer chunk and this spot's full-res
    // shots so tapping through to the viewer opens without a load wait.
    if (spot) {
      importMediaModal()
      prefetchImage(spot.items[spot.items.length - 1].src)
      onIdle(() => spot.items.forEach((it) => prefetchImage(it.src)))
    }
  }

  const openViewer = (item: MediaItem) => {
    withTransition(() => {
      setViewing(item)
      setSelected(null) // the card hands its snapshot to the viewer
    })
    writeUrl({ view: item.id }, true)
  }

  // arrow navigation inside the viewer — swap the shot, no history spam
  const navigateViewer = (item: MediaItem) => {
    setViewing(item)
    setActive(item)
    writeUrl({ view: item.id }, false)
  }

  // the shots the viewer can arrow through: this spot's photos, then its 360s
  const viewerItems = (() => {
    if (!viewing) return []
    const spot = spots.find((s) => s.items.some((i) => i.id === viewing.id))
    if (!spot) return [viewing]
    return [
      ...spot.items.filter((i) => i.kind === 'photo'),
      ...spot.items.filter((i) => i.kind === '360'),
    ]
  })()

  const closeViewer = () => {
    const item = viewing
    const spot = item
      ? (spots.find((s) => s.items.includes(item)) ?? null)
      : null
    withTransition(() => {
      setViewing(null)
      if (item) {
        // …and the viewer morphs back into the card, on the same shot
        setSelected(spot)
        setActive(item)
      }
    })
    writeUrl(spot ? { spot: spot.id } : {}, false)
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
          <MediaModal
            item={viewing}
            items={viewerItems}
            onNavigate={navigateViewer}
            onClose={closeViewer}
          />
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
      ) : isScoring ? (
        <ScoringPage />
      ) : (
        <Page />
      )}
    </LangProvider>
  )
}
