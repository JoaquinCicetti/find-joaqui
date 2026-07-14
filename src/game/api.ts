export interface ScoreEntry {
  name: string
  score: number
}

const LOCAL_KEY = 'joaqui-local-scores'

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
): Promise<{ top: ScoreEntry[]; remote: boolean }> {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { top: ScoreEntry[] }
    localSave({ name, score }) // mirror locally too
    return { top: data.top, remote: true }
  } catch {
    return { top: localSave({ name, score }), remote: false }
  }
}
