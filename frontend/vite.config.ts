import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
      '/ws/notifications': {
        target: 'http://api:8000',
        ws: true,
        rewrite: (path) => path.replace(/^\/ws\/notifications/, '/api/v1/ws/notifications')
      },
      '/ws/stylist': {
        target: 'http://api:8000',
        ws: true,
        rewrite: (path) => path.replace(/^\/ws\/stylist/, '/api/v1/stylist')
      },
      '/media': {
        target: 'http://nginx:80',
        changeOrigin: true,
      }
    }
  }
})
