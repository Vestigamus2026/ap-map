import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
  test: {
    include: ['test/unit/**/*.test.js'],
    environment: 'node',
  },
});
