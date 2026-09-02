import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// El backend de desarrollo vive en http://localhost:8000.
// En producción nginx sirve el estático y hace de proxy de /api hacia el backend,
// por eso el cliente usa rutas relativas por defecto.
const DEV_BACKEND = process.env.VITE_DEV_BACKEND ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: DEV_BACKEND,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
