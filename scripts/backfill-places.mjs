// Fill in place names for shots that have none, by reverse-geocoding their GPS.
//
// Names normally come from the PLACES radius table in src/data/panoramas.ts, so
// anywhere that table doesn't cover shows up as "Unknown place". This writes an
// explicit override onto the Redis media record instead, which that table then
// defers to.
//
// Only shots that resolve to nothing are touched. The hand-curated entries in
// PLACES are deliberately better than what a geocoder returns ("Bariloche", not
// "Departamento Bariloche"; "Komodo", not "Kabupaten Manggarai Barat"), so a
// shot that already matches one is left alone.
//
//   node scripts/backfill-places.mjs           # dry run — prints what it would do
//   node scripts/backfill-places.mjs --write   # actually writes
//   node scripts/backfill-places.mjs --write --all   # ignore PLACES, geocode everything
//
// Reads the same env vars as api/_lib.ts. Put them in .env.local.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MEDIA_KEY = 'joaqui:media'
const WRITE = process.argv.includes('--write')
const ALL = process.argv.includes('--all')

// Nominatim's usage policy requires a real UA and no more than 1 req/sec.
const UA = 'find-joaqui/1.0 (https://find-joaqui.vercel.app)'
const THROTTLE_MS = 1200

// --- env -------------------------------------------------------------------
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
if (!URL_ || !TOKEN) {
  console.error('Missing UPSTASH_REDIS_REST_URL / _TOKEN (or KV_ equivalents).')
  process.exit(1)
}

const redis = async (...cmd) => {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  if (!res.ok) throw new Error(`redis ${cmd[0]}: ${res.status} ${await res.text()}`)
  return (await res.json()).result
}

const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v)

// --- the same GPS match the app does ---------------------------------------
// Parsed out of the source rather than duplicated, so the two can't drift.
const src = readFileSync(join(root, 'src', 'data', 'panoramas.ts'), 'utf8')
const PLACES = JSON.parse(
  src
    .match(/radius: number\n\}\[\] = (\[[\s\S]*?\n\])/)[1]
    .replace(/(\w+):/g, '"$1":')
    .replace(/'/g, '"')
    .replace(/,(\s*[\]}])/g, '$1'),
)

function haversineKm(a, b) {
  const rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad
  const dLng = (b[1] - a[1]) * rad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(s))
}

function locate(lat, lng) {
  let best = null
  let bestDist = Infinity
  for (const p of PLACES) {
    const d = haversineKm([lat, lng], p.at)
    if (d < p.radius && d < bestDist) {
      best = p
      bestDist = d
    }
  }
  return best
}

// --- geocode ---------------------------------------------------------------
async function reverse(lat, lng) {
  // accept-language=en matters: countries are stored in English and localized
  // for display by countryName() in src/i18n.tsx.
  const u =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&zoom=12&accept-language=en`
  const res = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const j = await res.json()
  const a = j.address ?? {}
  const name = a.village ?? a.town ?? a.city ?? a.municipality ?? a.county ?? j.name
  if (!name) return null
  // "Rocamadour, Lot" reads better than a bare village on a world map
  const region = a.county && a.county !== name ? `${name}, ${a.county}` : name
  return { place: region, country: a.country ?? '' }
}

// --- run -------------------------------------------------------------------
const map = (await redis('HGETALL', MEDIA_KEY)) ?? []
const records = []
for (let i = 0; i < map.length; i += 2) records.push(asObj(map[i + 1]))

const todo = records.filter(
  (r) =>
    r &&
    r.lat != null &&
    r.lng != null &&
    !r.place &&
    (ALL || locate(r.lat, r.lng) == null),
)
console.log(
  `${records.length} shots · ${PLACES.length} curated places · ` +
    `${todo.length} unnamed, to geocode\n`,
)

const results = []
for (const r of todo) {
  let hit = null
  try {
    hit = await reverse(r.lat, r.lng)
  } catch (e) {
    console.warn(`  ! ${r.id}: ${e.message}`)
  }
  const label = hit ? `${hit.place} — ${hit.country}` : '(no match)'
  console.log(`  ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}  ->  ${label}`)
  if (hit) results.push({ rec: r, hit })
  await new Promise((res) => setTimeout(res, THROTTLE_MS))
}

if (!WRITE) {
  console.log(
    `\nDry run — nothing written. Re-run with --write to apply ${results.length} name(s).`,
  )
  console.log('Anything wrong here is easier to fix in the admin UI than to undo.')
  process.exit(0)
}

for (const { rec, hit } of results) {
  const next = { ...rec, place: hit.place }
  if (hit.country) next.country = hit.country
  await redis('HSET', MEDIA_KEY, rec.id, JSON.stringify(next))
}
console.log(`\n✓ wrote ${results.length} place name(s)`)
