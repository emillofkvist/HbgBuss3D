import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['maplibre-gl', 'deck.gl', '@deck.gl/react', '@deck.gl/layers'],
  },
  server: {
    proxy: {
      '/trafiklab': {
        target: 'https://opendata.samtrafiken.se',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/trafiklab/, ''),
      },
    },
  },
})
