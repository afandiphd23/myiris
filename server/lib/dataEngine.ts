// IRIS Malaysia V2.0 — enjin data masa nyata (sumber sahih sahaja).
// Peraturan: jangan reka endpoint API. Setiap sumber dilabel live/model/pautan-rasmi.
import { computeIPU, parseTideSeries, ugm3ToPpm } from "./ipu.js";
import { KEY_LOCATIONS, haversineKm } from "./geofence.js";

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
  { id: "apims", name: "JAS APIMS — Indeks Pencemaran Udara", url: "https://apims.doe.gov.my/" },
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
    return {
      live: true as const,
      count: data?.features?.length ?? 0,
      events: (data?.features ?? []).slice(0, 25).map((f: any) => ({
        id: f.id,
        mag: f.properties?.mag,
        place: f.properties?.place,
        time: new Date(f.properties?.time).toISOString(),
        url: f.properties?.url,
        coords: f.geometry?.coordinates,
      })),
    };
  } catch (e: any) {
    setHealth({ id: "usgs", name: "USGS Earthquake (live)", kind: "live", url: "https://earthquake.usgs.gov/", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, count: 0, events: [], error: "USGS tidak dapat dicapai — semak sambungan." };
  }
}

// 2) Cuaca model (Open-Meteo, live) + pautan METMalaysia. Dilabel jelas BUKAN data rasmi METMalaysia.
export async function getWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=precipitation_probability,temperature_2m,wind_speed_10m&timezone=Asia%2FKuala_Lumpur&forecast_days=2`;
  try {
    const data = await cached(`wx-${lat.toFixed(2)}-${lon.toFixed(2)}`, 900, () => fetchJson(url)) as any;
    setHealth({ id: "openmeteo", name: "Open-Meteo Weather (model, live)", kind: "model", url: "https://open-meteo.com/", lastOk: new Date().toISOString(), lastError: null, freshSec: 900 });
    const hourlyTimes: string[] = (data?.hourly?.time ?? []).slice(0, 24);
    const hourlyPrecip: number[] = (data?.hourly?.precipitation_probability ?? []).slice(0, 24);
    const hourlyTemp: number[] = (data?.hourly?.temperature_2m ?? []).slice(0, 24);
    const hourlyWind: number[] = (data?.hourly?.wind_speed_10m ?? []).slice(0, 24);
    const forecast24h = hourlyTimes.map((t, i) => ({
      time: t,
      precipProb: hourlyPrecip[i] ?? 0,
      tempC: hourlyTemp[i] ?? null,
      windKmh: hourlyWind[i] ?? null,
    }));
    return {
      live: true as const,
      disclaimer: "Data model cuaca (bukan amaran rasmi). Untuk amaran rasmi rujuk METMalaysia.",
      metMalaysia: "https://www.met.gov.my/",
      current: data?.current,
      precipProbMax: Math.max(...(data?.hourly?.precipitation_probability ?? [0]).slice(0, 48)),
      forecast24h,
    };
  } catch (e: any) {
    setHealth({ id: "openmeteo", name: "Open-Meteo Weather (model, live)", kind: "model", url: "https://open-meteo.com/", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, disclaimer: "Cuaca tidak dapat dicapai.", error: String(e?.message ?? e), forecast24h: [] };
  }
}

// 3) Maritim, Ombak & Pasang Surut (Open-Meteo Marine API, model, live)
// Paras laut = sea_level_height_msl (termasuk pasang surut astronomi, datum MSL global — BUKAN LAT
// carta nautika; ketepatan terhad berhampiran pantai; tidak sesuai untuk navigasi).
export async function getMarineWeather(lat: number, lon: number) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,swell_wave_height,sea_level_height_msl&hourly=wave_height,sea_level_height_msl&timezone=Asia%2FKuala_Lumpur&forecast_days=2`;
  try {
    const data = await cached(`marine-${lat.toFixed(2)}-${lon.toFixed(2)}`, 900, () => fetchJson(url, 8000)) as any;
    const waveHeight = data?.current?.wave_height ?? null;
    const wavePeriod = data?.current?.wave_period ?? null;
    const waveDirection = data?.current?.wave_direction ?? null;
    const maxWave24h = Math.max(0, ...((data?.hourly?.wave_height ?? []).filter((x: any) => typeof x === "number").slice(0, 24)));
    const tide = parseTideSeries(
      data?.hourly?.time ?? [],
      data?.hourly?.sea_level_height_msl ?? [],
      data?.current?.time ?? ""
    );
    setHealth({ id: "openmeteo-marine", name: "Open-Meteo Marine (model, live)", kind: "model", url: "https://open-meteo.com/en/docs/marine-weather-api", lastOk: new Date().toISOString(), lastError: null, freshSec: 900 });
    return {
      live: waveHeight != null,
      waveHeightM: waveHeight,
      wavePeriodS: wavePeriod,
      waveDirectionDeg: waveDirection,
      maxWave24hM: maxWave24h || waveHeight || 0,
      tide,
      tideDatum: "MSL global (model) — bukan LAT carta nautika; anggaran kasar berhampiran pantai.",
      disclaimer: "Model ombak & paras laut Open-Meteo. Rujuk Notis Pelayaran Jabatan Laut Malaysia & jadual pasang surut rasmi.",
    };
  } catch (e: any) {
    setHealth({ id: "openmeteo-marine", name: "Open-Meteo Marine (model, live)", kind: "model", url: "https://open-meteo.com/en/docs/marine-weather-api", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, waveHeightM: null, wavePeriodS: null, waveDirectionDeg: null, maxWave24hM: 0, tide: null, error: String(e?.message ?? e) };
  }
}

// Purata ke belakang (purata N jam terakhir sehingga indeks kini) untuk pengiraan IPU.
function avgPast(values: Array<number | null> | undefined, endIdx: number, n: number): number | null {
  if (!values?.length || endIdx < 0) return null;
  const slice = values.slice(Math.max(0, endIdx - n + 1), endIdx + 1).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!slice.length) return null;
  return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
}

// 4) Kualiti Udara, Jerebu & IPU (Open-Meteo Air Quality API, model, live)
// IPU dikira gaya JAS (IPU = MAX sub-indeks; purata 24j PM, 8j O3/CO, 1j NO2/SO2)
// daripada siri jam model — anggaran SAHAJA; IPU rasmi kekal di JAS APIMS.
export async function getAirQuality(lat: number, lon: number) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=Asia%2FKuala_Lumpur&past_days=1&forecast_days=1`;
  try {
    const data = await cached(`aq-${lat.toFixed(2)}-${lon.toFixed(2)}`, 900, () => fetchJson(url, 8000)) as any;
    const aqi = data?.current?.us_aqi ?? null;
    const pm25 = data?.current?.pm2_5 ?? null;
    const pm10 = data?.current?.pm10 ?? null;
    const hourly = data?.hourly ?? {};
    const times: string[] = hourly.time ?? [];
    let endIdx = -1;
    const nowT = data?.current?.time ?? "";
    for (let i = 0; i < times.length; i++) if (times[i] <= nowT) endIdx = i;

    const pm10_24h = avgPast(hourly.pm10, endIdx, 24);
    const pm25_24h = avgPast(hourly.pm2_5, endIdx, 24);
    const o3_8h = avgPast(hourly.ozone, endIdx, 8);
    const co_8h = avgPast(hourly.carbon_monoxide, endIdx, 8);
    const ipu = computeIPU({
      pm10_24h,
      pm25_24h,
      o3_8h_ppm: ugm3ToPpm(o3_8h, "o3"),
      o3_1h_ppm: ugm3ToPpm(data?.current?.ozone ?? null, "o3"),
      no2_1h_ppm: ugm3ToPpm(data?.current?.nitrogen_dioxide ?? null, "no2"),
      so2_1h_ppm: ugm3ToPpm(data?.current?.sulphur_dioxide ?? null, "so2"),
      co_8h_ppm: ugm3ToPpm(co_8h, "co"),
    });
    setHealth({ id: "openmeteo-aq", name: "Open-Meteo Air Quality (model, live)", kind: "model", url: "https://open-meteo.com/en/docs/air-quality-api", lastOk: new Date().toISOString(), lastError: null, freshSec: 900 });
    return {
      live: aqi != null || pm25 != null,
      aqi,
      pm25,
      pm10,
      averages: { pm10_24h, pm25_24h, o3_8h_ugm3: o3_8h, co_8h_ugm3: co_8h },
      ipu,
      apimsUrl: "https://apims.doe.gov.my/",
      disclaimer: "Model kualiti udara + anggaran IPU gaya JAS (bukan bacaan stesen CAQM). Sahkan IPU rasmi melalui portal JAS APIMS.",
    };
  } catch (e: any) {
    setHealth({ id: "openmeteo-aq", name: "Open-Meteo Air Quality (model, live)", kind: "model", url: "https://open-meteo.com/en/docs/air-quality-api", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, aqi: null, pm25: null, pm10: null, ipu: { ipu: null, live: false, categoryMs: "TIADA data", categoryEn: "No data", color: "slate", dominant: null, subIndices: [] }, apimsUrl: "https://apims.doe.gov.my/", error: String(e?.message ?? e) };
  }
}

// 5) ADS-B awam (OpenSky, live, had kadar). Gagal lembut → status outage jelas.
export async function getAdsb(lamin = 0.8, lamax = 7.7, lomin = 99.3, lomax = 119.5) {
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
  try {
    const data = await cached("adsb", 120, () => fetchJson(url, 15000)) as any;
    const states = (data?.states ?? []).slice(0, 120).map((s: any[]) => ({
      icao: s[0],
      callsign: (s[1] ?? "").trim(),
      originCountry: s[2] ?? "",
      lon: s[5],
      lat: s[6],
      altM: s[7],
      vel: s[9],
      heading: s[10],
      time: data?.time,
    }));
    setHealth({ id: "opensky", name: "OpenSky ADS-B (live, had kadar)", kind: "live", url: "https://opensky-network.org/", lastOk: new Date().toISOString(), lastError: null, freshSec: 120 });
    return { live: true as const, count: states.length, states, time: data?.time };
  } catch (e: any) {
    setHealth({ id: "opensky", name: "OpenSky ADS-B (live, had kadar)", kind: "live", url: "https://opensky-network.org/", lastOk: null, lastError: String(e?.message ?? e), freshSec: null });
    return { live: false as const, count: 0, states: [], error: "OpenSky tidak dapat dicapai (had kadar/outage). Data ADS-B dilabel TIADA — bukan sifar trafik." };
  }
}

// 6) Papan penerbangan: jejak ADS-B dikelompokkan ke lapangan terbang utama Malaysia.
// Setiap pesawat diserahkan kepada airport TERDEKAT dalam radius (laluan atas/jelajah di luar
// radius dilabel en-route). BUKAN jadual berlepas/ketibaan syarikat — itu kekal dengan operator/CAAM.
export const FLIGHT_RADIUS_KM = 80;

export interface FlightRow {
  callsign: string; icao: string; originCountry: string;
  lat: number | null; lon: number | null;
  altM: number | null; velKmh: number | null; heading: number | null;
  distKm: number;
}

export interface AirportBoard {
  name: string; state: string; lat: number; lon: number;
  count: number; flights: FlightRow[];
}

export function groupFlightsByAirport(states: any[], radiusKm = FLIGHT_RADIUS_KM): { boards: AirportBoard[]; enRoute: FlightRow[] } {
  const airports = KEY_LOCATIONS.filter((k) => k.kind === "lapangan-terbang");
  const boards: AirportBoard[] = airports.map((a) => ({ name: a.name, state: a.state, lat: a.lat, lon: a.lon, count: 0, flights: [] }));
  const enRoute: FlightRow[] = [];

  for (const s of states ?? []) {
    if (!Number.isFinite(s?.lat) || !Number.isFinite(s?.lon)) continue;
    let best: AirportBoard | null = null;
    let bestDist = Infinity;
    for (const b of boards) {
      const d = haversineKm(s.lat, s.lon, b.lat, b.lon);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    const row: FlightRow = {
      callsign: (s.callsign || s.icao || "").trim() || "N/A",
      icao: s.icao ?? "",
      originCountry: s.originCountry ?? "",
      lat: s.lat, lon: s.lon,
      altM: Number.isFinite(s.altM) ? Math.round(s.altM) : null,
      velKmh: Number.isFinite(s.vel) ? Math.round(s.vel * 3.6) : null,
      heading: Number.isFinite(s.heading) ? Math.round(s.heading) : null,
      distKm: Math.round(bestDist * 10) / 10,
    };
    if (best && bestDist <= radiusKm) {
      best.flights.push(row);
      best.count++;
    } else {
      enRoute.push(row);
    }
  }
  for (const b of boards) b.flights.sort((x, y) => x.distKm - y.distKm);
  enRoute.sort((x, y) => x.distKm - y.distKm);
  boards.sort((x, y) => y.count - x.count);
  return { boards, enRoute };
}

export async function getFlightBoards() {
  const adsb = await getAdsb();
  if (!adsb.live) {
    return { live: false as const, fetchedAt: new Date().toISOString(), count: 0, boards: [], enRoute: [], error: adsb.error };
  }
  const { boards, enRoute } = groupFlightsByAirport(adsb.states);
  return { live: true as const, fetchedAt: new Date().toISOString(), count: adsb.count, boards, enRoute, radiusKm: FLIGHT_RADIUS_KM };
}
