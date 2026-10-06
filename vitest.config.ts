import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: {
    include: [
      'shared/core/**/*.test.ts',
      'worker/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    environment: 'node',
  },
})
