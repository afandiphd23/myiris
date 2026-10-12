// IRIS Malaysia V2.0 — pengiraan IPU (Indeks Pencemaran Udara) gaya JAS + parser pasang surut.
// Metodologi: sistem PSI USEPA seperti dokumen JAS (APIMS/API_Calculation.pdf):
//   - 6 pencemar: SO2 (1j), PM10 (24j), PM2.5 (24j), O3 (8j & 1j), NO2 (1j), CO (8j)
//   - IPU = MAX(sub-indeks) — BUKAN purata. Pencemar dominan = penyumbang tertinggi.
//   - Kategori: 0–50 Baik, 51–100 Sederhana, 101–200 Tidak Sihat,
//     201–300 Sangat Tidak Sihat, >300 Berbahaya.
// Anggaran MODEL daripada data Open-Meteo (bukan stesen CAQM) — IPU rasmi kekal di JAS APIMS.

export interface SubIndex {
  pollutant: string;
  avgHours: number;
  concentration: number | null;
  unit: string;
  value: number | null;
}

export interface IPUResult {
  ipu: number | null;
  categoryMs: string;
  categoryEn: string;
  color: string;
  dominant: string | null;
  subIndices: SubIndex[];
  live: boolean;
  method: string;
  disclaimer: string;
}

export const IPU_CATEGORIES = [
  { max: 50, ms: "Baik", en: "Good", color: "emerald" },
  { max: 100, ms: "Sederhana", en: "Moderate", color: "yellow" },
  { max: 200, ms: "Tidak Sihat", en: "Unhealthy", color: "orange" },
  { max: 300, ms: "Sangat Tidak Sihat", en: "Very Unhealthy", color: "red" },
  { max: 500, ms: "Berbahaya", en: "Hazardous", color: "purple" },
] as const;

export function ipuCategory(ipu: number | null): { ms: string; en: string; color: string } {
  if (ipu == null || !Number.isFinite(ipu)) return { ms: "TIADA data", en: "No data", color: "slate" };
  for (const c of IPU_CATEGORIES) if (ipu <= c.max) return { ms: c.ms, en: c.en, color: c.color };
  return { ms: "Berbahaya", en: "Hazardous", color: "purple" };
}

// Jadual breakpoint [cLo, cHi, iLo, iHi] — disahkan daripada dokumen JAS/APIMS
// (jangkar jalur 0–50: SO2 0.035, O3-8j 0.059, NO2 0.053, CO 0–4.4; PM2.5 penuh 6 jalur).
type Breakpoint = [number, number, number, number];

const PM25_BP: Breakpoint[] = [
  [0, 12.0, 0, 50],
  [12.1, 75.5, 51, 100],
  [75.5, 150.4, 101, 200],
  [150.5, 250.4, 201, 300],
  [250.4, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
];

const PM10_BP: Breakpoint[] = [
  [0, 54, 0, 50],
  [55, 154, 51, 100],
  [155, 254, 101, 200],
  [255, 354, 201, 300],
  [355, 424, 301, 400],
  [425, 604, 401, 500],
];

const SO2_BP: Breakpoint[] = [
  [0, 0.035, 0, 50],
  [0.036, 0.144, 51, 100],
  [0.145, 0.224, 101, 200],
  [0.225, 0.304, 201, 300],
  [0.305, 0.604, 301, 400],
  [0.605, 0.804, 401, 500],
];

const NO2_BP: Breakpoint[] = [
  [0, 0.053, 0, 50],
  [0.054, 0.1, 51, 100],
  [0.101, 0.36, 101, 150],
  [0.361, 0.649, 151, 200],
  [0.65, 1.249, 201, 300],
  [1.25, 1.649, 301, 400],
  [1.65, 2.049, 401, 500],
];

const O3_8H_BP: Breakpoint[] = [
  [0, 0.059, 0, 50],
  [0.06, 0.075, 51, 100],
  [0.076, 0.095, 101, 150],
  [0.096, 0.115, 151, 200],
  [0.116, 0.374, 201, 300],
];

const O3_1H_BP: Breakpoint[] = [
  [0.125, 0.164, 101, 150],
  [0.165, 0.204, 151, 200],
  [0.205, 0.404, 201, 300],
  [0.405, 0.504, 301, 400],
  [0.505, 0.604, 401, 500],
];

const CO_8H_BP: Breakpoint[] = [
  [0, 4.4, 0, 50],
  [4.5, 9.4, 51, 100],
  [9.5, 12.4, 101, 150],
  [12.5, 15.4, 151, 200],
  [15.5, 30.4, 201, 300],
  [30.5, 40.4, 301, 400],
  [40.5, 50.4, 401, 500],
];

/** Interpolasi linear sekeping; dihadkan 0–500. */
export function subIndex(conc: number | null | undefined, table: Breakpoint[]): number | null {
  if (conc == null || !Number.isFinite(conc) || conc < 0) return null;
  for (const [cLo, cHi, iLo, iHi] of table) {
    if (conc <= cHi) {
      const v = ((iHi - iLo) / (cHi - cLo)) * (conc - cLo) + iLo;
      return Math.max(0, Math.min(500, Math.round(v)));
    }
  }
  return 500;
}

// Penukaran µg/m³ → ppm pada 25°C, 1 atm: ppm = µg/m³ × 24.45 / (MW × 1000).
const UG_M3_TO_PPM: Record<string, number> = {
  o3: 24.45 / (48.0 * 1000),
  no2: 24.45 / (46.0055 * 1000),
  so2: 24.45 / (64.066 * 1000),
  co: 24.45 / (28.01 * 1000),
};

export function ugm3ToPpm(ugm3: number | null | undefined, gas: "o3" | "no2" | "so2" | "co"): number | null {
  if (ugm3 == null || !Number.isFinite(ugm3)) return null;
  return ugm3 * UG_M3_TO_PPM[gas];
}

export interface IPUInputs {
  pm10_24h: number | null;
  pm25_24h: number | null;
  o3_8h_ppm: number | null;
  o3_1h_ppm: number | null;
  no2_1h_ppm: number | null;
  so2_1h_ppm: number | null;
  co_8h_ppm: number | null;
}

/** IPU = MAX sub-indeks (formula rasmi JAS). O3 1j hanya diambil kira ≥101 (peraturan AQI/PSI). */
export function computeIPU(inp: IPUInputs): IPUResult {
  const subs: SubIndex[] = [
    { pollutant: "PM2.5 (24j)", avgHours: 24, concentration: inp.pm25_24h, unit: "µg/m³", value: subIndex(inp.pm25_24h, PM25_BP) },
    { pollutant: "PM10 (24j)", avgHours: 24, concentration: inp.pm10_24h, unit: "µg/m³", value: subIndex(inp.pm10_24h, PM10_BP) },
    { pollutant: "O3 (8j)", avgHours: 8, concentration: inp.o3_8h_ppm, unit: "ppm", value: subIndex(inp.o3_8h_ppm, O3_8H_BP) },
    { pollutant: "CO (8j)", avgHours: 8, concentration: inp.co_8h_ppm, unit: "ppm", value: subIndex(inp.co_8h_ppm, CO_8H_BP) },
    { pollutant: "NO2 (1j)", avgHours: 1, concentration: inp.no2_1h_ppm, unit: "ppm", value: subIndex(inp.no2_1h_ppm, NO2_BP) },
    { pollutant: "SO2 (1j)", avgHours: 1, concentration: inp.so2_1h_ppm, unit: "ppm", value: subIndex(inp.so2_1h_ppm, SO2_BP) },
  ];
  // O3 1j: hanya sah untuk IPU ≥101 (peraturan AQI/PSI) — mengatasi 8j hanya jika lebih tinggi.
  const o3_1h_val = inp.o3_1h_ppm != null && inp.o3_1h_ppm >= 0.125 ? subIndex(inp.o3_1h_ppm, O3_1H_BP) : null;
  subs.push({ pollutant: "O3 (1j)", avgHours: 1, concentration: inp.o3_1h_ppm, unit: "ppm", value: o3_1h_val });

  const o3_8h = subs[2].value;
  const valid = subs.filter((s) => {
    if (s.value == null) return false;
    if (s.pollutant === "O3 (1j)") return o3_8h == null || (s.value > o3_8h);
    return true;
  });
  if (valid.length === 0) {
    return {
      ipu: null, categoryMs: "TIADA data", categoryEn: "No data", color: "slate", dominant: null,
      subIndices: subs, live: false,
      method: "IPU = MAX sub-indeks (JAS/APIMS).",
      disclaimer: "Tiada bacaan pencemar — semak portal JAS APIMS.",
    };
  }
  let top = valid[0];
  for (const s of valid) if ((s.value ?? 0) > (top.value ?? 0)) top = s;
  const cat = ipuCategory(top.value);
  return {
    ipu: top.value,
    categoryMs: cat.ms,
    categoryEn: cat.en,
    color: cat.color,
    dominant: top.pollutant,
    subIndices: subs,
    live: true,
    method: "IPU = MAX sub-indeks (JAS/APIMS): purata 24j PM10/PM2.5, 8j O3/CO, 1j NO2/SO2.",
    disclaimer: "Anggaran MODEL daripada Open-Meteo (bukan stesen CAQM). IPU rasmi: JAS APIMS https://apims.doe.gov.my/",
  };
}

// --- Pasang surut (model paras laut Open-Meteo, datum MSL global) ---

export interface TideExtremum { time: string; heightM: number }
export interface TideInfo {
  currentM: number;
  trend: "menaik" | "menurun" | "mendatar";
  trendRateMPerH: number;
  nextHigh: TideExtremum | null;
  nextLow: TideExtremum | null;
  min24hM: number | null;
  max24hM: number | null;
  series24h: { time: string; heightM: number }[];
}

/** Kesan pasang penuh/surut penuh daripada siri jam (maks/milokal) + trend semasa. */
export function parseTideSeries(times: string[], heights: Array<number | null>, nowIso: string): TideInfo | null {
  if (!times.length || times.length !== heights.length) return null;
  let idx = -1;
  for (let i = 0; i < times.length; i++) if (times[i] <= nowIso) idx = i;
  if (idx < 0) idx = 0;
  const cur = heights[idx];
  if (cur == null) return null;

  const prev = idx > 0 ? heights[idx - 1] : null;
  const rate = prev != null ? cur - prev : 0;
  const trend: TideInfo["trend"] = rate > 0.02 ? "menaik" : rate < -0.02 ? "menurun" : "mendatar";

  let nextHigh: TideExtremum | null = null;
  let nextLow: TideExtremum | null = null;
  for (let i = Math.max(1, idx); i < heights.length - 1; i++) {
    const a = heights[i - 1], b = heights[i], c = heights[i + 1];
    if (a == null || b == null || c == null) continue;
    if (!nextHigh && b > a && b >= c) nextHigh = { time: times[i], heightM: b };
    if (!nextLow && b < a && b <= c) nextLow = { time: times[i], heightM: b };
    if (nextHigh && nextLow) break;
  }

  const window = heights.slice(idx, idx + 25).filter((h): h is number => h != null);
  const series24h: TideInfo["series24h"] = [];
  for (let i = idx; i < Math.min(heights.length, idx + 25); i++) {
    if (heights[i] != null) series24h.push({ time: times[i], heightM: heights[i] as number });
  }

  return {
    currentM: cur,
    trend,
    trendRateMPerH: Math.round(rate * 100) / 100,
    nextHigh,
    nextLow,
    min24hM: window.length ? Math.min(...window) : null,
    max24hM: window.length ? Math.max(...window) : null,
    series24h,
  };
}
