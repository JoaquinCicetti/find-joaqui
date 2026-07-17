import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del } from '@vercel/blob'
import {
  asObj,
  LOCATIONS_KEY,
  MEDIA_KEY,
  parseBody,
  redis,
  requireAdmin,
  type MediaRecord,
} from '../_lib.js'

// Persist / remove a media record. Blobs are uploaded directly by the browser;
// this only writes the metadata row (and cleans up blobs on delete).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({ error: 'media storage not configured' })
  }
  if (!requireAdmin(req, res)) return

  if (req.method === 'POST') {
    const r = parseBody(req) as unknown as MediaRecord
    if (
      !r.id ||
      (r.kind !== '360' && r.kind !== 'photo') ||
      !r.blobUrl ||
      !r.thumbUrl ||
      !r.microUrl ||
      typeof r.lat !== 'number' ||
      typeof r.lng !== 'number' ||
      !r.date
    ) {
      return res.status(400).json({ error: 'invalid media record' })
    }
    await redis.hset(MEDIA_KEY, { [r.id]: r })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id ?? '')
    if (!id) return res.status(400).json({ error: 'missing id' })
    const rec = asObj<MediaRecord>(await redis.hget(MEDIA_KEY, id))
    await Promise.all([
      redis.hdel(MEDIA_KEY, id),
      redis.hdel(LOCATIONS_KEY, id),
    ])
    if (rec) {
      // best-effort blob cleanup; a stale blob is harmless if this fails
      try {
        await del([rec.blobUrl, rec.thumbUrl, rec.microUrl])
      } catch {
        /* ignore */
      }
    }
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'POST, DELETE')
  return res.status(405).json({ error: 'method not allowed' })
}
