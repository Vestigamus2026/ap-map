import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rollupOptions: { input: { main: page('index.html'), print: page('print.html') } },
  },
  test: {
    include: ['test/unit/**/*.test.js'],
    environment: 'node',
  },
});
