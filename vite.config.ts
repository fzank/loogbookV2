import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    force: true // Isso obriga a Vercel e o seu PC a deletarem o cache quebrado do Firebase!
  }
})