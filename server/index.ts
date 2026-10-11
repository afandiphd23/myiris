import express from "express";
import dotenv from "dotenv";
import path from "path";
import { isInsideMalaysia, validateMYTarget, classifyZone, KEY_LOCATIONS, STATES } from "./lib/geofence.js";
import { getQuakes, getWeather, getAdsb, getHealth, OFFICIAL_PORTALS } from "./lib/dataEngine.js";
import { assessRisk, verifyClaim } from "./lib/riskEngine.js";
import { runAgent, AGENT_IDS } from "./lib/agents.js";
import { buildSitrep } from "./lib/sitrep.js";
import { audit, getAudit, dedupeAlert } from "./lib/audit.js";
import { getAdvisories, buildQuakeTimeline, STATE_CENTERS } from "./lib/reference.js";

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

// --- API ---
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), sources: getHealth(), portals: OFFICIAL_PORTALS });
});

app.get("/api/reference", (_req, res) => {
  res.json({ states: STATES, locations: KEY_LOCATIONS, portals: OFFICIAL_PORTALS, center: [4.2, 102.25], zoom: 6, stateCenters: STATE_CENTERS });
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
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { res.status(400).json({ error: "Koordinat tidak sah." }); return; }
    const v = validateMYTarget(lat, lon, label);
    if (!v.ok) { audit("reject", v.reason!, { lat, lon }); res.status(403).json({ error: v.reason, zone: "foreign-rejected" }); return; }

    const [weather, quakes, adsb] = await Promise.all([getWeather(lat, lon), getQuakes(), getAdsb()]);
    const ctx = { lat, lon, label, weather, quakes, adsb };
    const agents = [];
    for (const id of AGENT_IDS) agents.push(await runAgent(id, ctx));

    // Gerbang verifikasi: tolak dakwaan tanpa sokongan
    const claimText = `${label} ${assetCategory} ${req.body.notes ?? ""}`;
    const prelimEvidence = agents.flatMap((a) => a.evidence);
    const ver = verifyClaim(claimText, prelimEvidence);
    if (!ver.ok) { audit("verification-block", ver.reason!, { label }); res.status(422).json({ error: ver.reason }); return; }

    const zone = classifyZone(lat, lon);
    const precip = weather.live ? (weather as any).precipProbMax ?? 0 : 0;
    const risk = assessRisk({
      category: assetCategory, methodology: "Pemberat telus: cuaca model 25% + seismik USGS 25% + liputan data 20% + zon geografi 15% + konteks operasi 15%. Skor=(Σ pemberat×nilai)/Σ pemberat ×10.",
      factors: [
        { name: "Risiko cuaca (model)", weight: 25, value: Math.min(10, precip / 10), note: `Kebarangkalian hujan model ${weather.live ? precip + "%" : "TIADA data"}` },
        { name: "Aktiviti seismik serantau", weight: 25, value: Math.min(10, (quakes.live ? quakes.count : 0) / 2), note: quakes.live ? `${quakes.count} gempa M4+ (30 hari)` : "USGS TIADA" },
        { name: "Liputan/ketersediaan data", weight: 20, value: [weather, quakes, adsb].filter((s: any) => s.live).length >= 2 ? 2 : 7, note: "Nilai tinggi = data terhad" },
        { name: "Zon geografi", weight: 15, value: zone === "tuntutan-bertindih" ? 7 : zone === "zee" ? 4 : 2, note: `Zon: ${zone}` },
        { name: "Konteks operasi", weight: 15, value: 3, note: "Asas awam; sahkan dengan operator/portal rasmi" },
      ],
      evidence: prelimEvidence,
      followUp: ["Pantau semula mengikut selang.", `Semak portal rasmi: METMalaysia, InfoBanjir, NADMA${assetCategory.includes("maritim") ? ", Jabatan Laut" : ""}${assetCategory.includes("penerbangan") ? ", CAAM" : ""}.`],
    });

    // Amaran (dedup)
    const alerts: string[] = [];
    if ((risk.status === "HIGH" || risk.status === "CRITICAL") && dedupeAlert(`${label}-${risk.status}-${risk.score}`)) {
      alerts.push(`${label}: ${risk.status} (${risk.score}/100)`);
      audit("alert", alerts[0], { lat, lon });
    }
    audit("analyze", `${label} → ${risk.status} ${risk.score}`, { lat, lon, zone });
    const fetchedAt = new Date().toISOString();
    res.json({ label, coords: [lat, lon], zone, insideMalaysia: isInsideMalaysia(lat, lon), fetchedAt, weather, quakes: { live: quakes.live, count: quakes.count, events: quakes.events?.slice(0, 5), timeline: quakes.live ? buildQuakeTimeline((quakes.events ?? []).map((e: any) => ({ time: e.time, mag: e.mag }))) : [] }, adsb: { live: adsb.live, count: adsb.count }, advisories: getAdvisories(state || undefined), agents, risk, alerts });
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
    const [weather, quakes, adsb] = await Promise.all([getWeather(lat, lon), getQuakes(), getAdsb()]);
    const agents = [];
    for (const id of AGENT_IDS) agents.push(await runAgent(id, { lat, lon, label, weather, quakes, adsb }));
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

app.get("/api/audit", (_req, res) => res.json(getAudit()));

// --- Static frontend (produksi) ---
const dist = process.env.NODE_ENV === "production" ? path.join(process.cwd(), "dist") : null;
if (dist) { app.use(express.static(dist)); app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html"))); }

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => console.log(`IRIS Malaysia V2.0 listening on :${PORT}`));
