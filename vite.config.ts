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
  host: true,                    // ← ADDED
  port: 5173,                    // ← ADDED
  allowedHosts: [                // ← ADDED (this fixes your error)
    'student-management.italycoursefinder.com',
    '.italycoursefinder.com',
  ],
  proxy: {
    '/api': {
      target: 'https://student-management.italycoursefinder.com',
      changeOrigin: true,
      secure: false,
    },
  },
},
});
