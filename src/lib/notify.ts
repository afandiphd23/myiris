// IRIS Malaysia — amaran pintar: bunyi + notifikasi pelayar bila skor melepasi ambang.
// Selamat tanpa pelayar (semua akses DOM dilindungi) supaya boleh diuji dalam Node.
import { loadAlerts } from "./store";

/** Bunyi amaran ringkas (WebAudio, tanpa fail aset). */
export function playBeep(freqHz = 880, durationMs = 180): void {
  try {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freqHz;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
  } catch {
    /* audio tidak tersedia — abaikan */
  }
}

/** Minta kebenaran notifikasi (dipanggil daripada tindakan pengguna). */
export async function ensureNotifyPermission(): Promise<boolean> {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Hantar amaran jika skor risiko melepasi ambang simpanan. Pulangkan true jika dicetus. */
export function maybeAlert(result: any): boolean {
  const cfg = loadAlerts();
  const score = result?.risk?.score;
  if (typeof score !== "number" || !Number.isFinite(score)) return false;
  if (score < cfg.threshold) return false;
  if (cfg.sound) playBeep(score >= 85 ? 1040 : 880);
  if (cfg.notify) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`IRIS: ${result.risk.status} (${score}/100)`, {
          body: `${result.label ?? "Sasaran"} — melepasi ambang ${cfg.threshold}`,
          tag: "iris-risk-alert",
        });
      }
    } catch {
      /* abaikan */
    }
  }
  return true;
}
