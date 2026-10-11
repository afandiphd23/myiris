export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch {
    // Backend langsung tidak dapat dihubungi (tidak berjalan / salah port / CORS blokir pra-penerbangan gagal)
    throw new Error("Backend tidak dapat dihubungi. Jalankan `npm run dev` (backend :3001) dahulu, atau semak URL API.");
  }
  const text = await r.text();
  let j: any = null;
  if (text) {
    try {
      j = JSON.parse(text);
    } catch {
      // Backend/proksi mengembalikan HTML/teks (cth. halaman index, 404 hosting, ralat proksi)
      // — paparkan petikan supaya boleh didiagnos, bukan "Unexpected token" mentah.
      const snippet = text.slice(0, 140).replace(/\s+/g, " ").trim();
      throw new Error(
        `Respons bukan JSON (HTTP ${r.status}): "${snippet}…". ` +
          `Punca biasa: UI dev dibuka tanpa backend — jalankan \`npm run dev\` (:3001) bersama \`npm run dev:client\` (:5173).`
      );
    }
  }
  if (!r.ok) throw new Error(j?.error ?? `Ralat ${r.status}`);
  return j as T;
}
