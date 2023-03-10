import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    snapshotFormat: {
      printBasicPrototype: false,
    },
    clearMocks: true,
  },
});
