import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    react(),
  // 개발/프리뷰 HTTPS를 위한 로컬 인증서 자동 생성
  mkcert(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,ktx2,wasm}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'model' || /\.(?:glb|gltf)$/i.test(request.url),
            handler: 'CacheFirst',
            options: {
              cacheName: 'models-glb',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              matchOptions: { ignoreSearch: true }
            }
          },
          {
            urlPattern: ({ request }) => /\.(?:ktx2)$/i.test(request.url),
            handler: 'CacheFirst',
            options: { cacheName: 'textures-ktx2', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: ({ url }) => /\/libs\/(draco|basis)\//i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'decoders', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      },
      manifest: {
        name: 'ThirdPerson TreeJS Game',
        short_name: 'TreeJS Game',
        description: 'Three.js 3인칭 게임',
        theme_color: '#2196F3',
        background_color: '#2c2c2c',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['three', 'three-stdlib', 'react', 'react-dom', 'react-router-dom', 'zustand']
  },
  server: {
    port: 3000,
    host: true,
    https: true
  },
  preview: {
    https: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // three 관련은 분리하여 캐시/초기 로드 최적화
          'three': ['three'],
          'three-stdlib': ['three-stdlib'],
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'state': ['zustand']
        }
      }
    },
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  publicDir: 'public'
})
