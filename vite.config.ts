import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function buildId(): string {
  const fromCi = (process.env.COMMIT_REF || '').slice(0, 7)
  if (fromCi) return fromCi
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
}

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          leaflet: ['leaflet', 'react-leaflet'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
