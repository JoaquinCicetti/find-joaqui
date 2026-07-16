// One-time migration: move the git-committed media into Vercel Blob + Upstash
// Redis so the runtime CMS (/api/media) is populated BEFORE the frontend flips
// off the static manifest. Idempotent-ish: re-running overwrites the same
// blob paths and Redis fields.
//
// Prereqs (env): BLOB_READ_WRITE_TOKEN + UPSTASH_REDIS_REST_URL/_TOKEN
// (or KV_REST_API_URL/_TOKEN). Pull them locally with `vercel env pull .env`.
//
// Run:  node --env-file=.env scripts/migrate-to-blob.mjs
//       node --env-file=.env scripts/migrate-to-blob.mjs --dry --limit 3
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { put } from '@vercel/blob'
import { Redis } from '@upstash/redis'

const ROOT = join(import.meta.dirname, '..')
const DRY = process.argv.includes('--dry')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

const MEDIA_KEY = 'joaqui:media'
const LOCATIONS_KEY = 'joaqui:locations'

const blobToken = process.env.BLOB_READ_WRITE_TOKEN
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

if (!DRY && (!blobToken || !redisUrl || !redisToken)) {
  console.error(
    'Missing env. Need BLOB_READ_WRITE_TOKEN + UPSTASH_REDIS_REST_URL/_TOKEN.\n' +
      'Try: vercel env pull .env  then  node --env-file=.env scripts/migrate-to-blob.mjs',
  )
  process.exit(1)
}

const redis =
  !DRY && redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null

/** Pull a JSON array literal out of the generated manifest.ts by bracket-matching. */
function extractArray(src, name) {
  const start = src.indexOf(`export const ${name}`)
  if (start < 0) throw new Error(`${name} not found in manifest`)
  const open = src.indexOf('[', src.indexOf('=', start))
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']' && --depth === 0)
      return JSON.parse(src.slice(open, i + 1))
  }
  throw new Error(`unterminated array for ${name}`)
}

const idOf = (file) => file.replace(/\.[^.]+$/, '')
const CT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const ctOf = (file) => CT[file.split('.').pop().toLowerCase()] ?? 'image/jpeg'

async function putFile(relPath, contentType) {
  const buf = readFileSync(join(ROOT, 'public', relPath))
  if (DRY) return `https://dry.blob/${relPath}`
  const { url } = await put(relPath, buf, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    token: blobToken,
  })
  return url
}

async function migrate() {
  const manifest = readFileSync(join(ROOT, 'src/data/manifest.ts'), 'utf8')
  const groups = [
    { records: extractArray(manifest, 'rawPanos'), kind: '360', dir: 'panos' },
    {
      records: extractArray(manifest, 'rawPhotos'),
      kind: 'photo',
      dir: 'photos',
    },
  ]

  const mediaObj = {}
  let done = 0
  let skipped = 0

  for (const { records, kind, dir } of groups) {
    for (const r of records) {
      if (done >= LIMIT) break
      if (r.lat == null || r.lng == null) {
        skipped++
        continue // no GPS → wouldn't render on the globe anyway
      }
      const id = idOf(r.file)
      try {
        const [blobUrl, thumbUrl, microUrl] = await Promise.all([
          putFile(`${dir}/${r.file}`, ctOf(r.file)),
          putFile(`${dir}/thumbs/${r.file}`, 'image/jpeg'),
          putFile(`${dir}/thumbs/micro/${r.file}`, 'image/jpeg'),
        ])
        mediaObj[id] = {
          id,
          kind,
          file: r.file,
          blobUrl,
          thumbUrl,
          microUrl,
          lat: r.lat,
          lng: r.lng,
          date: r.date,
        }
        done++
        if (done % 20 === 0) console.log(`  …${done} uploaded`)
      } catch (err) {
        console.error(`  ✗ ${r.file}: ${err.message}`)
      }
    }
  }

  const locations = JSON.parse(
    readFileSync(join(ROOT, 'src/data/joaqui-locations.json'), 'utf8'),
  )

  console.log(
    `\nPrepared ${done} media records (${skipped} skipped, no GPS), ` +
      `${Object.keys(locations).length} Joaqui locations.`,
  )

  if (DRY) {
    console.log('DRY run — nothing written to Blob or Redis.')
    return
  }

  if (Object.keys(mediaObj).length) await redis.hset(MEDIA_KEY, mediaObj)
  if (Object.keys(locations).length)
    await redis.hset(LOCATIONS_KEY, locations)
  console.log('Written to Redis. /api/media is now populated. ✓')
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
