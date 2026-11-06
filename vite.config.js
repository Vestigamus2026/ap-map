import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['test/unit/**/*.test.js'],
    environment: 'node',
  },
});
