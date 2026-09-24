import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// DotaDex - Vite configuration.
// OpenDota's API sends permissive CORS headers (Access-Control-Allow-Origin),
// so the app talks to it directly from the browser - no backend required.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
