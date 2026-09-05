import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiProxyTarget = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth': apiProxyTarget,
      '/sessions': apiProxyTarget,
      '/leaderboards': apiProxyTarget,
      '/games': apiProxyTarget,
      '/me': apiProxyTarget,
      '/health': apiProxyTarget,
    },
  },
  test: {
    environment: 'node',
  },
});
