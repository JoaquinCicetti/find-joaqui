import { useSyncExternalStore } from 'react'
import {
  buildItems,
  buildSpots,
  type MediaItem,
  type MediaRecord,
  type Spot,
} from './panoramas'
import type { JoaquiLocation } from '../game/joaqui' // type-only — no runtime cycle

export type { MediaRecord }

type Status = 'loading' | 'ready' | 'error'

export interface MediaSnapshot {
  media: MediaItem[]
  spots: Spot[]
  placeCount: number
  countryCount: number
  /** Joaqui's committed hiding spots, id → location (server source of truth). */
  locations: Record<string, JoaquiLocation>
  status: Status
}

const EMPTY: MediaSnapshot = {
  media: [],
  spots: [],
  placeCount: 0,
  countryCount: 0,
  locations: {},
  status: 'loading',
}

const CACHE_KEY = 'joaqui-media-cache-v1'

let snapshot: MediaSnapshot = EMPTY
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

interface ApiPayload {
  media: MediaRecord[]
  locations: Record<string, JoaquiLocation>
}

function commit(payload: ApiPayload, status: Status) {
  const media = buildItems(payload.media) // runs place-matching per record
  const spots = buildSpots(media)
  snapshot = {
    media,
    spots,
    locations: payload.locations ?? {},
    status,
    placeCount: new Set(media.map((m) => m.place)).size,
    countryCount: new Set(media.map((m) => m.country).filter(Boolean)).size,
  }
  emit()
}

let started = false

/** Fetch the library from /api/media and publish it. Also used to refresh
 *  after an admin upload — pass `fresh` there to bypass the endpoint's edge
 *  cache so a just-uploaded shot shows up immediately. */
export async function loadMedia(fresh = false): Promise<void> {
  // On first load, paint the last-known-good cache instantly so returning
  // visitors never see an empty globe while the network round-trips.
  if (!started) {
    started = true
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) commit(JSON.parse(cached) as ApiPayload, 'loading')
    } catch {
      /* ignore corrupt cache */
    }
  }

  try {
    const url = fresh ? `/api/media?t=${Date.now()}` : '/api/media'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as ApiPayload
    commit(data, 'ready')
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      /* quota — non-fatal */
    }
  } catch {
    // keep whatever we already showed; only surface an error with nothing to show
    snapshot = {
      ...snapshot,
      status: snapshot.media.length ? 'ready' : 'error',
    }
    emit()
  }
}

// --- React subscription (stable snapshot identity between commits) ---
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const getSnapshot = () => snapshot
export const useMedia = (): MediaSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

// --- synchronous getters for non-React code (game/joaqui.ts) ---
export const getMedia = (): MediaItem[] => snapshot.media
export const getServerLocations = (): Record<string, JoaquiLocation> =>
  snapshot.locations
