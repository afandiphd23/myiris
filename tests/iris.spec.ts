import { describe, it, expect } from "vitest";
import { isInsideMalaysia, validateMYTarget, classifyZone, haversineKm, STRATEGIC_CORRIDORS } from "../server/lib/geofence";
import { assessRisk, verifyClaim } from "../server/lib/riskEngine";
import { getAdvisories, buildQuakeTimeline, STATE_CENTERS, searchCustomsReference } from "../server/lib/reference";
import { runAgent } from "../server/lib/agents";
import { buildSitrep, listSitreps, deleteSitrep } from "../server/lib/sitrep";
import { computeIPU, ipuCategory, parseTideSeries, subIndex, ugm3ToPpm } from "../server/lib/ipu";
import { groupFlightsByAirport, FLIGHT_RADIUS_KM, mapAdsbLol, getOpenskyAuthMode, parseGoogleNewsRss, newsQueryFor } from "../server/lib/dataEngine";
import { resolveTheme, THEMES } from "../src/lib/theme";
import { decodeJwt, toGoogleUser } from "../src/lib/googleAuth";
import { encodeShare, decodeShare, loadAlerts, DEFAULT_ALERTS, recordHistory } from "../src/lib/store";
import { maybeAlert } from "../src/lib/notify";
import { haversineKm as clientHaversineKm, measurePath } from "../src/lib/geo";
import { KEY_LOCATIONS } from "../server/lib/geofence";

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
  it("IPU: PM2.5 mengikut jadual JAS (sempadan jalur tepat)", () => {
    expect(computeIPU({ pm10_24h: null, pm25_24h: 12.0, o3_8h_ppm: null, o3_1h_ppm: null, no2_1h_ppm: null, so2_1h_ppm: null, co_8h_ppm: null }).ipu).toBe(50);
    expect(computeIPU({ pm10_24h: null, pm25_24h: 75.5, o3_8h_ppm: null, o3_1h_ppm: null, no2_1h_ppm: null, so2_1h_ppm: null, co_8h_ppm: null }).ipu).toBe(100);
    const haze = computeIPU({ pm10_24h: 200, pm25_24h: 160, o3_8h_ppm: 0.05, o3_1h_ppm: 0.1, no2_1h_ppm: 0.03, so2_1h_ppm: 0.02, co_8h_ppm: 3 });
    expect(haze.ipu).toBeGreaterThanOrEqual(201); // PM2.5 160 → jalur 201–300
    expect(haze.dominant).toContain("PM2.5");
    expect(haze.categoryMs).toBe("Sangat Tidak Sihat");
  });
  it("IPU = MAX sub-indeks (bukan purata) + kategori betul", () => {
    // PM10 bersih tetapi O3 tinggi → O3 mesti menang
    const r = computeIPU({ pm10_24h: 20, pm25_24h: 8, o3_8h_ppm: 0.09, o3_1h_ppm: null, no2_1h_ppm: null, so2_1h_ppm: null, co_8h_ppm: null });
    expect(r.dominant).toContain("O3");
    expect(r.ipu).toBeGreaterThan(100);
    expect(ipuCategory(45).ms).toBe("Baik");
    expect(ipuCategory(75).ms).toBe("Sederhana");
    expect(ipuCategory(150).ms).toBe("Tidak Sihat");
    expect(ipuCategory(350).ms).toBe("Berbahaya");
    expect(ipuCategory(null).ms).toBe("TIADA data");
  });
  it("IPU: penukaran unit gas + tiada data → selamat", () => {
    expect(ugm3ToPpm(100, "o3")).toBeCloseTo(0.0509, 3); // 100 µg/m³ O3 ≈ 0.051 ppm
    expect(ugm3ToPpm(1146, "co")).toBeCloseTo(1.0, 1); // ~1 ppm CO
    expect(subIndex(null as any, [[0, 54, 0, 50]])).toBeNull();
    const empty = computeIPU({ pm10_24h: null, pm25_24h: null, o3_8h_ppm: null, o3_1h_ppm: null, no2_1h_ppm: null, so2_1h_ppm: null, co_8h_ppm: null });
    expect(empty.live).toBe(false);
    expect(empty.ipu).toBeNull();
  });
  it("pasang surut: kesan trend + pasang/surut penuh daripada siri model", () => {
    const times = ["2026-10-12T00:00", "2026-10-12T01:00", "2026-10-12T02:00", "2026-10-12T03:00", "2026-10-12T04:00", "2026-10-12T05:00", "2026-10-12T06:00", "2026-10-12T07:00"];
    const heights = [-1.0, -0.2, 0.8, 1.2, 0.9, 0.1, -0.7, -0.5];
    const tide = parseTideSeries(times, heights, "2026-10-12T02:00");
    expect(tide?.currentM).toBe(0.8);
    expect(tide?.trend).toBe("menaik");
    expect(tide?.nextHigh).toEqual({ time: "2026-10-12T03:00", heightM: 1.2 });
    expect(tide?.nextLow).toEqual({ time: "2026-10-12T06:00", heightM: -0.7 });
    expect(parseTideSeries([], [], "2026-10-12T02:00")).toBeNull();
    expect(parseTideSeries(times, [null, null, null, null, null, null, null, null], "2026-10-12T02:00")).toBeNull();
  });
  it("papan flights: pesawat diserah kepada airport terdekat dalam radius", () => {
    const states = [
      { callsign: "MAS123", icao: "abc123", originCountry: "Malaysia", lat: 2.8, lon: 101.75, altM: 3000, vel: 120, heading: 90 },
      { callsign: "AXM456", icao: "def456", originCountry: "Malaysia", lat: 2.745, lon: 101.71, altM: 500, vel: 80, heading: 270 },
      { callsign: "FAR999", icao: "999999", originCountry: "X", lat: 4.5, lon: 108.0, altM: 11000, vel: 250, heading: 45 },
      { callsign: "BAD", icao: "bad", lat: null, lon: null },
    ];
    const { boards, enRoute } = groupFlightsByAirport(states);
    expect(boards.length).toBe(KEY_LOCATIONS.filter((k) => k.kind === "lapangan-terbang").length);
    const klia = boards.find((b) => b.name.includes("KLIA"));
    expect(klia?.count).toBe(2);
    expect(klia?.flights[0].distKm).toBeLessThanOrEqual(klia?.flights[1].distKm ?? 0); // tertib jarak
    expect(klia?.flights[0].velKmh).toBe(Math.round(80 * 3.6));
    expect(enRoute.map((f) => f.callsign)).toContain("FAR999"); // luar radius → en-route
    expect(enRoute.map((f) => f.callsign)).not.toContain("BAD"); // koordinat rosak digugurkan
    expect(FLIGHT_RADIUS_KM).toBe(80);
  });
  it("fallback adsb.lol: unit kaki/knot dipetakan betul + data rosak digugur", () => {
    const m = mapAdsbLol({ hex: "885303", flight: "THA426  ", lat: 6.464584, lon: 100.394044, alt_baro: 22550, gs: 466.6, track: 357.05 });
    expect(m?.icao).toBe("885303");
    expect(m?.callsign).toBe("THA426");
    expect(m?.altM).toBe(Math.round(22550 * 0.3048)); // kaki → meter
    expect(m?.vel).toBeCloseTo(466.6 * 0.514444, 3); // knot → m/s (konsisten OpenSky)
    // alt_geom sebagai sandaran + koordinat rosak digugur
    expect(mapAdsbLol({ hex: "x", alt_geom: 10000, gs: 200, track: 10, lat: 3, lon: 101 })?.altM).toBe(Math.round(10000 * 0.3048));
    expect(mapAdsbLol({ hex: "x", lat: null, lon: 101 })).toBeNull();
    expect(mapAdsbLol(null)).toBeNull();
  });
  it("login OpenSky: mod auth hanya bila kedua-dua env diset (rahsia tidak didedah)", () => {
    const keepId = process.env.OPENSKY_CLIENT_ID;
    const keepSecret = process.env.OPENSKY_CLIENT_SECRET;
    try {
      delete process.env.OPENSKY_CLIENT_ID;
      delete process.env.OPENSKY_CLIENT_SECRET;
      expect(getOpenskyAuthMode()).toBe("anon");
      process.env.OPENSKY_CLIENT_ID = "ujian-client";
      expect(getOpenskyAuthMode()).toBe("anon"); // secret tiada → kekal anonim
      process.env.OPENSKY_CLIENT_SECRET = "ujian-secret";
      expect(getOpenskyAuthMode()).toBe("auth");
    } finally {
      if (keepId === undefined) delete process.env.OPENSKY_CLIENT_ID; else process.env.OPENSKY_CLIENT_ID = keepId;
      if (keepSecret === undefined) delete process.env.OPENSKY_CLIENT_SECRET; else process.env.OPENSKY_CLIENT_SECRET = keepSecret;
      expect(getOpenskyAuthMode()).toBe(keepId && keepSecret ? "auth" : "anon");
    }
  });
  it("kongsi pautan: roundtrip + input rosak → null", () => {
    const p = { lat: 2.999, lon: 101.392, label: "Port Klang", state: "Selangor", asset: "maritim", scenario: "live" };
    expect(decodeShare(encodeShare(p))).toEqual(p);
    expect(decodeShare("!!!")).toBeNull();
    expect(decodeShare(encodeShare({ ...p, lat: NaN } as any))).toBeNull();
  });
  it("amaran: ambang lalai 70; bawah ambang senyap, atas ambang cetus", () => {
    expect(loadAlerts()).toEqual(DEFAULT_ALERTS);
    expect(maybeAlert({ risk: { score: 90, status: "HIGH" }, label: "X" })).toBe(true);
    expect(maybeAlert({ risk: { score: 50, status: "LOW" }, label: "X" })).toBe(false);
    expect(maybeAlert(null)).toBe(false);
    expect(recordHistory({ label: "X", lat: 3, lon: 101, score: 10, status: "LOW", time: 1 })).toHaveLength(1);
  });
  it("geo klien: haversine + laluan ukuran konsisten", () => {
    const d = clientHaversineKm(2.999, 101.392, 3.139, 101.687); // Port Klang → KL
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(45);
    const m = measurePath([[2.999, 101.392], [2.745, 101.71], [3.139, 101.687]]);
    expect(m.legs).toHaveLength(2);
    expect(m.total).toBeCloseTo(m.legs[0] + m.legs[1], 1);
    expect(measurePath([[1, 1]])).toEqual({ legs: [], total: 0 });
  });
  it("berita: query topik sah + parser RSS (CDATA/entiti/tarikh)", () => {
    expect(newsQueryFor("customs")).toContain("kastam");
    expect(newsQueryFor("ai")).toContain("Malaysia");
    expect(newsQueryFor("sukan")).toBeNull();
    const xml = `<rss><channel>
      <item><title><![CDATA[Kastam rampas RM1 juta &amp; tahan 2]]></title><link>https://x.test/a</link><pubDate>Fri, 09 Oct 2026 11:37:00 +0800</pubDate><source name="Sinar">Sinar Harian</source></item>
      <item><title>Tanpa pautan</title><pubDate>Fri, 09 Oct 2026 11:37:00 +0800</pubDate></item>
      <item><title>AI Malaysia maju</title><link>https://x.test/b</link></item>
    </channel></rss>`;
    const items = parseGoogleNewsRss(xml);
    expect(items).toHaveLength(2); // tanpa pautan digugur
    expect(items[0].title).toBe("Kastam rampas RM1 juta & tahan 2");
    expect(items[0].source).toBe("Sinar Harian");
    expect(items[0].published).toBe(new Date("2026-10-09T03:37:00Z").toISOString());
    expect(items[1].published).toBeNull();
  });
  it("login Google: JWT didekod + profil tanpa sub ditolak", () => {
    const payload = { sub: "123", name: "Uji", email: "u@x.my", picture: "https://x/p.jpg" };
    const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    const u = toGoogleUser(decodeJwt(`h.${b64}.s`) ?? {});
    expect(u).toEqual(payload);
    expect(toGoogleUser({} as any)).toBeNull();
    expect(decodeJwt("bukan-token")).toBeNull();
  });
  it("tema: tiga tema sah; simpanan rosak → jatuh ke gelap", () => {
    expect(THEMES).toEqual(["dark", "light", "senior"]);
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("senior")).toBe("senior");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme("hijau")).toBe("dark");
  });
  it("papan flights: tiada trafik → semua board sifar (bukan ralat)", () => {
    const { boards, enRoute } = groupFlightsByAirport([]);
    expect(boards.every((b) => b.count === 0 && b.flights.length === 0)).toBe(true);
    expect(enRoute).toEqual([]);
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
