import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'

// Provisioned via Vercel Marketplace (Upstash). Both env spellings are
// supported: UPSTASH_* (direct) and KV_* (Vercel KV-compatible stores).
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
const redis = url && token ? new Redis({ url, token }) : null

const KEY = 'joaqui:leaderboard'
const TIMES_KEY = 'joaqui:times' // name → run duration in seconds
const MAX_SCORE = 10_000 // 10 rounds × 1000, above any legit total
const MAX_TIME = 8 * 600 // per-round elapsed is client-capped at 600s

async function topScores(): Promise<
  { name: string; score: number; time: number | null }[]
> {
  const flat = await redis!.zrange<(string | number)[]>(KEY, 0, 19, {
    rev: true,
    withScores: true,
  })
  const names: string[] = []
  for (let i = 0; i < flat.length; i += 2) names.push(String(flat[i]))
  const times = names.length
    ? await redis!.hmget<Record<string, number>>(TIMES_KEY, ...names)
    : null
  const top: { name: string; score: number; time: number | null }[] = []
  for (let i = 0; i < flat.length; i += 2) {
    const name = String(flat[i])
    const t = times?.[name]
    top.push({
      name,
      score: Number(flat[i + 1]),
      time: Number.isFinite(Number(t)) && t !== null ? Number(t) : null,
    })
  }
  return top
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) {
    return res.status(503).json({ error: 'score storage not configured' })
  }

  if (req.method === 'GET') {
    return res.status(200).json({ top: await topScores() })
  }

  if (req.method === 'POST') {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
    const name = String(body.name ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 24)
    const score = Math.round(Number(body.score))
    if (!name || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      return res.status(400).json({ error: 'invalid name or score' })
    }
    const time = Math.round(Number(body.time))
    const validTime = Number.isFinite(time) && time >= 0 && time <= MAX_TIME

    // only overwrite a player's entry (and its time) when the score improves
    const prev = await redis.zscore(KEY, name)
    if (prev === null || score > Number(prev)) {
      await redis.zadd(KEY, { gt: true }, { score, member: name })
      if (validTime) await redis.hset(TIMES_KEY, { [name]: time })
    }
    return res.status(200).json({ top: await topScores() })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'method not allowed' })
}
