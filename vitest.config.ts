import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.{test,spec}.{ts,js}'],
    globals: true,
    environment: 'node',
  },
  coverage: {
    provider: 'v8',
    include: ['src/engine/lifecycle.ts'],
    thresholds: {
      branches: 80,
    },
  },
});
