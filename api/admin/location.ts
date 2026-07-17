import type { VercelRequest, VercelResponse } from '@vercel/node'
import { LOCATIONS_KEY, parseBody, redis, requireAdmin } from '../_lib.js'

// Save where Joaqui hides in one shot: { yaw, pitch } for 360s, { x, y } for
// flat photos (0..1). Replaces the calibration JSON export + manual commit.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({ error: 'media storage not configured' })
  }
  if (!requireAdmin(req, res)) return
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const { id, loc } = parseBody(req)
  const l = loc as Record<string, unknown> | undefined
  const valid =
    l != null &&
    typeof l === 'object' &&
    ((typeof l.yaw === 'number' && typeof l.pitch === 'number') ||
      (typeof l.x === 'number' && typeof l.y === 'number'))
  if (typeof id !== 'string' || !id || !valid) {
    return res.status(400).json({ error: 'invalid id or location' })
  }

  await redis.hset(LOCATIONS_KEY, { [id]: l })
  return res.status(200).json({ ok: true })
}
