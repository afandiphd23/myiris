# IRIS Malaysia V2.0 — Integrasi Risikan & Informasi Strategik
Malaysia-Only AI Geospatial Intelligence & Real-Time Situational Awareness.

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
- Live: https://iris-xygb.onrender.com
- Build: `npm install; npm run build` · Start: `npm start` · Env: `PORT` automatik.

## Login OpenSky (kuota flights lebih tinggi)
- Tanpa login: ADS-B anonim, mudah kena had kadar (TIADA sementara).
- Dengan login: set `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` (akaun OpenSky → Account → API Client, aliran OAuth2 client-credentials). Token disegar automatik (30 minit); rahsia tidak dihantar ke klien.
- Fallback automatik: OpenSky → adsb.lol (komuniti) → data lewat terakhir (dilabel STALE).
- Di Vercel: tambah kedua-dua env di Project Settings → Environment Variables, kemudian redeploy.

## Login Google (pilihan)
- Client ID lalai dibina dalam app (`src/lib/googleAuth.ts`); override via `VITE_GOOGLE_CLIENT_ID` jika perlu.
- Pastikan Authorized JavaScript origins di Google Cloud Console mengandungi URL deployment (Vercel/Render) + `http://localhost:5173`.
- Kegemaran & sejarah diasing per pengguna Google; log keluar kembali ke data tanpa nama. Token ID hanya dibaca di klien (paparan), bukan kawalan akses pelayan.

## Deploy (Vercel)
- Frontend: `vite build` → `dist/` · API: `api/index.ts` (Express dikongsi dari `server/app.ts`).
- `vercel.json` me-rewrite `/api/:path*` → `/api`. Jika nampak `Respons bukan JSON (HTTP 404) ... NOT_FOUND`,
  maksudnya rewrite belum live — commit `vercel.json` + `api/` kemudian redeploy.
