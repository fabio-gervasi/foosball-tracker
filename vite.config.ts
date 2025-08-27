
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React and core dependencies
          vendor: ['react', 'react-dom'],
          // UI components chunk
          ui: ['@radix-ui/react-alert-dialog', '@radix-ui/react-label', '@radix-ui/react-slot'],
          // Utils chunk
          utils: ['clsx', 'tailwind-merge', 'lucide-react'],
          // Supabase chunk
          supabase: ['@supabase/supabase-js'],
          // React Query chunk
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5173, // Use Vite default port
    open: true,
  },
});
