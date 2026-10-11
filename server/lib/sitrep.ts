// IRIS Malaysia V2.0 — penjana SITREP profesional.
import type { AgentFinding } from "./agents.js";
import type { RiskAssessment } from "./riskEngine.js";

export interface Sitrep {
  reportId: string; title: string;
  location: string; coords: [number, number]; assetCategory: string;
  timestampMYT: string; execSummary: string;
  observations: string[]; risk: RiskAssessment;
  confidence: string; limitations: string[];
  geoContext: string; regulatory: string;
  actions: string[]; citations: { name: string; url: string }[];
  nextReview: string; agents: AgentFinding[];
}

export function buildSitrep(input: {
  location: string; lat: number; lon: number; assetCategory: string;
  risk: RiskAssessment; agents: AgentFinding[];
}): Sitrep {
  const nowMYT = new Date(new Date().getTime() + 8 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " MYT";
  const rid = `IRIS-MY-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const citations = [...new Map(input.agents.flatMap((a) => a.sources).map((s) => [s.url, s])).values()];
  return {
    reportId: rid, title: "IRIS MALAYSIA // NATIONAL SITUATIONAL AWARENESS REPORT",
    location: input.location, coords: [input.lat, input.lon], assetCategory: input.assetCategory,
    timestampMYT: nowMYT,
    execSummary: `${input.location}: status ${input.risk.status} (skor ${input.risk.score}/100) bagi kategori ${input.risk.category}. ${input.risk.evidence.length} pemerhatian disahkan; ${input.risk.limitations.length} batasan direkodkan.`,
    observations: input.risk.evidence.map((e) => `${e.observation} [${e.source}, ${e.timestamp}]`),
    risk: input.risk,
    confidence: input.risk.evidence.length === 0 ? "RENDAH — bukti tidak mencukupi" : "SEDERHANA — berdasarkan sumber awam disahkan",
    limitations: input.risk.limitations,
    geoContext: `Koordinat ${input.lat.toFixed(4)}, ${input.lon.toFixed(4)} dalam Malaysia. Rujuk JUPEM/MyGDI untuk sempadan tepat.`,
    regulatory: "Konteks kawal selia Malaysia: Akta Kastam 1967 (JKDM), notis CAAM (penerbangan), notis Jabatan Laut (maritim), amaran METMalaysia/NADMA (bencana). Bukan pengelasan keselamatan rasmi kerajaan.",
    actions: input.risk.followUp, citations,
    nextReview: input.risk.status === "CRITICAL" || input.risk.status === "HIGH" ? "1 jam" : input.risk.status === "MODERATE" ? "6 jam" : "24 jam",
    agents: input.agents,
  };
}
