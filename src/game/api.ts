export interface ScoreEntry {
  name: string
  score: number
  /** run duration in seconds; older entries may not have one */
  time?: number | null
}

const LOCAL_KEY = 'joaqui-local-scores'

/** m:ss for a duration in seconds. */
export function formatSeconds(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`
}

function localTop(): ScoreEntry[] {
  try {
    const list = JSON.parse(
      localStorage.getItem(LOCAL_KEY) ?? '[]',
    ) as ScoreEntry[]
    return list.sort((a, b) => b.score - a.score).slice(0, 20)
  } catch {
    return []
  }
}

function localSave(entry: ScoreEntry): ScoreEntry[] {
  const list = localTop().filter((e) => e.name !== entry.name)
  const prev = localTop().find((e) => e.name === entry.name)
  list.push(prev && prev.score > entry.score ? prev : entry)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
  return localTop()
}

/** Top scores from the API; falls back to this device's scores offline. */
export async function fetchTop(): Promise<{
  top: ScoreEntry[]
  remote: boolean
}> {
  try {
    const res = await fetch('/api/scores')
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { top: ScoreEntry[] }
    return { top: data.top, remote: true }
  } catch {
    return { top: localTop(), remote: false }
  }
}

/** Save a score; keeps each player's best. Falls back to localStorage. */
export async function submitScore(
  name: string,
  score: number,
  time?: number,
): Promise<{ top: ScoreEntry[]; remote: boolean }> {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score, time }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { top: ScoreEntry[] }
    localSave({ name, score, time }) // mirror locally too
    return { top: data.top, remote: true }
  } catch {
    return { top: localSave({ name, score, time }), remote: false }
  }
}
