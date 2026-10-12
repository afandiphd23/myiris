// Launcher local/Render: static dist (production) atau Vite middleware (dev).
// Logik API dikongsi dari ./app.ts supaya boleh diguna semula oleh Vercel serverless (api/index.ts).
import express from "express";
import path from "path";
import { app } from "./app.js";

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    // Express 4: "*" rosak dengan path-to-regexp v6 — guna RegExp/serve index untuk SPA fallback.
    // Penting: /api/* sudah diakhiri JSON 404 dalam app.ts, jadi fallback ini hanya untuk UI.
    app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, "0.0.0.0", () => console.log(`IRIS Malaysia V2.0 listening on http://0.0.0.0:${PORT}`));
}

startServer();
