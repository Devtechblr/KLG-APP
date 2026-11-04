import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    // Tests run the real (live-mode) app against tests/fakeBackend.js.
    env: {
      VITE_USE_MOCK_DATA: 'false',
      VITE_API_BASE_URL: 'https://api.test/api',
      VITE_POLL_MS: '600000',
    },
    testTimeout: 20000,
  },
});
