import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: 'retro-web-terminal/styles.css',
        replacement: fileURLToPath(
          new URL(
            '../../packages/retro-terminal/src/styles.css',
            import.meta.url
          )
        )
      },
      {
        find: /^retro-web-terminal$/,
        replacement: fileURLToPath(
          new URL('../../packages/retro-terminal/src/index.ts', import.meta.url)
        )
      }
    ],
    dedupe: ['react', 'react-dom']
  },
  server: { host: '127.0.0.1' },
  build: { target: 'es2022' }
})
