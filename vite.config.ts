import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

const isDesktopBuild = process.env.DESKTOP_BUILD === '1'
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    TanStackRouterVite(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: isDesktopBuild ? false : 'auto',
      selfDestroying: isDesktopBuild,
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${basePath}index.html`,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'HospitalRun',
        short_name: 'HospitalRun',
        description: 'Offline-first hospital management system',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: basePath,
        scope: basePath,
        icons: [
          { src: `${basePath}pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${basePath}pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${basePath}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: isDesktopBuild ? '0.0.0.0' : 'localhost',
    port: 5173,
    strictPort: true,
  },
})
