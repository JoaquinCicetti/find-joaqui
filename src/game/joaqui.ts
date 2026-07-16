import committedRaw from '../data/joaqui-locations.json'
import { media, type MediaItem } from '../data/panoramas'

/**
 * Where Joaqui hides inside one shot.
 * 360° panos use viewer angles in radians (Photo Sphere Viewer convention);
 * flat photos use coordinates normalized to 0..1 of the image.
 */
export type JoaquiLocation =
  | { yaw: number; pitch: number }
  | { x: number; y: number }

export function isSphereLoc(
  loc: JoaquiLocation,
): loc is { yaw: number; pitch: number } {
  return 'yaw' in loc
}

/** Locations shipped with the build (exported from the calibration suite). */
export const committed = committedRaw as Record<string, JoaquiLocation>

const DRAFT_KEY = 'joaqui-locations-draft'

/** Calibration drafts live in localStorage until they're committed to the JSON. */
export function loadDrafts(): Record<string, JoaquiLocation> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveDrafts(drafts: Record<string, JoaquiLocation>): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts))
}

/** Committed locations with any local drafts layered on top. */
export function allLocations(): Record<string, JoaquiLocation> {
  return { ...committed, ...loadDrafts() }
}

/** Only shots where Joaqui has actually been placed are playable. */
export function playableItems(): MediaItem[] {
  const locs = allLocations()
  return media.filter((m) => locs[m.id] != null)
}

/** Counts for the pitch banner — the set Joaqui is *actually* hidden in,
 *  not the whole library. */
export function playableStats(): {
  count: number
  places: number
  countries: number
} {
  const items = playableItems()
  return {
    count: items.length,
    places: new Set(items.map((m) => m.place)).size,
    countries: new Set(items.map((m) => m.country).filter(Boolean)).size,
  }
}

export const ROUNDS = 8
export const MAX_ROUND_SCORE = 1000
export const ROUND_SECONDS = 45
export const GRACE_SECONDS = 10
export const MIN_TIME_FACTOR = 0.4

/**
 * How much of the accuracy score the clock still allows: 1 during the
 * first GRACE_SECONDS, then decaying linearly to MIN_TIME_FACTOR at 0:00.
 */
export function timeFactor(secondsLeft: number): number {
  const decayWindow = ROUND_SECONDS - GRACE_SECONDS
  const used = Math.min(
    Math.max(ROUND_SECONDS - secondsLeft - GRACE_SECONDS, 0),
    decayWindow,
  )
  return 1 - (1 - MIN_TIME_FACTOR) * (used / decayWindow)
}

/** Fisher–Yates pick of up to ROUNDS playable shots. */
export function pickRounds(): MediaItem[] {
  const pool = [...playableItems()]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(ROUNDS, pool.length))
}

/** Great-circle angle between two view directions, in degrees. */
export function sphereDistanceDeg(
  a: { yaw: number; pitch: number },
  b: { yaw: number; pitch: number },
): number {
  const cos =
    Math.sin(a.pitch) * Math.sin(b.pitch) +
    Math.cos(a.pitch) * Math.cos(b.pitch) * Math.cos(a.yaw - b.yaw)
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}

export type GuessResult =
  | { points: number; kind: '360'; deg: number }
  | { points: number; kind: 'photo'; pct: number }

/**
 * Score a guess against the truth. A near-exact hit earns the full 1000;
 * beyond that, points decay exponentially with distance.
 */
export function scoreGuess(
  guess: JoaquiLocation,
  truth: JoaquiLocation,
): GuessResult {
  if (isSphereLoc(guess) && isSphereLoc(truth)) {
    const deg = sphereDistanceDeg(guess, truth)
    const points =
      deg <= 4
        ? MAX_ROUND_SCORE
        : Math.round(MAX_ROUND_SCORE * Math.exp(-(deg - 4) / 15))
    return { points, kind: '360', deg }
  }
  if (!isSphereLoc(guess) && !isSphereLoc(truth)) {
    // normalized by the image diagonal so 1 = opposite corners
    const d = Math.hypot(guess.x - truth.x, guess.y - truth.y) / Math.SQRT2
    const points =
      d <= 0.02
        ? MAX_ROUND_SCORE
        : Math.round(MAX_ROUND_SCORE * Math.exp(-(d - 0.02) / 0.07))
    return { points, kind: 'photo', pct: d * 100 }
  }
  return { points: 0, kind: 'photo', pct: 100 }
}
