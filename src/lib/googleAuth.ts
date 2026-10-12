// IRIS Malaysia — login Google (Google Identity Services, butang Sign-In).
// Skop: personalisasi paparan + asingkan kegemaran/sejarah per pengguna.
// Token ID disahkan format sahaja di klien (paparan) — bukan kawalan akses pelayan.

export interface GoogleUser {
  sub: string;
  name: string;
  email: string;
  picture: string;
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise: Promise<void> | null = null;

export function getGoogleClientId(): string {
  try {
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? "";
  } catch {
    return "";
  }
}

/** Muat skrip GIS sekali sahaja (selamat tanpa pelayar). */
export function loadGis(): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("tiada DOM"));
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(new Error("GIS gagal dimuat"));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

/** Dekod payload JWT (base64url) tanpa verifikasi — paparan sahaja. */
export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function"
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, "base64").toString("utf8");
    const p = JSON.parse(json);
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

export function toGoogleUser(payload: Record<string, any>): GoogleUser | null {
  if (!payload?.sub) return null;
  return {
    sub: String(payload.sub),
    name: String(payload.name ?? payload.email ?? "Pengguna Google"),
    email: String(payload.email ?? ""),
    picture: String(payload.picture ?? ""),
  };
}

const USER_KEY = "iris-user";

export function loadUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.sub ? (u as GoogleUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(u: GoogleUser | null): void {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* abaikan */
  }
}

/** Keluar: padam sesi tempatan + lumpuh auto-pilih akaun Google. */
export function googleLogout(): void {
  try {
    (window as any).google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* abaikan */
  }
  saveUser(null);
}
