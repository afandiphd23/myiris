// IRIS Malaysia — utiliti geo selamat-klien (tiada kebergantungan pelayar).

const RAD = Math.PI / 180;
const EARTH_KM = 6371;

/** Jarak Haversine (km) antara dua titik. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * RAD;
  const dLon = (bLon - aLon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

/** Pecahan kaki (legs) + jumlah jarak laluan ukuran. */
export function measurePath(points: [number, number][]): { legs: number[]; total: number } {
  const legs: number[] = [];
  for (let i = 1; i < points.length; i++) {
    legs.push(Math.round(haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]) * 10) / 10);
  }
  return { legs, total: Math.round(legs.reduce((a, b) => a + b, 0) * 10) / 10 };
}
