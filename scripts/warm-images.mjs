// Pre-generate every image the viewer will ask for, so no visitor pays the cost.
//
// Vercel's image optimizer generates each (url, width, quality) combination on
// its FIRST request: it pulls the multi-MB original out of Blob, decodes,
// resizes and re-encodes. Measured on this site: ~1.9s cold vs ~0.3s cached.
// That first request is otherwise served to a real person.
//
// New uploads warm themselves (see uploadMedia in src/lib/adminApi.ts). Run this
// after a bulk import, after changing the width/quality in displaySrc(), or if
// shots have gone untouched past the cache TTL (minimumCacheTTL in vercel.json,
// currently 31 days).
//
//   node scripts/warm-images.mjs
//   node scripts/warm-images.mjs --base https://find-joaqui-xyz.vercel.app

const argBase = process.argv.indexOf('--base')
const BASE =
  argBase > -1 ? process.argv[argBase + 1] : 'https://find-joaqui.vercel.app'

// Must match displaySrc() in src/data/panoramas.ts.
const widthFor = (kind) => (kind === '360' ? 4096 : 3840)
const QUALITY = 82

const res = await fetch(`${BASE}/api/media`)
if (!res.ok) {
  console.error(`GET ${BASE}/api/media -> ${res.status}`)
  process.exit(1)
}
const { media } = await res.json()

let cold = 0
let warm = 0
let failed = 0
let bytes = 0
const t0 = Date.now()

for (const m of media) {
  const url = `${BASE}/_vercel/image?url=${encodeURIComponent(m.blobUrl)}&w=${widthFor(m.kind)}&q=${QUALITY}`
  try {
    const r = await fetch(url, { headers: { Accept: 'image/webp,*/*' } })
    const buf = await r.arrayBuffer()
    if (!r.ok) {
      failed++
      console.warn(`  ! ${m.id}: HTTP ${r.status}`)
      continue
    }
    bytes += buf.byteLength
    if (r.headers.get('x-vercel-cache') === 'HIT') warm++
    else cold++
  } catch (e) {
    failed++
    console.warn(`  ! ${m.id}: ${e.message}`)
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`${media.length} images in ${secs}s`)
console.log(`  transformed now: ${cold}`)
console.log(`  already cached:  ${warm}`)
console.log(`  failed:          ${failed}`)
console.log(
  `  ${(bytes / 1e6).toFixed(1)} MB total, ${(bytes / media.length / 1e3).toFixed(0)} KB avg`,
)
