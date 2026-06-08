import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'PADEL — Tu liga de pádel',
        short_name: 'PADEL',
        description: 'Registra partidos, sigue tu ELO y juega ligas de pádel',
        theme_color: '#00e676',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
        categories: ['sports', 'games'],
        shortcuts: [
          {
            name: 'Nuevo Partido',
            short_name: 'Partido',
            description: 'Inicia un partido rápido',
            url: '/play',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Mi Perfil',
            short_name: 'Perfil',
            description: 'Ver mi perfil y ELO',
            url: '/profile',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'Test/tests/frontend/**/*.{test,spec}.{js,jsx}',
      'Test/tests/mcp/**/*.{test,spec}.js',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'billshock/**',
    ],
    setupFiles: ['./Test/tests/frontend/setup.js'],
  },
  build: {
    outDir: 'dist',
    // Split vendor code so repeat visitors don't re-download React/Supabase/Motion
    // every deploy. Kenji §1.1 → projected entry chunk ~80 KB gz (vs 165 KB today).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom') || id.includes('/node_modules/react-router-dom')) {
            return 'vendor-react'
          }
          if (id.includes('/node_modules/@supabase/supabase-js')) {
            return 'vendor-supabase'
          }
          if (id.includes('/node_modules/framer-motion')) {
            return 'vendor-motion'
          }
          if (id.includes('/node_modules/zustand')) {
            return 'vendor-state'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
