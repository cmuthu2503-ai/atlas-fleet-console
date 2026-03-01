import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    allowedHosts: true as any,
    proxy: {
      '/api/fleet': {
        target: 'http://localhost:3590',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});
