import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    snapshotFormat: {
      printBasicPrototype: false,
    },
    clearMocks: true,
    exclude: [
      // Comment if you want to run the integration tests.
      '**/*.integration.test.*',
      'dist/**/*'
    ]
  },
});
