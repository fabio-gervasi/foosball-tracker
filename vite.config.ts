/// <reference types="vitest" />
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
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // Pre-generate critical routes for faster loading
        // These will be statically generated for optimal performance
      },
      output: {
        manualChunks: {
          // Vendor chunk for React and core dependencies
          vendor: ['react', 'react-dom'],
          // UI components chunk
          ui: [
            'lucide-react',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
          ],
          // Utils chunk
          utils: ['clsx', 'tailwind-merge'],
          // Supabase chunk
          supabase: ['@supabase/supabase-js'],
          // React Query chunk
          query: ['@tanstack/react-query'],
        },
      },
    },
    // Performance optimizations
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    outDir: 'build',
    // Enhanced build optimizations for Vercel
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    modulePreload: {
      polyfill: false, // Reduce bundle size
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      'tests/**', // Exclude entire Playwright tests directory
      '**/*.spec.ts', // Exclude all .spec.ts files (Playwright convention)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'build/',
        'src/supabase/functions/server/',
        'src/examples/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  server: {
    port: 5173, // Use Vite default port
    open: true,
  },
});
