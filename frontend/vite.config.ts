import { defineConfig } from 'vite'
import path from 'path';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: { 
    rollupOptions: { 
      input: { 
        main: path.resolve(__dirname, 'index.html'), 
        selesai: path.resolve(__dirname, 'selesai.html') 
      } 
    } 
  },
  server: {
    proxy: {
      "/compress": "http://localhost:3000"
    }
  }
})
