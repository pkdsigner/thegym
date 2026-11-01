import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      // Local Express server that runs the same /api files Vercel will
      '/api': `http://localhost:${process.env.API_PORT || 3001}`,
    },
  },
  build: {
    chunkSizeWarningLimit: 600, // recharts alone is ~520 kB
    rollupOptions: {
      output: {
        // Keep the charts library (and only its own dependencies) out of the first page load
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](recharts|recharts-scale|react-smooth|victory-vendor|d3-[^\\/]+|lodash|decimal\.js-light|eventemitter3|internmap)[\\/]/.test(id)) return 'charts'
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion'
          return 'vendor'
        },
      },
    },
  },
})
