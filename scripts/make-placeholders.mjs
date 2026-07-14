// Generates placeholder equirectangular panoramas + thumbnails into public/panos/.
// Zero dependencies (hand-rolled PNG encoder). Replace the output files with
// real 360° photos whenever you like — the site only cares about the paths.
//
//   node scripts/make-placeholders.mjs

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------- minimal PNG encoder ----------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0 // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- scene painter ----------
const lerp = (a, b, t) => a + (b - a) * t
const mixColor = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]

/**
 * Paint one pixel of a fake landscape.
 * u: horizontal [0,1) wraps 360°, v: vertical [0,1), horizon at v = 0.5.
 */
function scenePixel(u, v, p) {
  const TAU = Math.PI * 2
  const amp = p.ridgeScale ?? 1
  // mountain ridge above the horizon, periodic in u so the seam is invisible
  const ridge =
    0.5 -
    amp *
      (0.05 +
        0.035 * Math.sin(TAU * (u * 3 + p.seed)) +
        0.022 * Math.sin(TAU * (u * 7 + p.seed * 2)) +
        0.012 * Math.sin(TAU * (u * 13 + p.seed * 3)))

  let c
  if (v < ridge) {
    c = mixColor(p.skyTop, p.skyHorizon, Math.pow(v / ridge, 1.4))
    // sun disc with a soft halo
    const du = Math.min(Math.abs(u - p.sunU), 1 - Math.abs(u - p.sunU)) * 2
    const dv = (v - p.sunV) * 1.1
    const d = Math.sqrt(du * du + dv * dv)
    if (d < 0.055) c = p.sun
    else if (d < 0.16) c = mixColor(c, p.sun, (0.16 - d) / 0.105 * 0.45)
    // faint meridian ticks every 30° so panning is perceptible (360° only)
    if (!p.noTicks) {
      const tick = Math.abs((u * 12) % 1)
      if (tick < 0.004 || tick > 0.996) c = mixColor(c, [255, 255, 255], 0.18)
    }
  } else if (v < 0.5) {
    c = mixColor(p.mountain, p.skyHorizon, (v - ridge) / (0.5 - ridge) * 0.35)
  } else {
    c = mixColor(p.groundNear, p.groundFar, Math.pow((v - 0.5) / 0.5, 0.8))
  }
  return c
}

function paint(width, height, palette, window_) {
  const [u0, u1, v0, v1] = window_ ?? [0, 1, 0, 1]
  const rgb = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    const v = v0 + (v1 - v0) * (y / height)
    for (let x = 0; x < width; x++) {
      const u = (u0 + (u1 - u0) * (x / width)) % 1
      const [r, g, b] = scenePixel(u, v, palette)
      const i = (y * width + x) * 3
      rgb[i] = r
      rgb[i + 1] = g
      rgb[i + 2] = b
    }
  }
  return rgb
}

// ---------- per-location palettes ----------
const scenes = {
  'buenos-aires-obelisco': {
    skyTop: [58, 48, 94], skyHorizon: [242, 158, 110], sun: [255, 214, 170],
    sunU: 0.62, sunV: 0.42, mountain: [70, 58, 88],
    groundNear: [120, 100, 110], groundFar: [52, 44, 62], seed: 0.13,
  },
  'machu-picchu': {
    skyTop: [140, 170, 190], skyHorizon: [214, 226, 220], sun: [255, 250, 235],
    sunU: 0.3, sunV: 0.3, mountain: [72, 104, 84],
    groundNear: [110, 140, 100], groundFar: [58, 80, 60], seed: 0.47,
  },
  'tokyo-shibuya': {
    skyTop: [16, 20, 42], skyHorizon: [90, 70, 130], sun: [230, 240, 255],
    sunU: 0.8, sunV: 0.34, mountain: [38, 36, 66],
    groundNear: [88, 78, 128], groundFar: [24, 22, 44], seed: 0.71,
  },
  'rome-colosseum': {
    skyTop: [112, 150, 196], skyHorizon: [238, 210, 160], sun: [255, 240, 200],
    sunU: 0.45, sunV: 0.38, mountain: [150, 122, 92],
    groundNear: [190, 160, 120], groundFar: [110, 88, 66], seed: 0.29,
  },
  'iceland-kirkjufell': {
    skyTop: [170, 190, 214], skyHorizon: [250, 214, 190], sun: [255, 236, 210],
    sunU: 0.55, sunV: 0.46, mountain: [86, 96, 116],
    groundNear: [120, 134, 130], groundFar: [70, 82, 88], seed: 0.85,
  },
  'cape-town-table-mountain': {
    skyTop: [92, 150, 208], skyHorizon: [210, 226, 236], sun: [255, 252, 240],
    sunU: 0.2, sunV: 0.32, mountain: [104, 96, 88],
    groundNear: [176, 158, 126], groundFar: [98, 92, 76], seed: 0.58,
  },
}

// plain HD photos (not equirectangular) — rendered as a landscape crop
const photoScenes = {
  'fitz-roy': {
    skyTop: [96, 128, 168], skyHorizon: [244, 196, 158], sun: [255, 226, 188],
    sunU: 0.42, sunV: 0.3, mountain: [64, 66, 84],
    groundNear: [140, 128, 108], groundFar: [76, 72, 66],
    seed: 0.36, ridgeScale: 2.6, noTicks: true,
  },
  'fushimi-inari': {
    skyTop: [173, 58, 34], skyHorizon: [235, 138, 68], sun: [255, 214, 150],
    sunU: 0.5, sunV: 0.34, mountain: [96, 40, 30],
    groundNear: [150, 66, 44], groundFar: [70, 30, 24],
    seed: 0.64, ridgeScale: 1.6, noTicks: true,
  },
}

const panoDir = join(root, 'public', 'panos')
const thumbDir = join(panoDir, 'thumbs')
const photoDir = join(root, 'public', 'photos')
const photoThumbDir = join(photoDir, 'thumbs')
mkdirSync(thumbDir, { recursive: true })
mkdirSync(photoThumbDir, { recursive: true })

for (const [id, palette] of Object.entries(scenes)) {
  writeFileSync(
    join(panoDir, `${id}.png`),
    encodePng(2048, 1024, paint(2048, 1024, palette)),
  )
  // thumbnail: a landscape crop around the sun, like a framed photo
  const u0 = (palette.sunU - 0.2 + 1) % 1
  writeFileSync(
    join(thumbDir, `${id}.png`),
    encodePng(480, 300, paint(480, 300, palette, [u0, u0 + 0.4, 0.18, 0.82])),
  )
  console.log(`✓ ${id}`)
}
for (const [id, palette] of Object.entries(photoScenes)) {
  const window_ = [0.25, 0.72, 0.08, 0.86]
  writeFileSync(
    join(photoDir, `${id}.png`),
    encodePng(1600, 1000, paint(1600, 1000, palette, window_)),
  )
  writeFileSync(
    join(photoThumbDir, `${id}.png`),
    encodePng(480, 300, paint(480, 300, palette, window_)),
  )
  console.log(`✓ ${id} (photo)`)
}
console.log('Placeholders written to public/panos/ and public/photos/')
