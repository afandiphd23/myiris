export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error ?? `Ralat ${r.status}`);
  return j as T;
}
