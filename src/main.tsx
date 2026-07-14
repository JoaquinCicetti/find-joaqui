import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource-variable/manrope/index.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/global.css'
import App from './App.tsx'

// No StrictMode: MapLibre and Photo Sphere Viewer manage WebGL contexts
// imperatively and break under StrictMode's double-mounted effects in dev.
createRoot(document.getElementById('root')!).render(<App />)
