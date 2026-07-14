import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'

// Provisioned via Vercel Marketplace (Upstash). Both env spellings are
// supported: UPSTASH_* (direct) and KV_* (Vercel KV-compatible stores).
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
const redis = url && token ? new Redis({ url, token }) : null

const KEY = 'joaqui:leaderboard'
const MAX_SCORE = 10_000 // 10 rounds × 1000, above any legit total

async function topScores(): Promise<{ name: string; score: number }[]> {
  const flat = await redis!.zrange<(string | number)[]>(KEY, 0, 19, {
    rev: true,
    withScores: true,
  })
  const top: { name: string; score: number }[] = []
  for (let i = 0; i < flat.length; i += 2) {
    top.push({ name: String(flat[i]), score: Number(flat[i + 1]) })
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
    // GT: only overwrite a player's entry when the new score beats it
    await redis.zadd(KEY, { gt: true }, { score, member: name })
    return res.status(200).json({ top: await topScores() })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'method not allowed' })
}
