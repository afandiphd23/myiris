// IRIS Malaysia V2.0 — Malaysia-only geofencing & geospatial calculations
// Sempadan kasar yang boleh dipercayai (bbox + penapis negeri).
// Semenanjung: lat 1.0–7.65, lon 99.35–104.7
// Sabah/Sarawak: lat 0.85–7.4, lon 109.0–119.4

export const MALAYSIA_CENTER: [number, number] = [4.2, 102.25];
export const MALAYSIA_ZOOM = 6;

export const STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
  "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah",
  "Sarawak", "Selangor", "Terengganu",
  "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya",
] as const;

export interface MYLocation {
  name: string;
  state: string;
  lat: number;
  lon: number;
  kind: "bandar" | "pelabuhan" | "lapangan-terbang" | "maritim" | "daerah" | "sempadan" | "tenaga";
}

export const KEY_LOCATIONS: MYLocation[] = [
  { name: "Port Klang", state: "Selangor", lat: 2.999, lon: 101.392, kind: "pelabuhan" },
  { name: "Tanjung Pelepas", state: "Johor", lat: 1.362, lon: 103.551, kind: "pelabuhan" },
  { name: "Pelabuhan Pulau Pinang", state: "Pulau Pinang", lat: 5.414, lon: 100.347, kind: "pelabuhan" },
  { name: "Pelabuhan Kuantan", state: "Pahang", lat: 3.974, lon: 103.438, kind: "pelabuhan" },
  { name: "Pelabuhan Bintulu", state: "Sarawak", lat: 3.268, lon: 113.062, kind: "pelabuhan" },
  { name: "Pelabuhan Kota Kinabalu", state: "Sabah", lat: 5.985, lon: 116.051, kind: "pelabuhan" },
  { name: "Pelabuhan Pasir Gudang (Johor)", state: "Johor", lat: 1.432, lon: 103.904, kind: "pelabuhan" },
  { name: "Pelabuhan Kemaman", state: "Terengganu", lat: 4.249, lon: 103.465, kind: "pelabuhan" },
  { name: "Pelabuhan Labuan", state: "W.P. Labuan", lat: 5.277, lon: 115.241, kind: "pelabuhan" },
  { name: "Pelabuhan Sandakan", state: "Sabah", lat: 5.84, lon: 118.117, kind: "pelabuhan" },
  { name: "Lumut Maritime Terminal", state: "Perak", lat: 4.242, lon: 100.629, kind: "pelabuhan" },
  { name: "KLIA (KUL)", state: "Selangor", lat: 2.745, lon: 101.71, kind: "lapangan-terbang" },
  { name: "Subang (SZB)", state: "Selangor", lat: 3.13, lon: 101.548, kind: "lapangan-terbang" },
  { name: "Pulau Pinang (PEN)", state: "Pulau Pinang", lat: 5.297, lon: 100.277, kind: "lapangan-terbang" },
  { name: "Kuching (KCH)", state: "Sarawak", lat: 1.484, lon: 110.347, kind: "lapangan-terbang" },
  { name: "Kota Kinabalu (BKI)", state: "Sabah", lat: 5.937, lon: 116.052, kind: "lapangan-terbang" },
  { name: "Senai (JHB)", state: "Johor", lat: 1.641, lon: 103.67, kind: "lapangan-terbang" },
  { name: "Langkawi (LGK)", state: "Kedah", lat: 6.329, lon: 99.728, kind: "lapangan-terbang" },
  { name: "Miri (MYY)", state: "Sarawak", lat: 4.322, lon: 113.987, kind: "lapangan-terbang" },
  { name: "Tawau (TWU)", state: "Sabah", lat: 4.313, lon: 118.121, kind: "lapangan-terbang" },
  { name: "Kota Bharu", state: "Kelantan", lat: 6.133, lon: 102.238, kind: "bandar" },
  { name: "Kuala Lumpur", state: "W.P. Kuala Lumpur", lat: 3.139, lon: 101.687, kind: "bandar" },
  { name: "Putrajaya", state: "W.P. Putrajaya", lat: 2.926, lon: 101.696, kind: "bandar" },
  { name: "Johor Bahru", state: "Johor", lat: 1.492, lon: 103.741, kind: "bandar" },
  { name: "Ipoh", state: "Perak", lat: 4.597, lon: 101.09, kind: "bandar" },
  { name: "Kuala Terengganu", state: "Terengganu", lat: 5.33, lon: 103.14, kind: "bandar" },
  { name: "Kuching", state: "Sarawak", lat: 1.553, lon: 110.359, kind: "bandar" },
  { name: "Kota Kinabalu", state: "Sabah", lat: 5.978, lon: 116.075, kind: "bandar" },
  { name: "Selat Melaka", state: "Melaka", lat: 2.5, lon: 100.5, kind: "maritim" },
  { name: "Laut China Selatan (ZEE Malaysia)", state: "Pahang", lat: 4.5, lon: 105.5, kind: "maritim" },
  { name: "Laut Sulu", state: "Sabah", lat: 6.2, lon: 118.5, kind: "maritim" },
  { name: "Zon Selamat Sabah Timur (ESSZONE — Lahad Datu)", state: "Sabah", lat: 5.026, lon: 118.327, kind: "maritim" },
  { name: "ICQS Bukit Kayu Hitam", state: "Kedah", lat: 6.519, lon: 100.419, kind: "sempadan" },
  { name: "ICQS Rantau Panjang", state: "Kelantan", lat: 6.019, lon: 101.976, kind: "sempadan" },
  { name: "Kompleks Petroleum Pengerang (PIPC)", state: "Johor", lat: 1.365, lon: 104.145, kind: "tenaga" },
  { name: "Empangan Hidro Bakun", state: "Sarawak", lat: 2.762, lon: 114.06, kind: "tenaga" },
];

export interface StrategicCorridor {
  id: string;
  nameMs: string;
  nameEn: string;
  asset: string;
  points: { name: string; state: string; lat: number; lon: number }[];
}

export const STRATEGIC_CORRIDORS: StrategicCorridor[] = [
  {
    id: "selat-melaka",
    nameMs: "Koridor Maritim Selat Melaka",
    nameEn: "Straits of Malacca Maritime Corridor",
    asset: "maritim — Port Klang",
    points: [
      { name: "Pelabuhan Pulau Pinang", state: "Pulau Pinang", lat: 5.414, lon: 100.347 },
      { name: "Lumut Maritime Terminal", state: "Perak", lat: 4.242, lon: 100.629 },
      { name: "Port Klang", state: "Selangor", lat: 2.999, lon: 101.392 },
      { name: "Selat Melaka", state: "Melaka", lat: 2.5, lon: 100.5 },
      { name: "Tanjung Pelepas", state: "Johor", lat: 1.362, lon: 103.551 },
    ],
  },
  {
    id: "monsun-pantai-timur",
    nameMs: "Lembangan Monsun Pantai Timur",
    nameEn: "East Coast Monsoon Basin",
    asset: "bencana — Kelantan",
    points: [
      { name: "Kota Bharu", state: "Kelantan", lat: 6.133, lon: 102.238 },
      { name: "ICQS Rantau Panjang", state: "Kelantan", lat: 6.019, lon: 101.976 },
      { name: "Kuala Terengganu", state: "Terengganu", lat: 5.33, lon: 103.14 },
      { name: "Pelabuhan Kemaman", state: "Terengganu", lat: 4.249, lon: 103.465 },
      { name: "Pelabuhan Kuantan", state: "Pahang", lat: 3.974, lon: 103.438 },
    ],
  },
  {
    id: "borneo-zee",
    nameMs: "Koridor Maritim & Tenaga Borneo (Sabah/Sarawak)",
    nameEn: "Borneo Maritime & Energy Corridor",
    asset: "maritim — Sabah",
    points: [
      { name: "Kuching", state: "Sarawak", lat: 1.553, lon: 110.359 },
      { name: "Pelabuhan Bintulu", state: "Sarawak", lat: 3.268, lon: 113.062 },
      { name: "Pelabuhan Labuan", state: "W.P. Labuan", lat: 5.277, lon: 115.241 },
      { name: "Pelabuhan Kota Kinabalu", state: "Sabah", lat: 5.985, lon: 116.051 },
      { name: "Zon Selamat Sabah Timur (ESSZONE — Lahad Datu)", state: "Sabah", lat: 5.026, lon: 118.327 },
    ],
  },
  {
    id: "hab-penerbangan",
    nameMs: "Rangkaian Hab Penerbangan & Kargo Udara",
    nameEn: "National Aviation & Air Cargo Hubs",
    asset: "penerbangan — KLIA",
    points: [
      { name: "KLIA (KUL)", state: "Selangor", lat: 2.745, lon: 101.71 },
      { name: "Subang (SZB)", state: "Selangor", lat: 3.13, lon: 101.548 },
      { name: "Pulau Pinang (PEN)", state: "Pulau Pinang", lat: 5.297, lon: 100.277 },
      { name: "Kuching (KCH)", state: "Sarawak", lat: 1.484, lon: 110.347 },
      { name: "Kota Kinabalu (BKI)", state: "Sabah", lat: 5.937, lon: 116.052 },
    ],
  },
];

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function isInsideMalaysia(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  const peninsula = lat >= 1.0 && lat <= 7.65 && lon >= 99.35 && lon <= 104.7;
  const borneo = lat >= 0.85 && lat <= 7.4 && lon >= 109.0 && lon <= 119.4;
  if (!peninsula && !borneo) return false;
  // Pengecualian: Singapura & pulau sekitar (selatan Johor) — bukan Malaysia.
  if (lat >= 1.0 && lat < 1.55 && lon >= 103.6 && lon < 104.15) return false;
  return true;
}

export type ZoneKind = "perairan-wilayah" | "zee" | "tuntutan-bertindih" | "darat";

export function classifyZone(lat: number, lon: number): ZoneKind {
  // Heuristik telus (bukan sempadan undang-undang): <12nm dari lokasi pelabuhan utama ≈ perairan wilayah.
  for (const p of KEY_LOCATIONS.filter((k) => k.kind === "pelabuhan")) {
    const d = Math.hypot(lat - p.lat, lon - p.lon);
    if (d < 0.2) return "perairan-wilayah";
  }
  // Kawasan tuntutan bertindih (label jelas, bukan pengesahan): Spratly ≈ utara Sabah.
  if (lat > 5.5 && lat < 8.0 && lon > 111.0 && lon < 118.0) return "tuntutan-bertindih";
  // ZEE: dalam bbox Malaysia tetapi luar perairan wilayah.
  if (isInsideMalaysia(lat, lon)) {
    const sea = lon > 103.5 || lat < 2.0;
    if (sea) return "zee";
    return "darat";
  }
  return "darat";
}

export function validateMYTarget(lat: number, lon: number, label?: string): { ok: boolean; reason?: string } {
  if (!isInsideMalaysia(lat, lon)) {
    return {
      ok: false,
      reason: `Lokasi ${label ?? `${lat},${lon}`} di luar Malaysia. Pemantauan bebas sasaran asing DITOLAK (peraturan Malaysia-only).`,
    };
  }
  return { ok: true };
}
