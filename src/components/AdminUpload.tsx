import { useState } from 'react'
import { loadMedia } from '../data/mediaStore'
import type { MediaKind } from '../data/panoramas'
import { guessKind, readExif, uploadMedia } from '../lib/adminApi'
import { IconClose } from './icons'

interface Staged {
  file: File
  preview: string
  kind: MediaKind
  lat: string
  lng: string
  date: string
  status: 'idle' | 'uploading' | 'done' | 'error'
  error?: string
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const ready = (s: Staged) =>
  s.status !== 'done' &&
  Number.isFinite(num(s.lat)) &&
  Number.isFinite(num(s.lng)) &&
  /^\d{4}-\d{2}$/.test(s.date)

export function AdminUpload({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Staged[]>([])
  const [busy, setBusy] = useState(false)

  const add = async (files: FileList | null) => {
    if (!files) return
    const staged: Staged[] = await Promise.all(
      [...files].map(async (file) => {
        const [exif, kind] = await Promise.all([readExif(file), guessKind(file)])
        return {
          file,
          preview: URL.createObjectURL(file),
          kind,
          lat: exif.lat != null ? String(exif.lat) : '',
          lng: exif.lng != null ? String(exif.lng) : '',
          date: exif.date ?? '',
          status: 'idle' as const,
        }
      }),
    )
    setItems((prev) => [...prev, ...staged])
  }

  const patch = (i: number, p: Partial<Staged>) =>
    setItems((prev) => prev.map((s, n) => (n === i ? { ...s, ...p } : s)))

  const remove = (i: number) =>
    setItems((prev) => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, n) => n !== i)
    })

  const uploadAll = async () => {
    setBusy(true)
    for (let i = 0; i < items.length; i++) {
      const s = items[i]
      if (!ready(s)) continue
      patch(i, { status: 'uploading', error: undefined })
      try {
        await uploadMedia(s.file, {
          kind: s.kind,
          lat: num(s.lat),
          lng: num(s.lng),
          date: s.date,
        })
        patch(i, { status: 'done' })
      } catch (err) {
        patch(i, { status: 'error', error: (err as Error).message })
      }
    }
    await loadMedia(true) // refresh the live library with the new shots (bypass edge cache)
    setBusy(false)
  }

  const pending = items.filter(ready).length

  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md">
      <div className="glass anim-scale w-[min(100%,44rem)] rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-medium">Subir fotos</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="glass-chip grid h-9 w-9 cursor-pointer place-items-center rounded-full text-ink-muted hover:text-ink"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center text-sm text-ink-muted hover:border-accent-soft/60">
          <span>Elegí imágenes (JPEG/PNG/WebP). Se leen GPS y fecha del EXIF.</span>
          <span className="glass-chip rounded-full px-4 py-1.5 text-xs text-ink">
            Seleccionar archivos
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => add(e.target.files)}
          />
        </label>

        {items.length > 0 && (
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((s, i) => (
              <li
                key={i}
                className="glass-chip flex flex-wrap items-center gap-3 rounded-2xl p-3"
              >
                <img
                  src={s.preview}
                  alt=""
                  className="h-14 w-20 shrink-0 rounded-lg object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink-muted">
                      {s.file.name}
                    </span>
                    <select
                      value={s.kind}
                      onChange={(e) =>
                        patch(i, { kind: e.target.value as MediaKind })
                      }
                      className="glass-chip ms-auto cursor-pointer rounded-full px-2 py-1"
                    >
                      <option value="360" className="bg-paper">
                        360°
                      </option>
                      <option value="photo" className="bg-paper">
                        foto
                      </option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Field
                      label="lat"
                      value={s.lat}
                      onChange={(v) => patch(i, { lat: v })}
                    />
                    <Field
                      label="lng"
                      value={s.lng}
                      onChange={(v) => patch(i, { lng: v })}
                    />
                    <Field
                      label="YYYY-MM"
                      value={s.date}
                      onChange={(v) => patch(i, { date: v })}
                      width="w-24"
                    />
                    <span className="ms-auto self-center font-mono text-[11px]">
                      {s.status === 'done' ? (
                        <span className="text-accent-soft">✓ subida</span>
                      ) : s.status === 'uploading' ? (
                        <span className="text-ink-muted">subiendo…</span>
                      ) : s.status === 'error' ? (
                        <span className="text-red-400">{s.error}</span>
                      ) : !ready(s) ? (
                        <span className="text-red-400/80">falta GPS/fecha</span>
                      ) : (
                        <span className="text-ink-muted">listo</span>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => remove(i)}
                  aria-label="Quitar"
                  className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted hover:text-ink"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">
            Cerrar
          </button>
          <button
            onClick={uploadAll}
            disabled={busy || pending === 0}
            className="btn-primary px-6"
          >
            {busy ? 'Subiendo…' : `Subir ${pending || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  width = 'w-28',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  width?: string
}) {
  return (
    <label className={`relative ${width}`}>
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[9px] tracking-wider text-ink-muted uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-chip w-full rounded-full py-1.5 ps-12 pe-2 font-mono text-xs outline-none focus:border-accent-soft"
      />
    </label>
  )
}
