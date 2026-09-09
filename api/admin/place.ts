import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  asObj,
  MEDIA_KEY,
  parseBody,
  redis,
  requireAdmin,
  type MediaRecord,
} from '../_lib.js'

// Rename one shot's place. Without an override the name is derived from GPS by
// the PLACES radius table in src/data/panoramas.ts, which leaves anything shot
// outside a listed radius as "Unknown place".
//
// Sending an empty string deliberately CLEARS the override and returns that
// shot to GPS matching — that is how you undo a bad rename.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({ error: 'media storage not configured' })
  }
  if (!requireAdmin(req, res)) return
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const { id, place, country } = parseBody(req)
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'missing id' })
  }
  if (
    (place !== undefined && typeof place !== 'string') ||
    (country !== undefined && typeof country !== 'string')
  ) {
    return res.status(400).json({ error: 'place and country must be strings' })
  }

  const rec = asObj<MediaRecord>(await redis.hget(MEDIA_KEY, id))
  if (!rec) return res.status(404).json({ error: 'unknown media id' })

  const next: MediaRecord = { ...rec }
  if (place !== undefined) {
    const v = place.trim()
    if (v) next.place = v
    else delete next.place
  }
  if (country !== undefined) {
    const v = country.trim()
    if (v) next.country = v
    else delete next.country
  }

  await redis.hset(MEDIA_KEY, { [id]: next })
  return res.status(200).json({ ok: true, place: next.place ?? null })
}
