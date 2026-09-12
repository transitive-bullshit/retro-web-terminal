import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { defineConfig } from 'tsdown'

const require = createRequire(import.meta.url)

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  dts: { sourcemap: true },
  clean: true,
  sourcemap: true,
  deps: { neverBundle: [/^react(?:\/|$)/] },
  hooks: {
    'build:done': async () => {
      const [terminalStyles, componentStyles] = await Promise.all([
        readFile(require.resolve('@xterm/xterm/css/xterm.css'), 'utf8'),
        readFile(new URL('./src/styles.css', import.meta.url), 'utf8')
      ])
      const styles = componentStyles.replace(
        /@import\s+['"]@xterm\/xterm\/css\/xterm\.css['"];?\s*/,
        ''
      )
      await writeFile(
        new URL('./dist/styles.css', import.meta.url),
        `${terminalStyles}\n${styles}`
      )
      await copyFile(
        new URL('../../license', import.meta.url),
        new URL('./dist/license', import.meta.url)
      )
    }
  }
})
