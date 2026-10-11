// IRIS Malaysia V2.0 — enjin risiko berasaskan bukti (telus, tanpa rekaan).
export type RiskStatus = "LOW" | "GUARDED" | "MODERATE" | "HIGH" | "CRITICAL" | "INSUFFICIENT EVIDENCE";

export interface Evidence {
  observation: string; source: string; sourceUrl: string; timestamp: string; confidence: "tinggi" | "sederhana" | "rendah";
}

export interface RiskAssessment {
  status: RiskStatus; score: number; // 0–100
  category: string; methodology: string;
  factors: { name: string; weight: number; value: number; note: string }[];
  evidence: Evidence[]; limitations: string[]; followUp: string[];
}

const BLOCKED_PATTERNS = [
  /tentera|military|troop|missile|peluru|classified|sulit|serangan hendap|airstrike/i,
];

export function verifyClaim(text: string, evidence: Evidence[]): { ok: boolean; reason?: string } {
  if (BLOCKED_PATTERNS.some((p) => p.test(text)) && evidence.length === 0) {
    return { ok: false, reason: "Dakwaan ketenteraan/terperingkat tanpa bukti disokong DITOLAK oleh Ejen Verifikasi Bukti." };
  }
  return { ok: true };
}

// Skor telus: setiap faktor 0–10 × pemberat; dinormalisasi ke 0–100.
export function assessRisk(input: {
  category: string; methodology: string;
  factors: { name: string; weight: number; value: number; note: string }[];
  evidence: Evidence[]; limitations?: string[]; followUp?: string[];
}): RiskAssessment {
  const factors = input.factors;
  const totalW = factors.reduce((a, f) => a + f.weight, 0) || 1;
  const score = Math.round((factors.reduce((a, f) => a + f.weight * Math.min(10, Math.max(0, f.value)), 0) / totalW) * 10);
  let status: RiskStatus;
  if (input.evidence.length === 0) status = "INSUFFICIENT EVIDENCE";
  else if (score < 20) status = "LOW";
  else if (score < 40) status = "GUARDED";
  else if (score < 60) status = "MODERATE";
  else if (score < 80) status = "HIGH";
  else status = "CRITICAL";
  return {
    status, score, category: input.category, methodology: input.methodology,
    factors, evidence: input.evidence,
    limitations: input.limitations ?? ["Data awam sahaja; liputan tidak lengkap; sahkan dengan portal rasmi sebelum tindakan operasi."],
    followUp: input.followUp ?? ["Pantau semula mengikut selang ditetapkan.", "Semak portal rasmi berkaitan."],
  };
}
