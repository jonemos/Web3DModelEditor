import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  plugins: [
    react(),
  // 개발/프리뷰 HTTPS를 위한 로컬 인증서 자동 생성
  mkcert(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,ktx2,wasm}'],
        runtimeCaching: [
          // 네비게이션 요청 오프라인 폴백
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              networkTimeoutSeconds: 3,
              // 참고: 오프라인 전용 페이지는 앱 레벨 라우팅으로 처리하거나,
              // 별도 커스텀 SW를 사용하는 경우에만 명시적으로 핸들링하세요.
            }
          },
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
  target: 'es2019',
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 외부 벤더 청크 분리
          if (id.includes('/node_modules/three/')) return 'three'
          if (id.includes('/node_modules/three-stdlib/')) return 'three-stdlib'
          if (id.includes('/node_modules/react-router-dom/')) return 'router'
          if (id.includes('/node_modules/react/')) return 'react-vendor'
          if (id.includes('/node_modules/react-dom/')) return 'react-vendor'
          if (id.includes('/node_modules/zustand/')) return 'state'
          // 에디터 전용 코드: 에디터 라우트 청크로 묶기
          if (id.includes('/src/components/editor/')) return 'editor'
          if (id.includes('/src/utils/GLBMeshManager')) return 'editor'
          return undefined
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
