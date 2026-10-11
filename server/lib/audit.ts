// IRIS Malaysia V2.0 — log audit (dalam memori; ganti DB untuk produksi).
export interface AuditEntry { at: string; kind: string; detail: string; meta?: unknown }
const log: AuditEntry[] = [];
const seenAlerts = new Set<string>();

export function audit(kind: string, detail: string, meta?: unknown) {
  log.push({ at: new Date().toISOString(), kind, detail, meta });
  if (log.length > 500) log.splice(0, log.length - 500);
}
export function getAudit(): AuditEntry[] { return [...log].reverse(); }

// Deduplikasi amaran: kunci peristiwa + mesej.
export function dedupeAlert(key: string): boolean {
  if (seenAlerts.has(key)) return false;
  seenAlerts.add(key);
  if (seenAlerts.size > 1000) { const [first] = seenAlerts; seenAlerts.delete(first!); }
  return true;
}
