# IRIS Malaysia V2.0 — Malaysia-Only AI Geospatial Intelligence

## Mula pantas
```bash
npm install
npm run dev        # backend :3001 + proxy /api (jalan `vite` berasingan untuk UI dev)
npm run dev:client # UI dev :5173
npm test           # ujian geofence + risk engine
npm run build; npm start  # produksi (Render: build cmd npm run build, start cmd npm start)
```

## Kelayakan spec
- §2 Geofence Malaysia-only (`server/lib/geofence.ts`) — bbox Semenanjung + Sabah/Sarawak, tolak asing (403), label zon telus.
- §3 Data engine (`server/lib/dataEngine.ts`) — USGS + Open-Meteo + OpenSky LIVE; METMalaysia/InfoBanjir/NADMA/CAAM/Jabatan Laut/JUPEM/JKDM sebagai portal rasmi (tiada endpoint direka). Cache, retry-timeout, health `/api/health`.
- §4/§7 Enam modul + lapan ejen (`server/lib/agents.ts`) — output berstruktur + sumber.
- §5 Risiko telus (`server/lib/riskEngine.ts`) — LOW/GUARDED/MODERATE/HIGH/CRITICAL/INSUFFICIENT EVIDENCE + metodologi + batasan. Gerbang verifikasi tolak dakwaan ketenteraan/terperingkat tanpa bukti.
- §6 Dashboard (`src/App.tsx`) — navy/charcoal + cyan, BM lalai + EN, peta Leaflet, lapisan, carian lokasi Malaysia, panel sumber, audit, responsif.
- §8 SITREP (`server/lib/sitrep.ts`) — struktur penuh + eksport JSON/PDF (print). Tiada pengelasan rasmi.
- §9 Monitoring — dedup amaran, freshness, outage dilabel TIADA, audit log.
- §10 Ujian (`tests/iris.spec.ts`) — Port Klang, KLIA, Kelantan, Sabah, Sarawak, kastam, penolakan asing, data hilang, dakwaan tanpa sokongan, suntikan prompt.

## Deploy (Render)
- Build: `npm install; npm run build` · Start: `npm start` · Env: `PORT` automatik.

## Deploy (Vercel)
- Frontend: `vite build` → `dist/` · API: `api/index.ts` (Express dikongsi dari `server/app.ts`).
- `vercel.json` me-rewrite `/api/:path*` → `/api`. Jika nampak `Respons bukan JSON (HTTP 404) ... NOT_FOUND`,
  maksudnya rewrite belum live — commit `vercel.json` + `api/` kemudian redeploy.
