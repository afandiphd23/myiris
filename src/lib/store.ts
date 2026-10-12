// IRIS Malaysia — storan tempatan (kegemaran, sejarah, tetapan amaran, kongsi pautan).
// Semua fungsi selamat tanpa pelayar (try/catch) supaya boleh diuji dalam Node.

export interface FavPlace { name: string; lat: number; lon: number; state: string }
export interface HistoryEntry { label: string; lat: number; lon: number; score: number; status: string; time: number }
export interface AlertConfig { threshold: number; notify: boolean; sound: boolean }

export const DEFAULT_ALERTS: AlertConfig = { threshold: 70, notify: false, sound: false };
const HISTORY_CAP = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* abaikan */
  }
}

const favKey = (userSub?: string | null) => (userSub ? `iris-favs-${userSub}` : "iris-favs");
const histKey = (userSub?: string | null) => (userSub ? `iris-history-${userSub}` : "iris-history");

export function loadFavs(userSub?: string | null): FavPlace[] {
  const v = read<FavPlace[]>(favKey(userSub), []);
  return Array.isArray(v) ? v.filter((f) => f && Number.isFinite(f.lat) && Number.isFinite(f.lon)) : [];
}
export function saveFavs(favs: FavPlace[], userSub?: string | null): void { write(favKey(userSub), favs); }

export function loadHistory(userSub?: string | null): HistoryEntry[] {
  const v = read<HistoryEntry[]>(histKey(userSub), []);
  return Array.isArray(v) ? v : [];
}
export function recordHistory(e: HistoryEntry, userSub?: string | null): HistoryEntry[] {
  const h = [e, ...loadHistory(userSub)].slice(0, HISTORY_CAP);
  write(histKey(userSub), h);
  return h;
}

export function loadAlerts(): AlertConfig {
  const v = read<Partial<AlertConfig>>("iris-alerts", {});
  const threshold = Number(v?.threshold);
  return {
    threshold: Number.isFinite(threshold) ? Math.min(100, Math.max(0, Math.round(threshold))) : DEFAULT_ALERTS.threshold,
    notify: v?.notify === true,
    sound: v?.sound === true,
  };
}
export function saveAlerts(cfg: AlertConfig): void { write("iris-alerts", cfg); }

// Kongsi pautan analisis: #a=<base64url JSON {lat,lon,label,state,asset,scenario}>
export function encodeShare(p: { lat: number; lon: number; label: string; state: string; asset: string; scenario: string }): string {
  const json = JSON.stringify(p);
  const b64 = typeof btoa === "function"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(code: string): { lat: number; lon: number; label: string; state: string; asset: string; scenario: string } | null {
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function"
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, "base64").toString("utf8");
    const p = JSON.parse(json);
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) return null;
    return {
      lat: p.lat, lon: p.lon,
      label: String(p.label ?? `${p.lat},${p.lon}`).slice(0, 200),
      state: String(p.state ?? "").slice(0, 60),
      asset: String(p.asset ?? "umum").slice(0, 200),
      scenario: String(p.scenario ?? "live").slice(0, 40),
    };
  } catch {
    return null;
  }
}
