import type { CSSProperties } from 'react'

/** Perpetual zoom rings drifting behind the globe — pure CSS, the
 *  stagger comes from --i (see .zoom-ring in global.css). */

const RING_COUNT = 10

export function RingField() {
  return (
    <div aria-hidden className="ring-stage absolute inset-0">
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <div
          key={i}
          className={`zoom-ring zoom-ring-${i % 4}`}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </div>
  )
}

const LOADER_RING_COUNT = 6

/** The same perpetual rings, saturated and fast — shown while a
 *  panorama or photo is loading (replaces PSV's progress spinner). */
export function RingLoader() {
  return (
    <div aria-hidden className="ring-stage ring-loader absolute inset-0 z-10">
      {Array.from({ length: LOADER_RING_COUNT }, (_, i) => (
        <div
          key={i}
          className={`zoom-ring zoom-ring-${i % 4}`}
          // spread the 6 rings evenly over the 10-slot stagger scale
          style={{ '--i': (i * RING_COUNT) / LOADER_RING_COUNT } as CSSProperties}
        />
      ))}
    </div>
  )
}
