import { rawPanos, rawPhotos, type RawMedia } from './manifest'

export type MediaKind = '360' | 'photo'

export interface MediaItem {
  id: string
  kind: MediaKind
  title: string
  place: string
  country: string
  /** [longitude, latitude] */
  coords: [number, number]
  /** YYYY-MM */
  date: string
  src: string
  thumb: string
  /** tiny thumb rendered inside the map marker */
  micro: string
}

/** Prefix a public/ asset with the deploy base path (GH Pages serves under /<repo>/). */
export const asset = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

/**
 * Named places, matched to each image's GPS point by distance.
 * Add an entry when you shoot somewhere new — radius is in km.
 */
const PLACES: {
  place: string
  country: string
  at: [number, number] // [lat, lng]
  radius: number
}[] = [
  { place: 'Barcelona', country: 'Spain', at: [41.384, 2.198], radius: 15 },
  { place: 'Guadix, Granada', country: 'Spain', at: [37.297, -3.127], radius: 25 },
  { place: 'Zug', country: 'Switzerland', at: [47.12, 8.53], radius: 25 },
  { place: 'Arth-Goldau', country: 'Switzerland', at: [47.05, 8.55], radius: 10 },
  { place: 'Cologne', country: 'Germany', at: [50.9, 6.93], radius: 30 },
  { place: 'Brühl', country: 'Germany', at: [50.83, 6.87], radius: 8 },
  { place: 'Rosario', country: 'Argentina', at: [-32.94, -60.64], radius: 20 },
  { place: 'Delta del Paraná', country: 'Argentina', at: [-32.62, -60.12], radius: 25 },
  { place: 'Valle de Uco, Mendoza', country: 'Argentina', at: [-33.615, -69.118], radius: 30 },
  { place: 'Landeta, Santa Fe', country: 'Argentina', at: [-32.01, -62.06], radius: 30 },
  { place: 'Bariloche', country: 'Argentina', at: [-41.2, -71.45], radius: 45 },
  { place: 'Villa Mascardi', country: 'Argentina', at: [-41.35, -71.52], radius: 12 },
  { place: 'Villa Traful', country: 'Argentina', at: [-40.783, -71.657], radius: 20 },
  { place: 'Lago Lácar, San Martín de los Andes', country: 'Argentina', at: [-40.13, -71.66], radius: 25 },
  { place: 'Alpa Corral, Córdoba', country: 'Argentina', at: [-32.68, -64.73], radius: 30 },
  { place: 'Arujá, São Paulo', country: 'Brazil', at: [-23.4, -46.33], radius: 30 },
  { place: 'Rio de Janeiro', country: 'Brazil', at: [-22.978, -43.215], radius: 25 },
  { place: 'Praia do Francês, Alagoas', country: 'Brazil', at: [-9.772, -35.843], radius: 20 },
  { place: 'Porto de Galinhas', country: 'Brazil', at: [-8.511, -35.0], radius: 20 },
  { place: 'San Sebastián', country: 'Spain', at: [43.324, -1.99], radius: 15 },
  { place: 'Gijón', country: 'Spain', at: [43.55, -5.62], radius: 15 },
  { place: 'Formentera', country: 'Spain', at: [38.7, 1.455], radius: 12 },
  { place: 'Mykonos', country: 'Greece', at: [37.48, 25.38], radius: 15 },
  { place: 'Athens', country: 'Greece', at: [37.975, 23.722], radius: 15 },
  { place: 'Pangalengan, Java', country: 'Indonesia', at: [-7.233, 107.535], radius: 25 },
  { place: 'Labuan Bajo, Flores', country: 'Indonesia', at: [-8.47, 119.92], radius: 18 },
  { place: 'Tanjung Boleng, Flores', country: 'Indonesia', at: [-8.432, 119.963], radius: 8 },
  { place: 'Komodo', country: 'Indonesia', at: [-8.62, 119.56], radius: 25 },
  { place: 'Tegallalang, Bali', country: 'Indonesia', at: [-8.47, 115.27], radius: 15 },
  { place: 'Sintra', country: 'Portugal', at: [38.788, -9.388], radius: 15 },
  { place: 'Kraków', country: 'Poland', at: [50.03, 19.91], radius: 15 },
  { place: 'Turin', country: 'Italy', at: [45.055, 7.689], radius: 15 },
  { place: 'Manchester', country: 'United Kingdom', at: [53.49, -2.23], radius: 15 },
  { place: 'Kotor', country: 'Montenegro', at: [42.46, 18.73], radius: 15 },
  { place: 'Tisno, Murter', country: 'Croatia', at: [43.8, 15.64], radius: 25 },
  { place: 'Istanbul', country: 'Turkey', at: [41.025, 28.975], radius: 20 },
  { place: 'Mar del Plata', country: 'Argentina', at: [-38.021, -57.54], radius: 15 },
  { place: 'Piriápolis', country: 'Uruguay', at: [-34.894, -55.253], radius: 15 },
  { place: 'Granada', country: 'Spain', at: [37.172, -3.591], radius: 12 },
  { place: 'Zürich', country: 'Switzerland', at: [47.358, 8.536], radius: 12 },
  { place: 'Porto', country: 'Portugal', at: [41.143, -8.605], radius: 12 },
]

function haversineKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad
  const dLng = (b[1] - a[1]) * rad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(s))
}

function locate(lat: number, lng: number) {
  let best: (typeof PLACES)[number] | null = null
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

function toItems(raw: RawMedia[], kind: MediaKind, dir: string): MediaItem[] {
  return raw
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => {
      const found = locate(r.lat!, r.lng!)
      return {
        id: r.file.replace(/\.[^.]+$/, ''),
        kind,
        title: found?.place ?? `${r.lat!.toFixed(2)}, ${r.lng!.toFixed(2)}`,
        place: found?.place ?? 'Unknown place',
        country: found?.country ?? '',
        coords: [r.lng!, r.lat!] as [number, number],
        date: r.date,
        src: `${dir}/${r.file}`,
        thumb: `${dir}/thumbs/${r.file}`,
        micro: `${dir}/thumbs/micro/${r.file}`,
      }
    })
}

export const media: MediaItem[] = [
  ...toItems(rawPanos, '360', 'panos'),
  ...toItems(rawPhotos, 'photo', 'photos'),
]

/** One marker on the globe = one spot; several shots of a place stack into it. */
export interface Spot {
  id: string
  place: string
  country: string
  /** centroid [lng, lat] of its items */
  coords: [number, number]
  /** chronological */
  items: MediaItem[]
}

export const spots: Spot[] = (() => {
  const groups = new Map<string, MediaItem[]>()
  for (const m of media) {
    // unmatched places group by rounded coords so distinct unknowns stay apart
    const key =
      m.place === 'Unknown place'
        ? `${m.coords[1].toFixed(2)},${m.coords[0].toFixed(2)}`
        : m.place
    const list = groups.get(key)
    if (list) list.push(m)
    else groups.set(key, [m])
  }
  return [...groups.entries()].map(([key, items]) => {
    items.sort((a, b) => a.date.localeCompare(b.date))
    const lng = items.reduce((s, i) => s + i.coords[0], 0) / items.length
    const lat = items.reduce((s, i) => s + i.coords[1], 0) / items.length
    return {
      id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      place: items[0].place,
      country: items[0].country,
      coords: [lng, lat] as [number, number],
      items,
    }
  })
})()

export const placeCount = new Set(media.map((m) => m.place)).size
export const countryCount = new Set(
  media.map((m) => m.country).filter(Boolean),
).size

export function formatCoords([lng, lat]: [number, number]): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns} · ${Math.abs(lng).toFixed(4)}° ${ew}`
}
