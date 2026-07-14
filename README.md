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

The scores API (`api/scores.ts`) only runs under Vercel. For full-stack local
dev use `vercel dev`; with plain `pnpm dev` the game gracefully falls back to
localStorage scoring.

## Place Joaqui (calibration mode)

Open the site with `?calibrate` (e.g. `http://localhost:5173/?calibrate`):

1. Step through every shot (arrow keys or the dropdown).
2. Click the exact spot where Joaqui hides — 360° panos store viewer angles
   (yaw/pitch), photos store normalized x/y.
3. Placements are saved as drafts in your browser's localStorage.
4. When done, **Descargar JSON** and replace `src/data/joaqui-locations.json`
   with the file, then commit. Only shots present in that JSON are playable.

## Deploy (Vercel)

1. Import the repo in Vercel — Vite is auto-detected, no config needed.
2. Add **Upstash Redis** from the Vercel Marketplace (Storage tab) so the
   leaderboard persists. The function accepts either `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
3. Without Redis the API returns 503 and clients fall back to local scores.

## Add images

1. Drop 360° equirectangular JPGs in `public/panos/`, or plain HD photos in
   `public/photos/`. They must have GPS EXIF (DJI panos do).
2. Run `node scripts/sync-media.mjs` (macOS) — it reads GPS + date from each
   file, generates thumbnails, and rewrites `src/data/manifest.ts`.
3. If you shot somewhere new, add the place name to the `PLACES` list in
   `src/data/panoramas.ts` — images are matched to places by distance.
4. Hide Joaqui in the new shots via `?calibrate`.

## Brand

All colors live in `src/styles/global.css` under `@theme` — change
`--color-accent` (and its `-deep` / `-soft` variants) to re-skin.

## Stack

- Vite + React + TypeScript, Tailwind CSS v4
- MapLibre GL JS (globe projection) + OpenFreeMap vector tiles — no API keys
- @photo-sphere-viewer/core + markers-plugin for the 360° stages (lazy-loaded)
- Vercel serverless function + Upstash Redis for the leaderboard
- Fraunces (display serif) · Manrope (UI) · IBM Plex Mono (coordinates)
