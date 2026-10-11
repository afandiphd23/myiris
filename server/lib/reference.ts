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

export interface FloodProne {
  district: string;
  state: string;
  river: string;
  note: string;
  lat?: number;
  lon?: number;
}

export const FLOOD_PRONE: FloodProne[] = [
  { district: "Rantau Panjang", state: "Kelantan", river: "Sg. Golok", note: "Limpahan tahunan monsun timur laut; sahkan InfoBanjir.", lat: 6.019, lon: 101.976 },
  { district: "Pasir Mas", state: "Kelantan", river: "Sg. Kelantan", note: "Lembangan rendah; sahkan InfoBanjir.", lat: 6.043, lon: 102.142 },
  { district: "Tumpat", state: "Kelantan", river: "Sg. Kelantan", note: "Muara; risiko banjir + air pasang; sahkan InfoBanjir.", lat: 6.198, lon: 102.171 },
  { district: "Kuala Krai", state: "Kelantan", river: "Sg. Kelantan", note: "Hulu; kenaikan pantas; sahkan InfoBanjir.", lat: 5.531, lon: 102.202 },
  { district: "Kemaman", state: "Terengganu", river: "Sg. Kemaman", note: "Monsun timur laut; sahkan InfoBanjir.", lat: 4.233, lon: 103.418 },
  { district: "Besut", state: "Terengganu", river: "Sg. Besut", note: "Lembangan rendah; sahkan InfoBanjir.", lat: 5.83, lon: 102.55 },
  { district: "Kuantan", state: "Pahang", river: "Sg. Kuantan", note: "Banjir kilat bandar + monsun; sahkan InfoBanjir.", lat: 3.808, lon: 103.326 },
  { district: "Temerloh", state: "Pahang", river: "Sg. Pahang", note: "Lembangan Sg. Pahang; sahkan InfoBanjir.", lat: 3.451, lon: 102.418 },
  { district: "Segamat", state: "Johor", river: "Sg. Muar", note: "Lembangan pedalaman; sahkan InfoBanjir.", lat: 2.515, lon: 102.816 },
  { district: "Kota Tinggi", state: "Johor", river: "Sg. Johor", note: "Timur Johor; sahkan InfoBanjir.", lat: 1.738, lon: 103.899 },
  { district: "Beaufort", state: "Sabah", river: "Sg. Padas", note: "Dataran banjir barat Sabah; sahkan InfoBanjir.", lat: 5.347, lon: 115.746 },
  { district: "Bintulu", state: "Sarawak", river: "Sg. Kemena", note: "Pantai + hujan lebat; sahkan InfoBanjir.", lat: 3.171, lon: 113.041 },
];

// Operator rangkaian yang didokumenkan awam (bukan dakwaan status semasa).
export const INFRA_OPERATORS = {
  highway: ["PLUS Expressways (PLUS)", "LPT2 / LPT (pantai timur)", "JKR (jalan persekutuan/negeri)"],
  rail: ["KTM (ETS/Komuter/Intercity)", "ECRL (dalam pembinaan — rujuk MRL)", "Rapid Rail (LRT/MRT/Monorel KL)"],
  energy: ["TNB — Grid Nasional Semenanjung", "SESB — Sabah", "SEB — Sarawak"],
  water: ["SPAN / operator air negeri (cth. Air Selangor, SAMB, LAP)"],
} as const;

export interface CustomsTariffRef {
  hsPrefix: string;
  commodityMs: string;
  commodityEn: string;
  actRef: string;
  agency: string;
  permitNoteMs: string;
  permitNoteEn: string;
  keyPorts: string[];
}

export const CUSTOMS_REFERENCE: CustomsTariffRef[] = [
  {
    hsPrefix: "1511",
    commodityMs: "Minyak Sawit Mentah & Bertapis (CPO / RBD Palm Oil)",
    commodityEn: "Crude & Refined Palm Oil (CPO / RBD)",
    actRef: "Akta Kastam 1967 (Perintah Duti Kastam) & Akta MPOB 1998",
    agency: "JKDM · MPOB · MITI",
    permitNoteMs: "Lesen eksport MPOB & pengisytiharan Borang Kastam K2 wajib; semak kadar duti eksport bulanan JKDM.",
    permitNoteEn: "MPOB export license & Customs Form K2 declaration required; verify monthly JKDM export duty gazette.",
    keyPorts: ["Port Klang", "Tanjung Pelepas", "Pelabuhan Kuantan", "Pelabuhan Bintulu", "Pelabuhan Sandakan"],
  },
  {
    hsPrefix: "2711",
    commodityMs: "Gas Asli Cecair (LNG) & Produk Petroleum",
    commodityEn: "Liquefied Natural Gas (LNG) & Petroleum Products",
    actRef: "Akta Kastam 1967 & Akta Kemajuan Petroleum 1974 (PDA)",
    agency: "JKDM · PETRONAS · MITI",
    permitNoteMs: "Kawalan eksport/import bahan api pukal; pengesahan manifest kargo laut & pelepasan pelabuhan berlesen.",
    permitNoteEn: "Bulk fuel export/import control; marine cargo manifest verification & licensed port clearance.",
    keyPorts: ["Pelabuhan Bintulu", "Kompleks Petroleum Pengerang (PIPC)", "Pelabuhan Kemaman", "Port Klang"],
  },
  {
    hsPrefix: "8542",
    commodityMs: "Litar Bersepadu Elektronik & Semikonduktor (E&E)",
    commodityEn: "Electronic Integrated Circuits & Semiconductors",
    actRef: "Akta Kastam 1967 & Akta Perdagangan Strategik 2010 (STA 2010)",
    agency: "MITI (STS) · JKDM",
    permitNoteMs: "Semak Senarai Barangan Strategik (STA 2010) bagi komponen dwi-guna sebelum eksport/transhipment.",
    permitNoteEn: "Verify Strategic Items List (STA 2010) for dual-use components prior to export or transhipment.",
    keyPorts: ["Pulau Pinang (PEN)", "Pelabuhan Pulau Pinang", "KLIA (KUL)", "Tanjung Pelepas"],
  },
  {
    hsPrefix: "4407",
    commodityMs: "Kayu Balak & Produk Perkayuan Tropika",
    commodityEn: "Sawn Timber & Tropical Forestry Products",
    actRef: "Akta Kastam 1967 (Perintah Larangan Eksport) & Akta MTIB",
    agency: "JKDM · MTIB · STIDC (Sarawak) · Jabatan Perhutanan Sabah",
    permitNoteMs: "Permit Eksport (AP) daripada MTIB / STIDC / Perhutanan Sabah diperlukan berserta sijil asal fizikal.",
    permitNoteEn: "Export Permit (AP) from MTIB / STIDC / Sabah Forestry required with physical certificate of origin.",
    keyPorts: ["Pelabuhan Bintulu", "Pelabuhan Sandakan", "Port Klang", "Pelabuhan Tanjung Manis"],
  },
  {
    hsPrefix: "0201",
    commodityMs: "Daging, Hasil Ternakan & Makanan Sejuk Beku",
    commodityEn: "Chilled/Frozen Meat, Livestock & Food Imports",
    actRef: "Akta Kastam 1967 & Akta Perkhidmatan Kuarantin dan Pemeriksaan Malaysia 2011 (Akta 728)",
    agency: "MAQIS · JKDM · JAKIM · DVS",
    permitNoteMs: "Permit import MAQIS, sijil kesihatan veterinar (DVS) & pengesahan halal JAKIM wajib di pintu masuk.",
    permitNoteEn: "MAQIS import permit, DVS veterinary health certificate & JAKIM halal certification mandatory at entry point.",
    keyPorts: ["Port Klang", "Tanjung Pelepas", "KLIA (KUL)", "ICQS Bukit Kayu Hitam", "ICQS Rantau Panjang"],
  },
  {
    hsPrefix: "2844",
    commodityMs: "Bahan Kimia Industri, Prekursor & Barangan Kawalan Dwi-Guna",
    commodityEn: "Industrial Chemicals, Precursors & Dual-Use Controlled Goods",
    actRef: "Akta Perdagangan Strategik 2010 (Akta 708) & Akta Kastam 1967",
    agency: "MITI · JKDM · AELB / Jabatan Alam Sekitar",
    permitNoteMs: "Wajib permit STA 2010 bagi eksport, transit, atau pemindahan teknologi barangan terkawal.",
    permitNoteEn: "Mandatory STA 2010 permit for export, transit, or technology transfer of controlled items.",
    keyPorts: ["Port Klang", "Tanjung Pelepas", "Pelabuhan Kuantan", "KLIA (KUL)"],
  },
];

export function searchCustomsReference(query?: string): CustomsTariffRef[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return CUSTOMS_REFERENCE;
  return CUSTOMS_REFERENCE.filter(
    (c) =>
      c.hsPrefix.toLowerCase().includes(q) ||
      c.commodityMs.toLowerCase().includes(q) ||
      c.commodityEn.toLowerCase().includes(q) ||
      c.actRef.toLowerCase().includes(q) ||
      c.agency.toLowerCase().includes(q) ||
      c.keyPorts.some((p) => p.toLowerCase().includes(q))
  );
}

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
