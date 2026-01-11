import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'out',
    emptyOutDir: true,
    lib: {
      entry: './src/demo-mcp-server.tsx', // Updated entry point
      name: 'AngieDemo',
      fileName: () => 'angie-demo.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Force all CSS to be named angie-demo.css to match PHP enqueue
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
             return 'angie-demo.css';
          }
          return assetInfo.name || 'asset-[name]';
        },
        globals: {
           // If we need to exclude react from bundle and use WP's, we would do it here.
           // But package.json has react as dependency, not devDependency/peer.
           // So we bundle it.
        }
      }
    },
    minify: true,
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
