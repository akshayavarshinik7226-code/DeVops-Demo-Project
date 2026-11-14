import { defineConfig } from "vite";

// In development, `npm run dev` forwards API calls to the API on port 8000.
// In Docker, Nginx does the same job (see nginx.conf).
const target = process.env.API_URL || "http://localhost:8000";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": target,
      "/health": target,
    },
  },
});
