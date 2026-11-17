import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.component.test.{jsx,js,tsx,ts}'],
    setupFiles: ['./tests/setupTests.js'],
  },
}));
