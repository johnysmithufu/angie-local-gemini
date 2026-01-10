import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'out',
    emptyOutDir: true,
    lib: {
      entry: './src/demo-mcp-server.ts',
      name: 'AngieDemo',
      fileName: () => 'angie-demo.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        globals: {}
      }
    },
    minify: true,
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
