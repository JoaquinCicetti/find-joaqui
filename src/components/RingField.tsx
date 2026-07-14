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
