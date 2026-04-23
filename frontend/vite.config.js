import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  server: {
    
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
    
    host: true, 
    port: 5173,
    strictPort: true,
    hmr: {
      
      clientPort: 8080 
    },
    watch: {
      usePolling: true,
    }
  },
  plugins: [react()],
})