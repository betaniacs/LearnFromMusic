import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the Vite dev server and the API are separate origins.
    // Proxying /api through Vite keeps them same-origin from the browser's
    // point of view, so the httpOnly session cookie is sent normally and we
    // need no CORS configuration at all.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
