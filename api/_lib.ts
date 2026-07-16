// Shared helpers for the media/admin API routes. The leading underscore keeps
// Vercel from turning this file into a route — it's an internal module.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'
import { createHash, timingSafeEqual } from 'node:crypto'

// Same Upstash setup as api/scores.ts (UPSTASH_* direct or KV_* compatible).
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
export const redis = url && token ? new Redis({ url, token }) : null

export const MEDIA_KEY = 'joaqui:media'
export const LOCATIONS_KEY = 'joaqui:locations'

export interface MediaRecord {
  id: string
  kind: '360' | 'photo'
  file: string
  blobUrl: string
  thumbUrl: string
  microUrl: string
  lat: number
  lng: number
  date: string
}

/** Constant-time, constant-length compare against ADMIN_PASSWORD. */
export function checkAdminKey(candidate: string | undefined): boolean {
  const secret = process.env.ADMIN_PASSWORD
  if (!secret || !candidate) return false
  const sha = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(sha(candidate), sha(secret))
}

/** Guard an admin route. Writes 401 and returns false when unauthorized. */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const raw = req.headers['x-admin-key']
  const key = Array.isArray(raw) ? raw[0] : raw
  if (!checkAdminKey(key)) {
    res.status(401).json({ error: 'unauthorized' })
    return false
  }
  return true
}

export function parseBody(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return (req.body as Record<string, unknown>) ?? {}
}

/** @upstash/redis auto-deserializes JSON, but tolerate string values too. */
export function asObj<T>(v: unknown): T | null {
  if (v == null) return null
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T
    } catch {
      return null
    }
  }
  return v as T
}
