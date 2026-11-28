import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // In development, forward /api calls to the backend (see backend/src/server.ts).
    // 127.0.0.1, not "localhost": the backend listens on IPv4 loopback only, and localhost may resolve to IPv6 (::1).
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
