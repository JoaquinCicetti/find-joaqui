import { useEffect, useMemo, useState } from 'react'
import { media } from '../data/panoramas'
import {
  allLocations,
  isSphereLoc,
  loadDrafts,
  saveDrafts,
  type JoaquiLocation,
} from '../game/joaqui'
import { PhotoStage, SphereStage, type StageMarker } from './JoaquiStage'

/**
 * Admin tool (open with ?calibrate): step through every shot, click where
 * Joaqui hides, and export the result as joaqui-locations.json.
 * Placements are drafts in localStorage until the JSON is committed.
 */
export function CalibrationSuite() {
  const [i, setI] = useState(0)
  const [locs, setLocs] = useState<Record<string, JoaquiLocation>>(() =>
    allLocations(),
  )
  const [copied, setCopied] = useState(false)

  const item = media[i]
  const loc = locs[item.id]
  const placedCount = useMemo(
    () => media.filter((m) => locs[m.id] != null).length,
    [locs],
  )

  const place = (l: JoaquiLocation) => {
    saveDrafts({ ...loadDrafts(), [item.id]: l })
    setLocs(allLocations())
  }

  const reset = () => {
    const drafts = loadDrafts()
    delete drafts[item.id]
    saveDrafts(drafts)
    setLocs(allLocations())
  }

  const prev = () => setI((n) => (n - 1 + media.length) % media.length)
  const next = () => setI((n) => (n + 1) % media.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const exportJson = () => {
    const sorted = Object.fromEntries(
      Object.entries(locs).sort(([a], [b]) => a.localeCompare(b)),
    )
    return JSON.stringify(sorted, null, 2) + '\n'
  }

  const copy = async () => {
    await navigator.clipboard.writeText(exportJson())
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'joaqui-locations.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const markers: StageMarker[] = loc
    ? [{ id: 'joaqui-cal', kind: 'truth', loc }]
    : []

  const coordLabel = !loc
    ? 'sin ubicar — hacé clic en la escena'
    : isSphereLoc(loc)
      ? `yaw ${((loc.yaw * 180) / Math.PI).toFixed(2)}° · pitch ${((loc.pitch * 180) / Math.PI).toFixed(2)}°`
      : `x ${(loc.x * 100).toFixed(1)}% · y ${(loc.y * 100).toFixed(1)}%`

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="glass z-10 m-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3">
        <p className="font-mono text-[11px] tracking-widest text-accent-soft uppercase">
          Calibración · Buscando al Joaqui
        </p>
        <span className="glass-chip rounded-full px-3 py-1 font-mono text-xs">
          {placedCount}/{media.length} ubicadas
        </span>
        <div className="ms-auto flex items-center gap-2">
          <button onClick={prev} className="glass-chip cursor-pointer rounded-full px-3 py-1.5 text-sm hover:text-accent-soft" aria-label="Anterior">
            ←
          </button>
          <select
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="glass-chip max-w-56 cursor-pointer rounded-full px-3 py-1.5 text-xs"
            aria-label="Elegir foto"
          >
            {media.map((m, idx) => (
              <option key={m.id} value={idx} className="bg-paper">
                {locs[m.id] ? '✓ ' : '· '}
                {idx + 1}. {m.place} ({m.kind}) — {m.date}
              </option>
            ))}
          </select>
          <button onClick={next} className="glass-chip cursor-pointer rounded-full px-3 py-1.5 text-sm hover:text-accent-soft" aria-label="Siguiente">
            →
          </button>
        </div>
      </header>

      <main className="relative mx-3 flex-1 overflow-hidden rounded-2xl border border-white/10">
        {item.kind === '360' ? (
          <SphereStage item={item} markers={markers} onPick={place} />
        ) : (
          <PhotoStage item={item} markers={markers} onPick={place} />
        )}
      </main>

      <footer className="glass z-10 m-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {i + 1}/{media.length} · {item.place}
            <span className="text-ink-muted"> · {item.kind} · {item.date}</span>
          </p>
          <p className="font-mono text-xs text-ink-muted">{coordLabel}</p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {loc != null && (
            <button onClick={reset} className="glass-chip cursor-pointer rounded-full px-4 py-1.5 text-xs text-ink-muted hover:text-ink">
              Quitar punto
            </button>
          )}
          <button onClick={copy} className="glass-chip cursor-pointer rounded-full px-4 py-1.5 text-xs hover:text-accent-soft">
            {copied ? 'Copiado ✓' : 'Copiar JSON'}
          </button>
          <button onClick={download} className="btn-accent cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold">
            Descargar JSON
          </button>
        </div>
      </footer>
    </div>
  )
}
