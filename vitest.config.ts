import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'shared/core/**/*.test.ts',
      'worker/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    environment: 'node',
  },
})
