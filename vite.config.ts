import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Permite que a nova aba acesse o servidor
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    }
  }
})