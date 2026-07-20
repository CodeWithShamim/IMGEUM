import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {port: 5173},
  build: {
    target: 'es2020',
    // Keep the wage-stream canvas and framer-motion out of the initial route bundle so the
    // landing page (the Lighthouse target) stays lean.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          chain: ['viem', 'wagmi', '@tanstack/react-query'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
