import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  asObj,
  LOCATIONS_KEY,
  MEDIA_KEY,
  redis,
  type MediaRecord,
} from './_lib'

// Public read path: the whole media library + Joaqui's hiding spots, built
// live from Redis. Replaces the build-time manifest import.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({ error: 'media storage not configured' })
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const [mediaMap, locMap] = await Promise.all([
    redis.hgetall<Record<string, unknown>>(MEDIA_KEY),
    redis.hgetall<Record<string, unknown>>(LOCATIONS_KEY),
  ])

  const media = Object.values(mediaMap ?? {})
    .map((v) => asObj<MediaRecord>(v))
    .filter((m): m is MediaRecord => m != null)

  const locations: Record<string, unknown> = {}
  for (const [id, v] of Object.entries(locMap ?? {})) {
    const loc = asObj<unknown>(v)
    if (loc != null) locations[id] = loc
  }

  // brief shared-edge cache; admin refetches bust it with a cache: 'no-store'
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=10, stale-while-revalidate=60',
  )
  return res.status(200).json({ media, locations })
}
