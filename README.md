# Buscando al Joaqui 🔍

A *Where's Wally?*-style game hidden inside a collection of aerial 360°
panoramas. A dark interactive globe (MapLibre GL) holds every shot; Joaqui is
hiding somewhere in each one. Players explore the panorama (Photo Sphere
Viewer), tap where they think he is, and score up to 1000 points per round by
distance — angular distance on the sphere for 360° panos, normalized image
distance for flat photos. Top scores land on a global leaderboard.

## Run locally

```bash
pnpm install
pnpm dev
```

The media and scores APIs (`api/*`) only run under Vercel. For full-stack local
dev use `vercel dev` (loads `/api` + env vars); with plain `pnpm dev` there is
no API — the globe shows the last cached library and the game falls back to
localStorage scoring.

## Runtime CMS

Media is **not** committed to git. Uploaded shots live in **Vercel Blob**;
their metadata and Joaqui's hiding spots live in **Upstash Redis**. The site
reads the whole library at runtime from `GET /api/media`, so a new upload is
live immediately with no redeploy.

### Admin (upload + place Joaqui)

Open the site with `?admin` (or `?calibrate`), then log in with `ADMIN_PASSWORD`:

1. **Subir fotos** — drag in JPEG/PNG/WebP. GPS + date are read from EXIF in the
   browser (editable, with manual entry when a shot has no GPS); thumbnails are
   generated on a canvas; original + thumb + micro upload straight to Blob.
2. **Place Joaqui** — step through shots (arrows / dropdown) and click where he
   hides. 360° panos store viewer angles (yaw/pitch), photos store normalized
   x/y. Placement saves to the server immediately (and keeps a localStorage
   draft as backup). Only placed shots are playable.
3. **Borrar foto** removes a shot's record and its blobs.
4. New places: add the name to the `PLACES` list in `src/data/panoramas.ts`
   (images are matched to places by GPS distance at runtime).

## Deploy (Vercel)

1. Import the repo in Vercel — Vite is auto-detected, no config needed.
2. Add **Upstash Redis** and a **Blob** store from the Marketplace (Storage
   tab). Redis accepts `UPSTASH_REDIS_REST_URL`/`_TOKEN` or `KV_REST_API_URL`/
   `_TOKEN`; the Blob store sets `BLOB_READ_WRITE_TOKEN` automatically.
3. Set `ADMIN_PASSWORD` (Environment Variables) — the shared secret for `?admin`.
4. Without Redis the media/scores APIs return 503 (clients fall back to the
   cached library / local scores).

### One-time migration (existing git-committed images → Blob/Redis)

Run **before** shipping the runtime read path, so `/api/media` is populated:

```bash
vercel env pull .env                       # pulls BLOB_READ_WRITE_TOKEN + Redis creds
node --env-file=.env scripts/migrate-to-blob.mjs --dry   # sanity check
node --env-file=.env scripts/migrate-to-blob.mjs         # upload + seed Redis
```

It uploads every original + existing thumbnail to Blob and writes the records +
`joaqui-locations.json` into Redis, reusing the same ids so placements carry
over. Afterwards `public/panos`, `public/photos`, `src/data/manifest.ts`,
`src/data/joaqui-locations.json`, and `scripts/sync-media.mjs` can be deleted.

## Brand

All colors live in `src/styles/global.css` under `@theme` — change
`--color-accent` (and its `-deep` / `-soft` variants) to re-skin.

## Stack

- Vite + React + TypeScript, Tailwind CSS v4
- MapLibre GL JS (globe projection) + OpenFreeMap vector tiles — no API keys
- @photo-sphere-viewer/core + markers-plugin for the 360° stages (lazy-loaded)
- Vercel serverless functions + Upstash Redis (leaderboard + media metadata)
  and Vercel Blob (image storage) — runtime CMS, admin uploads via `?admin`
- Fraunces (display serif) · Manrope (UI) · IBM Plex Mono (coordinates)
