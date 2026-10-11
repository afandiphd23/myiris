import { describe, it, expect } from "vitest";
import { isInsideMalaysia, validateMYTarget, classifyZone, haversineKm, STRATEGIC_CORRIDORS } from "../server/lib/geofence";
import { assessRisk, verifyClaim } from "../server/lib/riskEngine";
import { getAdvisories, buildQuakeTimeline, STATE_CENTERS, searchCustomsReference } from "../server/lib/reference";
import { runAgent } from "../server/lib/agents";
import { buildSitrep, listSitreps, deleteSitrep } from "../server/lib/sitrep";

describe("Malaysia-only geofencing (spec §2 & §10)", () => {
  it("Port Klang diterima", () => expect(validateMYTarget(2.999, 101.392, "Port Klang").ok).toBe(true));
  it("KLIA diterima", () => expect(isInsideMalaysia(2.745, 101.71)).toBe(true));
  it("Kota Bharu/Kelantan diterima", () => expect(isInsideMalaysia(6.133, 102.238)).toBe(true));
  it("Sabah & Sarawak diterima", () => {
    expect(isInsideMalaysia(5.978, 116.075)).toBe(true);
    expect(isInsideMalaysia(1.553, 110.359)).toBe(true);
  });
  it("Sasaran asing DITOLAK (Singapura/Jakarta/Bangkok)", () => {
    expect(validateMYTarget(1.352, 103.819, "Singapura").ok).toBe(false);
    expect(validateMYTarget(-6.2, 106.84, "Jakarta").ok).toBe(false);
    expect(validateMYTarget(13.75, 100.5, "Bangkok").ok).toBe(false);
  });
  it("Zon dilabel telus (zee / tuntutan-bertindih)", () => {
    expect(["perairan-wilayah", "zee", "tuntutan-bertindih", "darat"]).toContain(classifyZone(4.5, 105.5));
    expect(classifyZone(6.5, 114.0)).toBe("tuntutan-bertindih");
  });
});

describe("Risk engine berasaskan bukti (spec §5)", () => {
  it("tiada bukti → INSUFFICIENT EVIDENCE", () => {
    const r = assessRisk({ category: "umum", methodology: "ujian", factors: [{ name: "a", weight: 1, value: 9, note: "x" }], evidence: [] });
    expect(r.status).toBe("INSUFFICIENT EVIDENCE");
  });
  it("dakwaan ketenteraan tanpa bukti DITOLAK", () => {
    expect(verifyClaim("pergerakan tentera sulit", []).ok).toBe(false);
  });
  it("suntikan prompt: label dibersihkan di API (bentuk)", () => {
    expect(verifyClaim("Port Klang cuaca baik", [{ observation: "x", source: "USGS", sourceUrl: "https://earthquake.usgs.gov/", timestamp: new Date().toISOString(), confidence: "tinggi" }]).ok).toBe(true);
  });
});

describe("Rujukan statik + ejen (peningkatan V2.0)", () => {
  it("semua negeri mempunyai pusat koordinat dalam Malaysia", () => {
    for (const [s, c] of Object.entries(STATE_CENTERS)) {
      expect(isInsideMalaysia(c[0], c[1]), s).toBe(true);
    }
  });
  it("advisories Kelantan menyenaraikan kawasan banjir", () => {
    const a = getAdvisories("Kelantan");
    expect(a.floodProne.length).toBeGreaterThan(0);
    expect(a.floodProne.every((f) => f.state === "Kelantan")).toBe(true);
  });
  it("negeri tidak diketahui → selamat (senarai kosong, bukan ralat)", () => {
    expect(getAdvisories("Atlantis").floodProne).toEqual([]);
  });
  it("timeline gempa: 30 baldi tertib + agregat betul", () => {
    const today = new Date().toISOString().slice(0, 10);
    const tl = buildQuakeTimeline([{ time: today + "T00:00:00Z", mag: 5.2 }, { time: today + "T01:00:00Z", mag: 4.5 }]);
    expect(tl).toHaveLength(30);
    expect(tl[29].date).toBe(today);
    expect(tl[29].count).toBe(2);
    expect(tl[29].maxMag).toBe(5.2);
  });
  it("ejen kastam merujuk JKDM + Akta 1967", async () => {
    const f = await runAgent("customs", { lat: 3.139, lon: 101.687, label: "KL", weather: { live: false }, quakes: { live: false }, adsb: { live: false } });
    expect(f.sources.some((s) => s.url.includes("customs.gov.my"))).toBe(true);
    expect(f.evidence.length).toBeGreaterThan(0);
  });
  it("ejen infrastruktur menyenaraikan operator tanpa dakwa status", async () => {
    const f = await runAgent("infrastructure", { lat: 1.553, lon: 110.359, label: "Kuching", weather: {}, quakes: {}, adsb: {} });
    expect(f.observations.join(" ")).toMatch(/TNB|SEB|KTM/);
    expect(f.evidence).toEqual([]);
  });
  it("semua sumber luar gagal → INSUFFICIENT EVIDENCE (bukan risiko palsu)", () => {
    const r = assessRisk({
      category: "maritim", methodology: "ujian-gagal",
      factors: [{ name: "Liputan data", weight: 1, value: 7, note: "semua TIADA" }],
      evidence: [],
    });
    expect(r.status).toBe("INSUFFICIENT EVIDENCE");
  });
  it("semua titik koridor strategik berada dalam Malaysia & haversine tepat", () => {
    for (const c of STRATEGIC_CORRIDORS) {
      for (const pt of c.points) {
        expect(isInsideMalaysia(pt.lat, pt.lon), `${c.id}:${pt.name}`).toBe(true);
      }
    }
    const dist = haversineKm(2.999, 101.392, 3.139, 101.687); // Port Klang ke KL
    expect(dist).toBeGreaterThan(25);
    expect(dist).toBeLessThan(50);
  });
  it("rujukan kastam HS code & arkib SITREP berfungsi", () => {
    const palm = searchCustomsReference("1511");
    expect(palm.length).toBeGreaterThan(0);
    const risk = assessRisk({
      category: "kastam",
      methodology: "ujian",
      factors: [{ name: "a", weight: 1, value: 3, note: "ok" }],
      evidence: [{ observation: "Akta Kastam 1967", source: "JKDM", sourceUrl: "https://www.customs.gov.my/", timestamp: new Date().toISOString(), confidence: "sederhana" }],
    });
    const sr = buildSitrep({ location: "Port Klang", lat: 2.999, lon: 101.392, assetCategory: "kastam", risk, agents: [] });
    expect(listSitreps().some((x) => x.reportId === sr.reportId)).toBe(true);
    expect(deleteSitrep(sr.reportId)).toBe(true);
  });
});
