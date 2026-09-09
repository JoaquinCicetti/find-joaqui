import { useEffect, useMemo, useState } from 'react'
import { loadMedia, useMedia } from '../data/mediaStore'
import type { MediaItem } from '../data/panoramas'
import {
  allLocations,
  isSphereLoc,
  loadDrafts,
  saveDrafts,
  type JoaquiLocation,
} from '../game/joaqui'
import {
  clearAdminKey,
  deleteMedia,
  getAdminKey,
  login,
  saveLocation,
  savePlace,
} from '../lib/adminApi'
import { AdminUpload } from './AdminUpload'
import { PhotoStage, SphereStage, type StageMarker } from './JoaquiStage'

/**
 * Admin tool (open with ?admin or ?calibrate): log in, upload shots, and click
 * where Joaqui hides. Placements save straight to the server (Redis) and also
 * keep a localStorage draft as an offline backup.
 */
export function CalibrationSuite() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminKey()))
  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />
  return <AdminWorkspace onLogout={() => setAuthed(false)} />
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(false)
    const ok = await login(pw)
    setBusy(false)
    if (ok) onDone()
    else setErr(true)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper p-4">
      <form
        onSubmit={submit}
        className="glass anim-scale w-[min(100%,22rem)] rounded-3xl p-7 text-center"
      >
        <h2 className="font-display text-2xl font-medium">Admin</h2>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          placeholder="Contraseña"
          className="glass-chip mt-4 w-full rounded-full px-4 py-2.5 text-sm outline-none focus:border-accent-soft"
        />
        {err && <p className="mt-2 text-xs text-red-400">Contraseña incorrecta</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="btn-primary mt-4 w-full"
        >
          {busy ? '…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function AdminWorkspace({ onLogout }: { onLogout: () => void }) {
  const { media, status } = useMedia()
  const [i, setI] = useState(0)
  const [locs, setLocs] = useState<Record<string, JoaquiLocation>>(() =>
    allLocations(),
  )
  const [uploadOpen, setUploadOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')

  // re-sync local map when the server library (re)loads
  useEffect(() => {
    setLocs(allLocations())
  }, [status, media])

  const safeI = media.length ? Math.min(i, media.length - 1) : 0
  const item = media[safeI]
  const loc = item ? locs[item.id] : undefined
  const placedCount = useMemo(
    () => media.filter((m) => locs[m.id] != null).length,
    [locs, media],
  )

  const place = async (l: JoaquiLocation) => {
    if (!item) return
    // draft first so the point is never lost, then persist to the server
    saveDrafts({ ...loadDrafts(), [item.id]: l })
    setLocs(allLocations())
    setSaveState('saving')
    try {
      await saveLocation(item.id, l)
      setSaveState('idle')
    } catch {
      setSaveState('error')
    }
  }

  const reset = () => {
    if (!item) return
    const drafts = loadDrafts()
    delete drafts[item.id]
    saveDrafts(drafts)
    setLocs(allLocations())
  }

  const removeShot = async () => {
    if (!item) return
    if (!confirm(`¿Borrar "${item.place}"? Esto elimina la foto para todos.`))
      return
    await deleteMedia(item.id)
    await loadMedia(true)
    setI((n) => Math.max(0, n - 1))
  }

  const prev = () =>
    setI((n) => (media.length ? (n - 1 + media.length) % media.length : 0))
  const next = () => setI((n) => (media.length ? (n + 1) % media.length : 0))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (uploadOpen) return
      if (e.target instanceof HTMLSelectElement) return
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uploadOpen, media.length])

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

  const logout = () => {
    clearAdminKey()
    onLogout()
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
          Admin · Buscando al Joaqui
        </p>
        <span className="glass-chip rounded-full px-3 py-1 font-mono text-xs">
          {placedCount}/{media.length} ubicadas
        </span>
        <button
          onClick={() => setUploadOpen(true)}
          className="btn-accent cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold"
        >
          + Subir fotos
        </button>
        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={prev}
            className="glass-chip cursor-pointer rounded-full px-3 py-1.5 text-sm hover:text-accent-soft"
            aria-label="Anterior"
          >
            ←
          </button>
          <select
            value={safeI}
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
          <button
            onClick={next}
            className="glass-chip cursor-pointer rounded-full px-3 py-1.5 text-sm hover:text-accent-soft"
            aria-label="Siguiente"
          >
            →
          </button>
          <button
            onClick={logout}
            className="glass-chip cursor-pointer rounded-full px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="relative mx-3 flex-1 overflow-hidden rounded-2xl border border-white/10">
        {item ? (
          item.kind === '360' ? (
            <SphereStage item={item} markers={markers} onPick={place} />
          ) : (
            <PhotoStage item={item} markers={markers} onPick={place} />
          )
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-muted">
            {status === 'loading'
              ? 'Cargando…'
              : 'No hay fotos todavía. Subí algunas para empezar.'}
          </div>
        )}
      </main>

      <footer className="glass z-10 m-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="text-ink-muted">
              {item ? `${safeI + 1}/${media.length}` : '—'}
            </span>
            {item && (
              <>
                <PlaceEditor item={item} />
                <span className="text-ink-muted">
                  · {item.kind} · {item.date}
                </span>
              </>
            )}
          </div>
          <p className="font-mono text-xs text-ink-muted">
            {item ? coordLabel : ''}
            {saveState === 'saving' && (
              <span className="text-accent-soft"> · guardando…</span>
            )}
            {saveState === 'error' && (
              <span className="text-red-400"> · error al guardar</span>
            )}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {item && loc != null && (
            <button
              onClick={reset}
              className="glass-chip cursor-pointer rounded-full px-4 py-1.5 text-xs text-ink-muted hover:text-ink"
            >
              Quitar punto
            </button>
          )}
          {item && (
            <button
              onClick={removeShot}
              className="glass-chip cursor-pointer rounded-full px-4 py-1.5 text-xs text-red-400/90 hover:text-red-400"
            >
              Borrar foto
            </button>
          )}
          <button
            onClick={copy}
            className="glass-chip cursor-pointer rounded-full px-4 py-1.5 text-xs hover:text-accent-soft"
          >
            {copied ? 'Copiado ✓' : 'Copiar JSON'}
          </button>
        </div>
      </footer>

      {uploadOpen && <AdminUpload onClose={() => setUploadOpen(false)} />}
    </div>
  )
}

/**
 * Rename one shot. Names normally come from the GPS radius match in
 * panoramas.ts, so anywhere that table doesn't cover reads "Unknown place" —
 * this is how you fix that without a code change and a redeploy.
 *
 * Clearing a field restores GPS matching for it.
 */
function PlaceEditor({ item }: { item: MediaItem }) {
  const [place, setPlace] = useState(item.place)
  const [country, setCountry] = useState(item.country)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  // a different shot scrolled in — show its values, not the previous one's
  useEffect(() => {
    setPlace(item.place)
    setCountry(item.country)
    setState('idle')
  }, [item.id, item.place, item.country])

  const dirty = place !== item.place || country !== item.country

  const commit = async () => {
    if (!dirty) return
    setState('saving')
    try {
      // 'Unknown place' is our own placeholder, never a name worth storing
      await savePlace(item.id, place === 'Unknown place' ? '' : place, country)
      await loadMedia(true)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') {
      setPlace(item.place)
      setCountry(item.country)
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        value={place}
        onChange={(e) => setPlace(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        placeholder="Lugar"
        aria-label="Nombre del lugar"
        className="glass-chip w-44 rounded-full px-3 py-1 text-sm outline-none focus:border-accent-soft"
      />
      <input
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        placeholder="País (en inglés)"
        aria-label="País"
        className="glass-chip w-36 rounded-full px-3 py-1 text-sm outline-none focus:border-accent-soft"
      />
      {state === 'saving' && (
        <span className="text-xs text-accent-soft">guardando…</span>
      )}
      {state === 'error' && (
        <span className="text-xs text-red-400">error</span>
      )}
      {state === 'idle' && dirty && (
        <span className="text-xs text-ink-muted">sin guardar</span>
      )}
    </span>
  )
}
