import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'error.html'],
      manifest: {
        name: 'Asicme Chat',
        short_name: 'Asicme',
        description: 'Secure, modern, and lightning-fast chat',
        theme_color: '#111b21',
        background_color: '#111b21',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5000000 // 5MB para acomodar bundles grandes si es necesario
      }
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@livekit/') || id.includes('node_modules/livekit-client/')) {
              return 'vendor-livekit';
            }
            if (id.includes('node_modules/emoji-picker-react/')) {
              return 'vendor-emoji';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react-window', 'zustand', 'framer-motion'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
})
