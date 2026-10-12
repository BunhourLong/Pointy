import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': '/src' } },
  test: {
    include: ['tests/**/*.test.ts'],
    // core/ runs in Node; opt a file into jsdom with `// @vitest-environment jsdom`.
    environment: 'node',
  },
});
