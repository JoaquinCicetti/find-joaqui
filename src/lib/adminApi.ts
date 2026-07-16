import { upload } from '@vercel/blob/client'
import exifr from 'exifr'
import type { MediaKind, MediaRecord } from '../data/panoramas'
import type { JoaquiLocation } from '../game/joaqui'

// The shared secret lives in sessionStorage after login and rides on every
// admin request (x-admin-key), or in clientPayload for the Blob token route.
const KEY_STORE = 'joaqui-admin-key'
export const getAdminKey = (): string =>
  sessionStorage.getItem(KEY_STORE) ?? ''
const setAdminKey = (k: string) => sessionStorage.setItem(KEY_STORE, k)
export const clearAdminKey = (): void => sessionStorage.removeItem(KEY_STORE)

/** Verify the password server-side; on success, remember it for this tab. */
export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.ok) {
    setAdminKey(password)
    return true
  }
  return false
}

function authHeaders(): Record<string, string> {
  return { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }
}

export async function saveLocation(
  id: string,
  loc: JoaquiLocation,
): Promise<void> {
  const res = await fetch('/api/admin/location', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ id, loc }),
  })
  if (!res.ok) throw new Error(`save location failed (${res.status})`)
}

export async function deleteMedia(id: string): Promise<void> {
  const res = await fetch(`/api/admin/media?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': getAdminKey() },
  })
  if (!res.ok) throw new Error(`delete failed (${res.status})`)
}

// ---- EXIF ----

export interface ExifResult {
  lat?: number
  lng?: number
  /** YYYY-MM */
  date?: string
}

/** Pull GPS + capture date from a file, all fields optional (Apple exports
 *  often strip GPS — the UI falls back to manual entry). */
export async function readExif(file: File): Promise<ExifResult> {
  const gps = await exifr.gps(file).catch(() => null)
  const meta = await exifr
    .parse(file, ['DateTimeOriginal', 'CreateDate'])
    .catch(() => null)
  const d: unknown = meta?.DateTimeOriginal ?? meta?.CreateDate
  const date =
    d instanceof Date && !Number.isNaN(d.getTime())
      ? d.toISOString().slice(0, 7)
      : undefined
  return { lat: gps?.latitude, lng: gps?.longitude, date }
}

// ---- Thumbnails (browser canvas — no sharp/sips in serverless) ----

async function toJpegThumb(bitmap: ImageBitmap, maxDim: number): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('thumbnail failed'))),
      'image/jpeg',
      0.8,
    ),
  )
}

function extFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  const m = file.name.match(/\.([a-z0-9]+)$/i)
  return (m?.[1] ?? 'jpg').toLowerCase()
}

export interface UploadMeta {
  kind: MediaKind
  lat: number
  lng: number
  /** YYYY-MM */
  date: string
}

/** Full upload: canvas thumbnails → 3 Blob uploads (browser→Blob direct, so no
 *  4.5 MB serverless cap) → persist the metadata row. Returns the new record. */
export async function uploadMedia(
  file: File,
  meta: UploadMeta,
): Promise<MediaRecord> {
  const key = getAdminKey()
  const bitmap = await createImageBitmap(file)
  let thumb: Blob
  let micro: Blob
  try {
    ;[thumb, micro] = await Promise.all([
      toJpegThumb(bitmap, 480),
      toJpegThumb(bitmap, 128),
    ])
  } finally {
    bitmap.close?.()
  }

  const id = crypto.randomUUID()
  const dir = meta.kind === '360' ? 'panos' : 'photos'
  const opts = {
    access: 'public' as const,
    handleUploadUrl: '/api/admin/blob-upload',
    clientPayload: key,
  }
  const [orig, thumbRes, microRes] = await Promise.all([
    upload(`${dir}/${id}.${extFor(file)}`, file, opts),
    upload(`${dir}/thumbs/${id}.jpg`, thumb, opts),
    upload(`${dir}/thumbs/micro/${id}.jpg`, micro, opts),
  ])

  const rec: MediaRecord = {
    id,
    kind: meta.kind,
    file: file.name,
    blobUrl: orig.url,
    thumbUrl: thumbRes.url,
    microUrl: microRes.url,
    lat: meta.lat,
    lng: meta.lng,
    date: meta.date,
  }
  const res = await fetch('/api/admin/media', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(rec),
  })
  if (!res.ok) throw new Error(`save media failed (${res.status})`)
  return rec
}

/** Aspect-ratio guess: equirectangular 360s are ~2:1. */
export async function guessKind(file: File): Promise<MediaKind> {
  try {
    const b = await createImageBitmap(file)
    const ratio = b.width / b.height
    b.close?.()
    return ratio >= 1.8 ? '360' : 'photo'
  } catch {
    return 'photo'
  }
}
