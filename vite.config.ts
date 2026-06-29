import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/SpecialPro/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          if (id.includes('/src/pages/')) return 'pages'
          if (id.includes('/src/services/')) return 'services'
          if (id.includes('/src/components/')) return 'components'
          return undefined
        },
      },
    },
  },
})
