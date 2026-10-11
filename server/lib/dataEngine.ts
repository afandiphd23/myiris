// IRIS Malaysia V2.0 — enjin data masa nyata (sumber sahih sahaja).
// Peraturan: jangan reka endpoint API. Setiap sumber dilabel live/model/pautan-rasmi.

export interface SourceStatus {
  id: string; name: string; kind: "live" | "model" | "portal";
  url: string; lastOk: string | null; lastError: string | null; freshSec: number | null;
}

const cache = new Map<string, { at: number; data: unknown }>();
const health = new Map<string, SourceStatus>();

function setHealth(s: SourceStatus) { health.set(s.id, s); }
export function getHealth(): SourceStatus[] { return [...health.values()]; }

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlSec * 1000) return hit.data as T;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "IRIS-Malaysia-V2/2.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Portal rasmi Malaysia (pautan, bukan API — dilabel telus).
export const OFFICIAL_PORTALS = [
  { id: "metmalaysia", name: "METMalaysia — Amaran Cuaca", url: "https://www.met.gov.my/" },
  { id: "infobanjir", name: "JPS InfoBanjir — Aras Sungai & Banjir", url: "https://infobanjir.water.gov.my/" },
  { id: "nadma", name: "NADMA — Info Bencana", url: "https://www.nadma.gov.my/" },
  { id: "caam", name: "CAAM — Notis Penerbangan Awam", url: "https://www.caam.gov.my/" },
  { id: "jabatanlaut", name: "Jabatan Laut Malaysia — Notis Maritim", url: "https://www.marine.gov.my/" },
  { id: "jukm", name: "JUPEM / MyGDI — Rujukan Geospatial", url: "https://www.jupem.gov.my/" },
  { id: "jkdm", name: "JKDM — Kastam Malaysia (Akta Kastam 1967)", url: "https://www.customs.gov.my/" },
  { id: "miti", name: "MITI — Perdagangan & Industri", url: "https://www.miti.gov.my/" },
] as const;

// 1) Gempa serantau relevan Malaysia — USGS (live, awam, stabil).
export async function getQuakes() {
  const url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=" +
    new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) +
    "&minlatitude=-2&maxlatitude=10&minlongitude=95&maxlongitude=121&minmagnitude=4&limit=50&orderby=time";
  try {
    const data = await cached("quakes", 600, () => fetchJson(url)) as any;
    setHealth({ id: "usgs", name: "USGS Earthquake (live)", kind: "live", url: "https://earthquake.usgs.gov/", lastOk: new Date().toISOString(), lastError: null, freshSec: 600 });
    return { live: true as const, count: data?.features?.length ?? 0, events: (data?.features ?? []).slice(0, 20).map((f: any) => ({ id: f.id, mag: f.properties?.mag, place: f.properties?.place, time: new Date(f.properties?.time).toISOString(), url: f.properties?.url, coords: f.geometry?.coordinates })) };
  } catch (e: any) {
    setHealth({ id: "usgs", name: "USGS Earthquake (live)", kind: "live", url: "https://earthquake.usgs.gov/", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, count: 0, events: [], error: "USGS tidak dapat dicapai — semak sambungan." };
  }
}

// 2) Cuaca model (Open-Meteo, live) + pautan METMalaysia. Dilabel jelas BUKAN data rasmi METMalaysia.
export async function getWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=Asia%2FKuala_Lumpur&forecast_days=2`;
  try {
    const data = await cached(`wx-${lat.toFixed(2)}-${lon.toFixed(2)}`, 900, () => fetchJson(url)) as any;
    setHealth({ id: "openmeteo", name: "Open-Meteo (model, live)", kind: "live", url: "https://open-meteo.com/", lastOk: new Date().toISOString(), lastError: null, freshSec: 900 });
    return {
      live: true as const, disclaimer: "Data model cuaca (bukan amaran rasmi). Untuk amaran rasmi rujuk METMalaysia.",
      metMalaysia: "https://www.met.gov.my/", current: data?.current,
      precipProbMax: Math.max(...(data?.hourly?.precipitation_probability ?? [0]).slice(0, 48)),
    };
  } catch (e: any) {
    setHealth({ id: "openmeteo", name: "Open-Meteo (model, live)", kind: "live", url: "https://open-meteo.com/", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, disclaimer: "Cuaca tidak dapat dicapai.", error: String(e?.message ?? e) };
  }
}

// 3) ADS-B awam (OpenSky, live, had kadar). Gagal lembut → status outage jelas.
export async function getAdsb(lamin = 0.8, lamax = 7.7, lomin = 99.3, lomax = 119.5) {
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
  try {
    const data = await cached("adsb", 120, () => fetchJson(url, 15000)) as any;
    const states = (data?.states ?? []).slice(0, 100).map((s: any[]) => ({ icao: s[0], callsign: (s[1] ?? "").trim(), lon: s[5], lat: s[6], altM: s[7], vel: s[9], time: data?.time }));
    setHealth({ id: "opensky", name: "OpenSky ADS-B (live, had kadar)", kind: "live", url: "https://opensky-network.org/", lastOk: new Date().toISOString(), lastError: null, freshSec: 120 });
    return { live: true as const, count: states.length, states, time: data?.time };
  } catch (e: any) {
    setHealth({ id: "opensky", name: "OpenSky ADS-B (live, had kadar)", kind: "live", url: "https://opensky-network.org/", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, count: 0, states: [], error: "OpenSky tidak dapat dicapai (had kadar/outage). Data ADS-B dilabel TIADA — bukan sifar trafik." };
  }
}
