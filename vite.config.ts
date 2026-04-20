import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    outDir: 'dist'
  },
  plugins: [react()],
  
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://student-management-backend.italycoursefinder.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
