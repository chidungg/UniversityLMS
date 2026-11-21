import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from 'node:process';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.LMS_TEST_API_TARGET || "http://localhost:5000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            if (res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "error", message: "Backend unavailable" }));
            }
          });
        },
      },
      "/demo-assets": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
