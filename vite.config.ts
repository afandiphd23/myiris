import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    // UI dev di :5173; panggilan /api diproksi ke backend express (:3001).
    // Tanpa proksi ini, fetch("/api/...") mengembalikan index.html
    // lalu gagal parse JSON ("Unexpected token ... is not valid JSON").
    port: 5173,
    allowedHosts: true,
    hmr: false,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
