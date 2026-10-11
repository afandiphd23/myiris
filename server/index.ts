import express from "express";
import dotenv from "dotenv";
import path from "path";
import { isInsideMalaysia, validateMYTarget, classifyZone, KEY_LOCATIONS, STATES, STRATEGIC_CORRIDORS, haversineKm } from "./lib/geofence.js";
import { getQuakes, getWeather, getMarineWeather, getAirQuality, getAdsb, getHealth, OFFICIAL_PORTALS } from "./lib/dataEngine.js";
import { assessRisk, verifyClaim } from "./lib/riskEngine.js";
import { runAgent, AGENT_IDS } from "./lib/agents.js";
import { buildSitrep, listSitreps, deleteSitrep } from "./lib/sitrep.js";
import { audit, getAudit, dedupeAlert } from "./lib/audit.js";
import { getAdvisories, buildQuakeTimeline, STATE_CENTERS, FLOOD_PRONE, searchCustomsReference } from "./lib/reference.js";

dotenv.config();
const app = express();
app.use(express.json({ limit: "256kb" }));

// --- Keselamatan asas: sekat suntikan prompt dalam input label ---
const PROMPT_INJECTION = [/ignore (all )?previous instructions/i, /system\s*prompt/i, /jailbreak|DAN mode/i, /reveal .*key|api[_-]?key/i];
function sanitizeLabel(s: unknown): string {
  const t = String(s ?? "").slice(0, 200);
  for (const p of PROMPT_INJECTION) if (p.test(t)) throw new Error("Input ditolak: corak suntikan prompt dikesan.");
  return t.replace(/[<>"'`;]/g, "");
}

function computeProximity(lat: number, lon: number, quakes: any, adsb: any) {
  const ports = KEY_LOCATIONS.filter((k) => k.kind === "pelabuhan").map((p) => ({ ...p, distKm: haversineKm(lat, lon, p.lat, p.lon) })).sort((a, b) => a.distKm - b.distKm);
  const airports = KEY_LOCATIONS.filter((k) => k.kind === "lapangan-terbang").map((a) => ({ ...a, distKm: haversineKm(lat, lon, a.lat, a.lon) })).sort((a, b) => a.distKm - b.distKm);
  const floodBasins = FLOOD_PRONE.filter((f) => f.lat != null && f.lon != null).map((f) => ({ ...f, distKm: haversineKm(lat, lon, f.lat!, f.lon!) })).sort((a, b) => a.distKm - b.distKm);
  const quakeList = ((quakes?.events ?? []) as any[])
    .filter((q) => Array.isArray(q.coords) && q.coords.length >= 2)
    .map((q) => ({ id: q.id, mag: q.mag, place: q.place, time: q.time, distKm: haversineKm(lat, lon, q.coords[1], q.coords[0]) }))
    .sort((a, b) => a.distKm - b.distKm);
  const aircraftList = ((adsb?.states ?? []) as any[])
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({ callsign: s.callsign || s.icao, icao: s.icao, altM: s.altM, distKm: haversineKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.distKm - b.distKm);

  return {
    nearestPort: ports[0] ?? null,
    nearestAirport: airports[0] ?? null,
    nearestFloodBasin: floodBasins[0] ?? null,
    nearestQuake: quakeList[0] ?? null,
    nearestAircraft: aircraftList[0] ?? null,
    aircraftWithin100Km: aircraftList.filter((a) => a.distKm <= 100).length,
  };
}

// --- API ---
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), sources: getHealth(), portals: OFFICIAL_PORTALS });
});

app.get("/api/reference", (_req, res) => {
  res.json({
    states: STATES,
    locations: KEY_LOCATIONS,
    corridors: STRATEGIC_CORRIDORS,
    floodProne: FLOOD_PRONE,
    portals: OFFICIAL_PORTALS,
    center: [4.2, 102.25],
    zoom: 6,
    stateCenters: STATE_CENTERS,
  });
});

app.get("/api/customs", (req, res) => {
  try {
    const q = sanitizeLabel(req.query.q ?? "");
    res.json({
      items: searchCustomsReference(q),
      checkpoints: KEY_LOCATIONS.filter((k) => k.kind === "pelabuhan" || k.kind === "lapangan-terbang" || k.kind === "sempadan"),
      disclaimer: "RUJUKAN statik Akta Kastam 1967 & Akta Perdagangan Strategik 2010 — sahkan perintah tarif semasa dengan JKDM & MITI.",
    });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/advisories", (req, res) => {
  try {
    const state = sanitizeLabel(req.query.state ?? "");
    res.json({ ...getAdvisories(state || undefined), disclaimer: "RUJUKAN statik — status semasa mesti disahkan melalui InfoBanjir/METMalaysia/operator." });
  } catch (e: any) { res.status(400).json({ error: String(e?.message ?? e) }); }
});

app.get("/api/quakes", async (_req, res) => {
  const q = await getQuakes();
  audit("quakes", `USGS live=${q.live} count=${q.count}`);
  res.json(q);
});

app.get("/api/weather", async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  const v = validateMYTarget(lat, lon);
  if (!v.ok) { audit("reject", v.reason!); res.status(400).json({ error: v.reason }); return; }
  const w = await getWeather(lat, lon);
  res.json(w);
});

app.get("/api/adsb", async (_req, res) => {
  const a = await getAdsb();
  audit("adsb", `OpenSky live=${a.live} count=${a.count}`);
  res.json(a);
});

// Analisis penuh: geofence → data langsung → 8 ejen → verifikasi → risiko telus
app.post("/api/analyze", async (req, res) => {
  try {
    const lat = Number(req.body.lat), lon = Number(req.body.lon);
    const label = sanitizeLabel(req.body.label ?? `${lat},${lon}`);
    const assetCategory = sanitizeLabel(req.body.asset ?? "umum");
    const state = req.body.state ? sanitizeLabel(req.body.state) : "";
    const notes = req.body.notes ? sanitizeLabel(req.body.notes) : "";
    const scenario = req.body.scenario ? sanitizeLabel(req.body.scenario) : "live";

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { res.status(400).json({ error: "Koordinat tidak sah." }); return; }
    const v = validateMYTarget(lat, lon, label);
    if (!v.ok) { audit("reject", v.reason!, { lat, lon }); res.status(403).json({ error: v.reason, zone: "foreign-rejected" }); return; }

    const [weather, marine, airQuality, quakes, adsb] = await Promise.all([
      getWeather(lat, lon),
      getMarineWeather(lat, lon),
      getAirQuality(lat, lon),
      getQuakes(),
      getAdsb(),
    ]);

    const ctx = { lat, lon, label, weather, marine, airQuality, quakes, adsb };
    const agents = [];
    for (const id of AGENT_IDS) agents.push(await runAgent(id, ctx));

    // Gerbang verifikasi: tolak dakwaan tanpa sokongan
    const claimText = `${label} ${assetCategory} ${notes}`;
    const prelimEvidence = agents.flatMap((a) => a.evidence);
    const ver = verifyClaim(claimText, prelimEvidence);
    if (!ver.ok) { audit("verification-block", ver.reason!, { label }); res.status(422).json({ error: ver.reason }); return; }

    const zone = classifyZone(lat, lon);
    const basePrecip = weather.live ? (weather as any).precipProbMax ?? 0 : 0;
    const baseQuakeCount = quakes.live ? quakes.count : 0;
    const waveHeight = marine.live ? (marine.waveHeightM ?? 0) : 0;
    const aqiVal = airQuality.live ? (airQuality.aqi ?? 0) : 0;

    // Sokongan simulasi senario ujian tekanan (dilabel jelas SIMULASI jika aktif)
    let wxVal = Math.min(10, basePrecip / 10);
    let wxNote = `Kebarangkalian hujan model ${weather.live ? basePrecip + "%" : "TIADA data"}`;
    let quakeVal = Math.min(10, baseQuakeCount / 2);
    let quakeNote = quakes.live ? `${quakes.count} gempa M4+ (30 hari)` : "USGS TIADA";
    let envVal = Math.min(10, Math.max(waveHeight * 2.5, aqiVal / 25));
    let envNote = `Ombak ${marine.live && marine.waveHeightM != null ? marine.waveHeightM + "m" : "N/A"} · AQI ${airQuality.live && airQuality.aqi != null ? airQuality.aqi : "N/A"}`;
    let opsVal = 3;
    let opsNote = "Asas awam; sahkan dengan operator/portal rasmi";

    if (scenario === "monsoon-surge") {
      wxVal = 9.2;
      wxNote = "SIMULASI: Luruan Monsun Timur Laut (hujan ekstrem 92% + angin kencang)";
      envVal = Math.max(envVal, 7.5);
      envNote = "SIMULASI: Gelora laut tinggi & kenaikan paras sungai";
      opsVal = 7.0;
    } else if (scenario === "haze-episode") {
      envVal = 8.8;
      envNote = "SIMULASI: Jerebu rentas sempadan (AQI > 220, jarak penglihatan rendah)";
      opsVal = 6.5;
      opsNote = "SIMULASI: Gangguan jarak penglihatan maritim & penerbangan";
    } else if (scenario === "seismic-tremor") {
      quakeVal = 8.5;
      quakeNote = "SIMULASI: Gegaran serantau M6.5+ berhampiran perairan Sabah/Selat Melaka";
      opsVal = 7.5;
    }

    const risk = assessRisk({
      category: assetCategory,
      methodology: "Pemberat telus: cuaca model 25% + seismik USGS 20% + maritim/udara (ombak/AQI) 15% + liputan data 15% + zon geografi 15% + konteks operasi 10%. Skor=(Σ pemberat×nilai)/Σ pemberat ×10.",
      factors: [
        { name: "Risiko cuaca (model)", weight: 25, value: Number(wxVal.toFixed(1)), note: wxNote },
        { name: "Aktiviti seismik serantau", weight: 20, value: Number(quakeVal.toFixed(1)), note: quakeNote },
        { name: "Keadaan laut & kualiti udara", weight: 15, value: Number(envVal.toFixed(1)), note: envNote },
        { name: "Liputan/ketersediaan data", weight: 15, value: [weather, quakes, adsb].filter((s: any) => s.live).length >= 2 ? 2 : 7, note: "Nilai tinggi = data terhad" },
        { name: "Zon geografi", weight: 15, value: zone === "tuntutan-bertindih" ? 7 : zone === "zee" ? 4 : 2, note: `Zon: ${zone}` },
        { name: "Konteks operasi", weight: 10, value: opsVal, note: opsNote },
      ],
      evidence: prelimEvidence,
      followUp: [
        "Pantau semula mengikut selang.",
        `Semak portal rasmi: METMalaysia, InfoBanjir, NADMA, JAS APIMS${assetCategory.includes("maritim") ? ", Jabatan Laut" : ""}${assetCategory.includes("penerbangan") ? ", CAAM" : ""}.`,
      ],
    });

    const proximity = computeProximity(lat, lon, quakes, adsb);

    // Amaran (dedup)
    const alerts: string[] = [];
    if ((risk.status === "HIGH" || risk.status === "CRITICAL") && dedupeAlert(`${label}-${risk.status}-${risk.score}`)) {
      alerts.push(`${label}: ${risk.status} (${risk.score}/100)`);
      audit("alert", alerts[0], { lat, lon });
    }
    audit("analyze", `${label} → ${risk.status} ${risk.score}${scenario !== "live" ? ` [${scenario}]` : ""}`, { lat, lon, zone });
    const fetchedAt = new Date().toISOString();
    res.json({
      label,
      coords: [lat, lon],
      zone,
      scenario,
      insideMalaysia: isInsideMalaysia(lat, lon),
      fetchedAt,
      weather,
      marine,
      airQuality,
      proximity,
      quakes: {
        live: quakes.live,
        count: quakes.count,
        events: quakes.events?.slice(0, 15),
        timeline: quakes.live ? buildQuakeTimeline((quakes.events ?? []).map((e: any) => ({ time: e.time, mag: e.mag }))) : [],
      },
      adsb: {
        live: adsb.live,
        count: adsb.count,
        states: adsb.states ?? [],
      },
      advisories: getAdvisories(state || undefined),
      agents,
      risk,
      alerts,
    });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

// Imbasan kelompok koridor strategik Malaysia
app.post("/api/batch-scan", async (req, res) => {
  try {
    const corridorId = sanitizeLabel(req.body.corridorId ?? "selat-melaka");
    const corridor = STRATEGIC_CORRIDORS.find((c) => c.id === corridorId) ?? STRATEGIC_CORRIDORS[0];
    const [quakes, adsb] = await Promise.all([getQuakes(), getAdsb()]);

    const rows = await Promise.all(
      corridor.points.map(async (pt) => {
        const [weather, marine, airQuality] = await Promise.all([
          getWeather(pt.lat, pt.lon),
          getMarineWeather(pt.lat, pt.lon),
          getAirQuality(pt.lat, pt.lon),
        ]);
        const zone = classifyZone(pt.lat, pt.lon);
        const precip = weather.live ? (weather as any).precipProbMax ?? 0 : 0;
        const wave = marine.live ? (marine.waveHeightM ?? 0) : 0;
        const aqi = airQuality.live ? (airQuality.aqi ?? 0) : 0;
        const agents = await Promise.all(["geospatial", "maritime", "disaster"].map((id) => runAgent(id as any, { lat: pt.lat, lon: pt.lon, label: pt.name, weather, marine, airQuality, quakes, adsb })));
        const evidence = agents.flatMap((a) => a.evidence);
        const risk = assessRisk({
          category: corridor.asset,
          methodology: "Imbasan koridor serentak.",
          factors: [
            { name: "Cuaca", weight: 30, value: Math.min(10, precip / 10), note: `${precip}%` },
            { name: "Seismik", weight: 25, value: Math.min(10, (quakes.live ? quakes.count : 0) / 2), note: `${quakes.count}` },
            { name: "Laut & Udara", weight: 25, value: Math.min(10, Math.max(wave * 2.5, aqi / 25)), note: `${wave}m / AQI ${aqi}` },
            { name: "Zon", weight: 20, value: zone === "tuntutan-bertindih" ? 7 : zone === "zee" ? 4 : 2, note: zone },
          ],
          evidence,
        });
        return {
          name: pt.name,
          state: pt.state,
          lat: pt.lat,
          lon: pt.lon,
          zone,
          tempC: weather.live ? (weather as any).current?.temperature_2m ?? null : null,
          windKmh: weather.live ? (weather as any).current?.wind_speed_10m ?? null : null,
          precipProb: precip,
          waveM: marine.live ? marine.waveHeightM : null,
          aqi: airQuality.live ? airQuality.aqi : null,
          riskStatus: risk.status,
          riskScore: risk.score,
        };
      })
    );

    audit("batch-scan", `Koridor ${corridor.id} (${rows.length} titik diimbas)`);
    res.json({
      corridor,
      fetchedAt: new Date().toISOString(),
      quakesCount: quakes.count,
      adsbCount: adsb.count,
      rows,
    });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

app.post("/api/sitrep", async (req, res) => {
  try {
    const lat = Number(req.body.lat), lon = Number(req.body.lon);
    const label = sanitizeLabel(req.body.label ?? `${lat},${lon}`);
    const assetCategory = sanitizeLabel(req.body.asset ?? "umum");
    const v = validateMYTarget(lat, lon, label);
    if (!v.ok) { res.status(403).json({ error: v.reason }); return; }
    const [weather, marine, airQuality, quakes, adsb] = await Promise.all([
      getWeather(lat, lon),
      getMarineWeather(lat, lon),
      getAirQuality(lat, lon),
      getQuakes(),
      getAdsb(),
    ]);
    const agents = [];
    for (const id of AGENT_IDS) agents.push(await runAgent(id, { lat, lon, label, weather, marine, airQuality, quakes, adsb }));
    const evidence = agents.flatMap((a) => a.evidence);
    const ver = verifyClaim(`${label} ${assetCategory}`, evidence);
    if (!ver.ok) { res.status(422).json({ error: ver.reason }); return; }
    const precip = weather.live ? (weather as any).precipProbMax ?? 0 : 0;
    const risk = assessRisk({
      category: assetCategory, methodology: "Sama seperti /api/analyze — pemberat telus, bukti dipetik.",
      factors: [
        { name: "Risiko cuaca (model)", weight: 30, value: Math.min(10, precip / 10), note: weather.live ? `${precip}%` : "TIADA" },
        { name: "Aktiviti seismik", weight: 30, value: Math.min(10, (quakes.live ? quakes.count : 0) / 2), note: quakes.live ? `${quakes.count} gempa` : "TIADA" },
        { name: "Liputan data", weight: 40, value: evidence.length === 0 ? 5 : 3, note: `${evidence.length} bukti` },
      ],
      evidence,
    });
    const sitrep = buildSitrep({ location: label, lat, lon, assetCategory, risk, agents });
    audit("sitrep", `${sitrep.reportId} ${label} ${risk.status}`, { lat, lon });
    res.json(sitrep);
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/sitreps", (_req, res) => {
  res.json(listSitreps());
});

app.delete("/api/sitreps/:id", (req, res) => {
  const ok = deleteSitrep(req.params.id);
  res.json({ ok });
});

app.get("/api/audit", (_req, res) => res.json(getAudit()));

// Laluan /api yang tidak dikenali → JSON 404 (jangan jatuh ke SPA index.html,
// jika tidak frontend gagal parse dengan "Unexpected token ..." yang mengelirukan)
app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint API tidak wujud." }));

// --- Static frontend (produksi) / Vite dev middleware ---
async function startServer() {
  if (process.env.NODE_ENV === "production") {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
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
