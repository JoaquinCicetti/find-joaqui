import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { asset, spots, type MediaItem, type Spot } from '../data/panoramas'
import { countryName, formatDate, useLang, type Lang } from '../i18n'
import { LocationCard } from './LocationCard'

// Solid two-tone globe: dark land, deep-blue water. No labels, no lines.
// The sky block draws a soft atmospheric halo that hugs the globe's rim
// (and fades out as you zoom in) — planet, not videogame map.
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  sky: {
    'sky-color': '#0b1424',
    'horizon-color': '#3a66c4',
    'fog-color': '#0e1116',
    'sky-horizon-blend': 0.7,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.85,
    'atmosphere-blend': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0,
      0.8,
      4,
      0.35,
      7,
      0,
    ],
  },
  layers: [
    {
      id: 'land',
      type: 'background',
      paint: { 'background-color': '#1d242f' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'ofm',
      'source-layer': 'water',
      paint: { 'fill-color': '#122e63' },
    },
  ],
}

const ROTATE_DEG_PER_FRAME = 0.02
const SNAP_RADIUS_PX = 140

interface GlobeMapProps {
  selected: Spot | null
  active: MediaItem | null
  onSelect: (spot: Spot | null) => void
  onChangeActive: (item: MediaItem) => void
  onView: (item: MediaItem) => void
}

export function GlobeMap({
  selected,
  active,
  onSelect,
  onChangeActive,
  onView,
}: GlobeMapProps) {
  const { t, lang } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, HTMLElement>>(new Map())
  const interactedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const langRef = useRef<Lang>(lang)
  langRef.current = lang
  const nItemsRef = useRef(t.nItems)
  nItemsRef.current = t.nItems

  // proximity auto-hover machinery (imperative — runs on every mousemove)
  const nearRef = useRef<Spot | null>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const labelNameRef = useRef<HTMLParagraphElement>(null)
  const labelMetaRef = useRef<HTMLParagraphElement>(null)
  const lineRef = useRef<SVGLineElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-30, 15],
      zoom: reducedMotion ? 1.7 : 0.9,
      minZoom: 0.8,
      maxZoom: 9,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
    })

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    )

    for (const spot of spots) {
      const cover = spot.items[spot.items.length - 1]
      const el = document.createElement('div')
      el.className =
        cover.kind === 'photo' ? 'geo-marker geo-marker--photo' : 'geo-marker'
      if (spot.items.length > 1) {
        el.classList.add('geo-marker--stack')
        el.setAttribute('data-count', String(spot.items.length))
      }
      el.style.backgroundImage = `url(${asset(cover.micro)})`
      el.setAttribute('role', 'button')
      el.setAttribute('tabindex', '0')
      const select = (e: Event) => {
        e.stopPropagation()
        interactedRef.current = true
        onSelectRef.current(spot)
      }
      el.addEventListener('click', select)
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') select(e)
      })
      new maplibregl.Marker({ element: el }).setLngLat(spot.coords).addTo(map)
      markersRef.current.set(spot.id, el)
    }

    // ---- nearest-spot snapping: highlight + cursor→point line + label ----
    const container = containerRef.current
    let cursor: { x: number; y: number } | null = null
    let nearRaf = 0

    const clearNear = () => {
      nearRef.current = null
      for (const el of markersRef.current.values())
        el.classList.remove('is-near')
      if (labelRef.current) labelRef.current.style.opacity = '0'
      if (lineRef.current) lineRef.current.style.opacity = '0'
    }

    const updateNear = () => {
      nearRaf = 0
      if (!cursor) return clearNear()

      let best: { spot: Spot; p: maplibregl.Point } | null = null
      let bestD = SNAP_RADIUS_PX
      for (const spot of spots) {
        const el = markersRef.current.get(spot.id)
        if (!el) continue
        // markers on the far side of the globe are faded out by MapLibre
        const op = el.style.opacity
        if (op !== '' && parseFloat(op) < 0.5) continue
        const p = map.project(spot.coords)
        const d = Math.hypot(p.x - cursor.x, p.y - cursor.y)
        if (d < bestD) {
          bestD = d
          best = { spot, p }
        }
      }

      if (!best) return clearNear()

      nearRef.current = best.spot
      for (const [id, el] of markersRef.current)
        el.classList.toggle('is-near', id === best.spot.id)

      const label = labelRef.current
      const line = lineRef.current
      if (!label || !line) return

      const { spot, p } = best
      const l = langRef.current
      const latest = spot.items[spot.items.length - 1]
      if (labelNameRef.current) labelNameRef.current.textContent = spot.place
      if (labelMetaRef.current)
        labelMetaRef.current.textContent = `${
          spot.country ? `${countryName(spot.country, l)} · ` : ''
        }${
          spot.items.length > 1
            ? nItemsRef.current(spot.items.length)
            : formatDate(latest.date, l)
        }`

      // the line runs from the cursor to the point; the label rides the cursor
      const flip = cursor.x > container.clientWidth - 260
      const ax = cursor.x + (flip ? -18 : 18)
      const ay = cursor.y + (cursor.y < 90 ? 34 : -30)
      label.style.opacity = '1'
      label.style.transform = `translate(${ax}px, ${ay}px) translate(${
        flip ? '-100%' : '0'
      }, -50%)`
      label.style.textAlign = flip ? 'right' : 'left'
      // stop the line at the marker's edge, not its center
      const dx = p.x - cursor.x
      const dy = p.y - cursor.y
      const dist = Math.hypot(dx, dy) || 1
      const edge = 30 // ≈ enlarged marker radius
      line.style.opacity = dist < edge + 6 ? '0' : '1'
      line.setAttribute('x1', String(cursor.x))
      line.setAttribute('y1', String(cursor.y))
      line.setAttribute('x2', String(p.x - (dx / dist) * edge))
      line.setAttribute('y2', String(p.y - (dy / dist) * edge))
    }

    const scheduleNear = () => {
      if (!nearRaf) nearRaf = requestAnimationFrame(updateNear)
    }
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      scheduleNear()
    }
    const onMouseLeave = () => {
      cursor = null
      clearNear()
    }
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    map.on('move', scheduleNear)

    // clicking anywhere while a spot is snapped selects it — huge hit target
    map.on('click', () => {
      if (nearRef.current) {
        interactedRef.current = true
        onSelectRef.current(nearRef.current)
      }
    })

    const stopRotation = () => {
      interactedRef.current = true
    }
    map.on('mousedown', stopRotation)
    map.on('wheel', stopRotation)
    map.on('touchstart', stopRotation)

    // slow idle spin until the visitor takes over
    let raf = 0
    const spin = () => {
      if (!interactedRef.current) {
        const c = map.getCenter()
        map.setCenter([c.lng + ROTATE_DEG_PER_FRAME, c.lat])
      }
      raf = requestAnimationFrame(spin)
    }

    // intro: drift in from space, then hand over to the idle spin
    if (!reducedMotion) {
      map.on('load', () => {
        map.easeTo({
          zoom: 1.7,
          duration: 2800,
          easing: (x) => 1 - Math.pow(1 - x, 3),
          essential: true,
        })
        map.once('moveend', () => {
          if (!raf) raf = requestAnimationFrame(spin)
        })
      })
    }

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(nearRaf)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // localized screen-reader labels for the markers
  useEffect(() => {
    for (const spot of spots) {
      const latest = spot.items[spot.items.length - 1]
      markersRef.current
        .get(spot.id)
        ?.setAttribute(
          'aria-label',
          `${spot.place}${spot.country ? `, ${countryName(spot.country, lang)}` : ''} · ${
            spot.items.length > 1
              ? t.nItems(spot.items.length)
              : formatDate(latest.date, lang)
          }`,
        )
    }
  }, [t, lang])

  useEffect(() => {
    for (const [id, el] of markersRef.current) {
      el.classList.toggle('is-active', id === selected?.id)
    }
    if (selected && mapRef.current) {
      mapRef.current.flyTo({
        center: selected.coords,
        zoom: 6,
        duration: 2200,
        essential: true,
      })
    }
  }, [selected])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[7] h-full w-full overflow-visible"
      >
        <line
          ref={lineRef}
          className="near-line"
          stroke="var(--color-accent-soft)"
          strokeWidth="1"
          opacity="0"
        />
      </svg>
      <div
        ref={labelRef}
        aria-hidden
        className="near-label pointer-events-none absolute top-0 left-0 z-[7] opacity-0"
      >
        <p
          ref={labelNameRef}
          className="font-display text-xl leading-tight font-medium"
        />
        <p ref={labelMetaRef} className="mt-0.5 text-xs text-ink-muted" />
      </div>
      {selected && active && (
        <LocationCard
          spot={selected}
          active={active}
          onChangeActive={onChangeActive}
          onView={() => onView(active)}
          onClose={() => onSelect(null)}
        />
      )}
    </div>
  )
}
