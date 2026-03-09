import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    commonjsOptions: {
      include: [/pluggy-connect-sdk/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['pluggy-connect-sdk'],
  },
})
