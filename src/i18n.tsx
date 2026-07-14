import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'es' | 'en'

interface GameDict {
  cta: string
  best: (n: number) => string
  introTitle: string
  introBody: (n: number) => string
  how1: string
  how2: string
  how3: string
  start: string
  later: string
  round: (a: number, b: number) => string
  tapHint: string
  adjustHint: string
  confirm: string
  found: string
  away360: (deg: string) => string
  awayPhoto: (pct: string) => string
  points: (n: number) => string
  next: string
  results: string
  total: string
  namePh: string
  save: string
  saving: string
  savedLocal: string
  board: string
  again: string
  close: string
}

interface Dict {
  taglineA: string
  taglineB: string
  sub: (n: number, places: number, countries: number) => string
  pano: string
  photo: string
  nItems: (n: number) => string
  enter: string
  viewPhoto: string
  closeCard: string
  closeViewer: string
  view360: string
  viewPhotoAria: string
  footer: string
  g: GameDict
}

const dictionaries: Record<Lang, Dict> = {
  es: {
    taglineA: 'Buscando',
    taglineB: 'al Joaqui.',
    sub: (n, places, countries) =>
      `Me escondí en ${n} fotos aéreas en 360°, por ${places} rincones de ${countries} países. Girá el globo y encontrame.`,
    pano: 'Panorámica 360°',
    photo: 'Fotografía',
    nItems: (n) => `${n} panorámicas`,
    enter: 'Entrar en la esfera',
    viewPhoto: 'Ver fotografía',
    closeCard: 'Cerrar tarjeta',
    closeViewer: 'Cerrar visor',
    view360: 'Vista 360°',
    viewPhotoAria: 'Fotografía',
    footer: '© 2026 Joaquín Cicetti',
    g: {
      cta: 'Jugá a encontrarme',
      best: (n) => `Récord: ${n}`,
      introTitle: 'Buscando al Joaqui',
      introBody: (n) =>
        `Estoy escondido en ${n} fotos, al mejor estilo ¿Dónde está Wally? ¿Me encontrás?`,
      how1: 'Recorré la escena: girá y hacé zoom',
      how2: 'Tocá justo donde creas que estoy',
      how3: 'Cuanto más cerca, más puntos (hasta 1000 por ronda)',
      start: 'Jugar',
      later: 'Ahora no',
      round: (a, b) => `Ronda ${a} de ${b}`,
      tapHint: 'Tocá donde creas que estoy',
      adjustHint: 'Afiná el punto y confirmá',
      confirm: 'Confirmar',
      found: '¡Me encontraste!',
      away360: (deg) => `Le pifiaste por ${deg}°`,
      awayPhoto: (pct) => `Le pifiaste por un ${pct}% del cuadro`,
      points: (n) => `+${n} puntos`,
      next: 'Siguiente',
      results: '¿Cómo te fue?',
      total: 'Puntaje final',
      namePh: 'Tu nombre',
      save: 'Guardar puntaje',
      saving: 'Guardando…',
      savedLocal: 'Sin conexión: quedó guardado en este dispositivo',
      board: 'Ranking',
      again: 'Jugar de nuevo',
      close: 'Cerrar',
    },
  },
  en: {
    taglineA: 'Finding',
    taglineB: 'Joaqui.',
    sub: (n, places, countries) =>
      `I hid in ${n} aerial 360° shots, across ${places} corners of ${countries} countries. Spin the globe and find me.`,
    pano: '360° panorama',
    photo: 'Photograph',
    nItems: (n) => `${n} panoramas`,
    enter: 'Step inside',
    viewPhoto: 'View photograph',
    closeCard: 'Close location card',
    closeViewer: 'Close viewer',
    view360: '360° view',
    viewPhotoAria: 'Photograph',
    footer: '© 2026 Joaquín Cicetti',
    g: {
      cta: 'Play: find me',
      best: (n) => `Best: ${n}`,
      introTitle: 'Finding Joaqui',
      introBody: (n) =>
        `I'm hiding in ${n} of these shots, Where's-Wally style. Can you spot me?`,
      how1: 'Explore the scene: pan and zoom around',
      how2: 'Tap the exact spot where you think I am',
      how3: 'The closer you get, the more points (up to 1000 per round)',
      start: 'Play',
      later: 'Not now',
      round: (a, b) => `Round ${a} of ${b}`,
      tapHint: 'Tap where you think I am',
      adjustHint: 'Fine-tune the spot, then confirm',
      confirm: 'Lock it in',
      found: 'You found me!',
      away360: (deg) => `You missed me by ${deg}°`,
      awayPhoto: (pct) => `You missed me by ${pct}% of the frame`,
      points: (n) => `+${n} points`,
      next: 'Next',
      results: 'How did you do?',
      total: 'Final score',
      namePh: 'Your name',
      save: 'Save score',
      saving: 'Saving…',
      savedLocal: 'Offline: saved on this device',
      board: 'Leaderboard',
      again: 'Play again',
      close: 'Close',
    },
  },
}

// Spanish is the default; English only when the browser asks for it.
// For any other language the page stays translatable (lang attr is kept
// accurate and nothing is marked translate="no"), so browsers offer
// their own automatic translation.
function detectLang(): Lang {
  const saved = localStorage.getItem('lang')
  if (saved === 'es' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

const LangContext = createContext<{
  lang: Lang
  t: Dict
  setLang: (l: Lang) => void
}>({ lang: 'es', t: dictionaries.es, setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
    localStorage.setItem('lang', lang)
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, t: dictionaries[lang], setLang }}>
      {children}
    </LangContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  return useContext(LangContext)
}

const COUNTRIES_ES: Record<string, string> = {
  Spain: 'España',
  Switzerland: 'Suiza',
  Germany: 'Alemania',
  Brazil: 'Brasil',
  Greece: 'Grecia',
  Poland: 'Polonia',
  Italy: 'Italia',
  'United Kingdom': 'Reino Unido',
  Croatia: 'Croacia',
}

/** Country names are stored in English; localize for display. */
export function countryName(country: string, lang: Lang): string {
  return lang === 'es' ? (COUNTRIES_ES[country] ?? country) : country
}

/** "2022-08" → "ago 2022" / "Aug 2022" */
export function formatDate(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1))
}
