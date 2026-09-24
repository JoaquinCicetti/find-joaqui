import { BotAvatar, botAvatarTypes, type BotAvatarState } from 'bot-avatars'

/**
 * A bot avatar (libraries.dev/avatars) chosen deterministically from a player
 * name. Names are the leaderboard's only identity, so the hash *is* the
 * avatar: the same name gets the same bot on the intro panel, the results
 * panel and /scoring, with nothing stored anywhere.
 */

/** FNV-1a over the normalised name — stable across sessions and devices. */
export function hashName(name: string): number {
  const s = name.trim().toLowerCase().normalize('NFKC')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

interface PlayerAvatarProps {
  name: string
  /** CSS px */
  size?: number
  state?: BotAvatarState
  /** eyes and head follow the pointer; a click makes it hop */
  interactive?: boolean
  className?: string
}

export function PlayerAvatar({
  name,
  size = 28,
  state = 'default',
  interactive = true,
  className,
}: PlayerAvatarProps) {
  const h = hashName(name)
  const type = botAvatarTypes[h % botAvatarTypes.length]
  const face = (h >>> 5) & 1 ? 'mouth' : 'eyes'
  const seed = ((h >>> 8) & 0xffff) / 0xffff
  const brightness = 0.92 + (((h >>> 24) & 0xf) / 0xf) * 0.16
  return (
    <BotAvatar
      // the lib seeds blink/glance timing from the instance id; key it on the
      // name so a re-render never re-rolls the same player's rhythm
      key={type}
      aria-hidden
      type={type}
      face={face}
      state={state}
      size={size}
      seed={seed}
      brightness={brightness}
      interactive={interactive}
      theme="dark"
      // calm idle: the rankings are read, not watched — a hop now and then
      turn={0.6}
      jumpEvery={14}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}
