// IRIS Malaysia — pengurusan tema (gelap lalai, cerah, warga emas).
// Tema dipakai melalui atribut data-theme pada <html>; gelap = tiada atribut (CSS lalai).

export type Theme = "dark" | "light" | "senior";

export const THEMES: Theme[] = ["dark", "light", "senior"];

export const THEME_STORAGE_KEY = "iris-theme";

/** Nilai simpanan yang tidak sah → jatuh ke gelap. Fungsi tulen (boleh diuji). */
export function resolveTheme(raw: string | null | undefined): Theme {
  return raw === "light" || raw === "senior" ? raw : "dark";
}

export function loadTheme(): Theme {
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storan tidak tersedia — abaikan */
  }
}
