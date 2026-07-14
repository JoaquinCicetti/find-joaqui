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
    taglineA: 'El mundo,',
    taglineB: 'de cerca.',
    sub: (n, places, countries) =>
      `${n} panorámicas aéreas 360° desde ${places} lugares en ${countries} países. Girá el globo, tocá un punto.`,
    pano: 'Panorámica 360°',
    photo: 'Fotografía',
    nItems: (n) => `${n} panorámicas`,
    enter: 'Entrar en la esfera →',
    viewPhoto: 'Ver fotografía →',
    closeCard: 'Cerrar tarjeta',
    closeViewer: 'Cerrar visor',
    view360: 'Vista 360°',
    viewPhotoAria: 'Fotografía',
    footer: '© 2026 Joaquín Cicetti',
    g: {
      cta: 'Encuentra al Joaqui',
      introTitle: 'Encuentra al Joaqui',
      introBody: (n) =>
        `Joaqui se escondió en ${n} de estas fotos, al estilo ¿Dónde está Wally? ¿Tenés buen ojo?`,
      how1: 'Explorá la escena: girá y hacé zoom',
      how2: 'Tocá el punto exacto donde creas que está',
      how3: 'Cuanto más cerca, más puntos (máx. 1000 por ronda)',
      start: 'Jugar',
      later: 'Ahora no',
      round: (a, b) => `Ronda ${a} de ${b}`,
      tapHint: 'Tocá la escena donde veas a Joaqui',
      adjustHint: 'Podés ajustar el punto antes de confirmar',
      confirm: 'Confirmar',
      found: '¡Lo encontraste!',
      away360: (deg) => `A ${deg}° del escondite`,
      awayPhoto: (pct) => `A ${pct}% del cuadro`,
      points: (n) => `+${n} puntos`,
      next: 'Siguiente',
      results: 'Resultado',
      total: 'Puntaje total',
      namePh: 'Tu nombre',
      save: 'Guardar puntaje',
      saving: 'Guardando…',
      savedLocal: 'Sin conexión: guardado en este dispositivo',
      board: 'Mejores puntajes',
      again: 'Jugar de nuevo',
      close: 'Cerrar',
    },
  },
  en: {
    taglineA: 'The world,',
    taglineB: 'up close.',
    sub: (n, places, countries) =>
      `${n} aerial 360° panoramas from ${places} places in ${countries} countries. Drag the globe, tap a dot.`,
    pano: '360° panorama',
    photo: 'Photograph',
    nItems: (n) => `${n} panoramas`,
    enter: 'Step inside →',
    viewPhoto: 'View photograph →',
    closeCard: 'Close location card',
    closeViewer: 'Close viewer',
    view360: '360° view',
    viewPhotoAria: 'Photograph',
    footer: '© 2026 Joaquín Cicetti',
    g: {
      cta: 'Find Joaqui',
      introTitle: 'Find Joaqui',
      introBody: (n) =>
        `Joaqui is hiding in ${n} of these shots, Where's-Wally style. Got a sharp eye?`,
      how1: 'Explore the scene: pan and zoom around',
      how2: 'Tap the exact spot where you think he is',
      how3: 'The closer you get, the more points (max 1000 per round)',
      start: 'Play',
      later: 'Not now',
      round: (a, b) => `Round ${a} of ${b}`,
      tapHint: 'Tap the scene where you spot Joaqui',
      adjustHint: 'You can adjust the spot before confirming',
      confirm: 'Lock it in',
      found: 'You found him!',
      away360: (deg) => `${deg}° off the hiding spot`,
      awayPhoto: (pct) => `${pct}% of the frame away`,
      points: (n) => `+${n} points`,
      next: 'Next',
      results: 'Results',
      total: 'Total score',
      namePh: 'Your name',
      save: 'Save score',
      saving: 'Saving…',
      savedLocal: 'Offline: saved on this device',
      board: 'Top scores',
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
