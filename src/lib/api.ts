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
      const isVercelNotFound =
        /could not be found/i.test(text) || /NOT_FOUND/.test(text) || /vercel/i.test(snippet);
      const hint = isVercelNotFound
        ? `API tidak ditemui di Vercel (NOT_FOUND). Semak: 1) vercel.json mengandungi rewrite "/api/:path*" → "/api", ` +
          `2) folder api/ ter-deploy, 3) redeploy selepas commit. Local: jalankan \`npm run dev\` (:3001) bersama \`npm run dev:client\` (:5173).`
        : `Punca biasa: UI dev dibuka tanpa backend — jalankan \`npm run dev\` (:3001) bersama \`npm run dev:client\` (:5173).`;
      throw new Error(`Respons bukan JSON (HTTP ${r.status}): "${snippet}…". ` + hint);
    }
  }
  if (!r.ok) throw new Error(j?.error ?? `Ralat ${r.status}`);
  return j as T;
}
