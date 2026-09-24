import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Under plain `vite` the serverless routes don't exist; read them from
    // production so the globe has a library. GET only — a local run must never
    // write to the live leaderboard or blob store.
    proxy: {
      '/api': {
        target: 'https://find-joaqui.vercel.app',
        changeOrigin: true,
        bypass: (req) => (req.method === 'GET' ? undefined : false),
      },
      // the image optimizer, for VITE_OPTIMIZED_IMAGES=1 (see displaySrc)
      '/_vercel/image': {
        target: 'https://find-joaqui.vercel.app',
        changeOrigin: true,
      },
    },
  },
})
