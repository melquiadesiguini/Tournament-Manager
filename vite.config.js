import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identificador único de cada compilación: la app lo compara con version.json
// para detectar que hay una versión nueva publicada.
const BUILD_ID = Date.now().toString()

function versionFile() {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ id: BUILD_ID }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  base: '/Tournament-Manager/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
