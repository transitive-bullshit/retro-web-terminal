import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'retro-web-terminal': fileURLToPath(
        new URL('./packages/retro-terminal/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node'
  }
})
