import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    }
  },
  optimizeDeps: {
    exclude: ['sqlocal']
  },
  build: {
    // This bumps the warning limit to 1000 kB (1MB) since WASM/DB engines are heavy
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // Splits node_modules dependencies out of your main source code chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})