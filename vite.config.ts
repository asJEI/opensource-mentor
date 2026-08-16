import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import { rmSync } from 'node:fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    {
      name: 'remove-worker-build-secrets',
      closeBundle() {
        // The Cloudflare Vite plugin copies local dev bindings for preview.
        // They are never needed in a production/deployment artifact.
        rmSync(path.resolve(__dirname, 'dist/opensource_mentor/.dev.vars'), {
          force: true,
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    port: 5173,
    // Legacy Express proxy removed for Cloudflare PoC.
    // VPS/Docker path still uses server/ + nginx.conf unchanged.
  },
})
