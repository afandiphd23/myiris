// IRIS Malaysia V2.0 — dataset rujukan statik (didokumenkan awam, BUKAN data live).
// Semua entri dilabel RUJUKAN — status semasa mesti disahkan melalui portal rasmi / operator.

export const STATE_CENTERS: Record<string, [number, number]> = {
  "Johor": [1.934, 103.358], "Kedah": [6.118, 100.368], "Kelantan": [5.592, 102.117],
  "Melaka": [2.237, 102.251], "Negeri Sembilan": [2.725, 102.237], "Pahang": [3.812, 102.325],
  "Perak": [4.597, 101.091], "Perlis": [6.444, 100.199], "Pulau Pinang": [5.414, 100.329],
  "Sabah": [5.42, 116.8], "Sarawak": [1.8, 113.5], "Selangor": [3.073, 101.518],
  "Terengganu": [5.311, 103.132], "W.P. Kuala Lumpur": [3.139, 101.687],
  "W.P. Labuan": [5.276, 115.242], "W.P. Putrajaya": [2.926, 101.696],
};

export interface FloodProne { district: string; state: string; river: string; note: string; }

export const FLOOD_PRONE: FloodProne[] = [
  { district: "Rantau Panjang", state: "Kelantan", river: "Sg. Golok", note: "Limpahan tahunan monsun timur laut; sahkan InfoBanjir." },
  { district: "Pasir Mas", state: "Kelantan", river: "Sg. Kelantan", note: "Lembangan rendah; sahkan InfoBanjir." },
  { district: "Tumpat", state: "Kelantan", river: "Sg. Kelantan", note: "Muara; risiko banjir + air pasang; sahkan InfoBanjir." },
  { district: "Kuala Krai", state: "Kelantan", river: "Sg. Kelantan", note: "Hulu; kenaikan pantas; sahkan InfoBanjir." },
  { district: "Kemaman", state: "Terengganu", river: "Sg. Kemaman", note: "Monsun timur laut; sahkan InfoBanjir." },
  { district: "Besut", state: "Terengganu", river: "Sg. Besut", note: "Lembangan rendah; sahkan InfoBanjir." },
  { district: "Kuantan", state: "Pahang", river: "Sg. Kuantan", note: "Banjir kilat bandar + monsun; sahkan InfoBanjir." },
  { district: "Temerloh", state: "Pahang", river: "Sg. Pahang", note: "Lembangan Sg. Pahang; sahkan InfoBanjir." },
  { district: "Segamat", state: "Johor", river: "Sg. Muar", note: "Lembangan pedalaman; sahkan InfoBanjir." },
  { district: "Kota Tinggi", state: "Johor", river: "Sg. Johor", note: "Timur Johor; sahkan InfoBanjir." },
  { district: "Beaufort", state: "Sabah", river: "Sg. Padas", note: "Dataran banjir barat Sabah; sahkan InfoBanjir." },
  { district: "Bintulu", state: "Sarawak", river: "Sg. Kemena", note: "Pantai + hujan lebat; sahkan InfoBanjir." },
];

// Operator rangkaian yang didokumenkan awam (bukan dakwaan status semasa).
export const INFRA_OPERATORS = {
  highway: ["PLUS Expressways (PLUS)", "LPT2 / LPT (pantai timur)", "JKR (jalan persekutuan/negeri)"],
  rail: ["KTM (ETS/Komuter/Intercity)", "ECRL (dalam pembinaan — rujuk MRL)", "Rapid Rail (LRT/MRT/Monorel KL)"],
  energy: ["TNB — Grid Nasional Semenanjung", "SESB — Sabah", "SEB — Sarawak"],
  water: ["SPAN / operator air negeri (cth. Air Selangor, SAMB, LAP)"],
} as const;

export function getAdvisories(state?: string): { floodProne: FloodProne[]; operators: typeof INFRA_OPERATORS; state: string | null } {
  const s = (state ?? "").trim();
  const floodProne = s ? FLOOD_PRONE.filter((f) => f.state.toLowerCase() === s.toLowerCase()) : FLOOD_PRONE;
  return { floodProne, operators: INFRA_OPERATORS, state: s || null };
}

// Agregat garis masa gempa 30 hari daripada peristiwa USGS (data live → carta).
export interface QuakeBucket { date: string; count: number; maxMag: number | null }
export function buildQuakeTimeline(events: { time: string; mag: number | null }[]): QuakeBucket[] {
  const days: QuakeBucket[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ date: d, count: 0, maxMag: null });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const e of events) {
    const k = String(e.time).slice(0, 10);
    const b = byDate.get(k);
    if (!b) continue;
    b.count++;
    if (e.mag != null && (b.maxMag == null || e.mag > b.maxMag)) b.maxMag = e.mag;
  }
  return days;
}
