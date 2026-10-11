// IRIS Malaysia V2.0 — 8 ejen AI khusus (output berstruktur + boleh dikesan).
import type { Evidence } from "./riskEngine.js";
import { INFRA_OPERATORS as INFRA_REF } from "./reference.js";

export interface AgentFinding {
  agent: string; summary: string;
  observations: string[]; sources: { name: string; url: string }[];
  confidence: "tinggi" | "sederhana" | "rendah";
  limitations: string[]; evidence: Evidence[];
}

const now = () => new Date().toISOString();
const ev = (observation: string, source: string, sourceUrl: string, confidence: AgentFinding["confidence"] = "sederhana"): Evidence =>
  ({ observation, source, sourceUrl, timestamp: now(), confidence });

export type AgentId = "geospatial" | "maritime" | "aviation" | "disaster" | "infrastructure" | "customs" | "verification" | "sitrep";

export async function runAgent(
  id: AgentId,
  ctx: { lat: number; lon: number; label: string; weather?: any; quakes?: any; adsb?: any; marine?: any; airQuality?: any }
): Promise<AgentFinding> {
  const L: Record<AgentId, () => AgentFinding> = {
    geospatial: () => ({
      agent: "Ejen Geospatial Malaysia",
      summary: `${ctx.label} disahkan dalam sempadan Malaysia (${ctx.lat.toFixed(3)}, ${ctx.lon.toFixed(3)}).`,
      observations: [
        `Koordinat dalam bbox Malaysia (${ctx.lat.toFixed(4)}°U, ${ctx.lon.toFixed(4)}°T).`,
        `Rujukan JUPEM/MyGDI disyorkan untuk sempadan pentadbiran tepat.`,
      ],
      sources: [{ name: "JUPEM / MyGDI", url: "https://www.jupem.gov.my/" }],
      confidence: "tinggi",
      limitations: ["Bbox kasar — bukan ukuran kadaster."],
      evidence: [ev(`Koordinat ${ctx.lat},${ctx.lon} dalam Malaysia`, "Geofence IRIS", "https://www.jupem.gov.my/", "tinggi")],
    }),
    maritime: () => {
      const hasWave = ctx.marine?.live && ctx.marine?.waveHeightM != null;
      const marineEv: Evidence[] = [];
      if (ctx.weather?.live) marineEv.push(ev("Bacaan model cuaca diperoleh", "Open-Meteo", "https://open-meteo.com/"));
      if (hasWave) marineEv.push(ev(`Ombak model ${ctx.marine.waveHeightM} m (tempoh ${ctx.marine.wavePeriodS ?? "?"} s)`, "Open-Meteo Marine", "https://open-meteo.com/en/docs/marine-weather-api"));
      return {
        agent: "Ejen Perisikan Maritim",
        summary: `Penilaian zon maritim berhampiran ${ctx.label}${hasWave ? ` (ombak model ${ctx.marine.waveHeightM} m)` : ""}; rujuk Notis Jabatan Laut untuk arahan pelayaran.`,
        observations: [
          `Semak notis pelayaran semasa Jabatan Laut Malaysia.`,
          `Cuaca model: ${ctx.weather?.live ? `angin ${ctx.weather?.current?.wind_speed_10m ?? "?"} km/j` : "tiada data cuaca — dilabel TIADA"}.`,
          hasWave ? `Keadaan laut model: ketinggian ombak ${ctx.marine.waveHeightM} m, maks 24j ${ctx.marine.maxWave24hM} m.` : "Data ombak maritim luar pesisir tidak aktif bagi koordinat daratan atau tidak dapat dicapai.",
        ],
        sources: [{ name: "Jabatan Laut Malaysia", url: "https://www.marine.gov.my/" }, { name: "Open-Meteo (model)", url: "https://open-meteo.com/" }],
        confidence: ctx.weather?.live ? "sederhana" : "rendah",
        limitations: ["Tiada data AIS berlesen — elak dakwa trafik kapal spesifik tanpa sumber."],
        evidence: marineEv,
      };
    },
    aviation: () => ({
      agent: "Ejen Perisikan Penerbangan",
      summary: ctx.adsb?.live ? `${ctx.adsb.count} jejak ADS-B dikesan dalam kotak Malaysia.` : "Data ADS-B TIADA (outage/had kadar) — bukan sifar trafik.",
      observations: ctx.adsb?.live
        ? [`${ctx.adsb.count} isyarat ADS-B awam dalam sektor Malaysia.`, "Sahkan status lapangan terbang melalui CAAM/pengendali lapangan terbang."]
        : ["OpenSky tidak dapat dicapai; jangan papar trafik sifar sebagai fakta."],
      sources: [{ name: "OpenSky (ADS-B awam)", url: "https://opensky-network.org/" }, { name: "CAAM", url: "https://www.caam.gov.my/" }],
      confidence: ctx.adsb?.live ? "sederhana" : "rendah",
      limitations: ["Liputan ADS-B sukarela; pesawat tanpa ADS-B tidak kelihatan."],
      evidence: ctx.adsb?.live ? [ev(`${ctx.adsb.count} jejak ADS-B`, "OpenSky", "https://opensky-network.org/")] : [],
    }),
    disaster: () => {
      const disEv: Evidence[] = [];
      if (ctx.quakes?.live && ctx.quakes.count > 0) {
        disEv.push(ev(`${ctx.quakes.count} gempa M4+ (30 hari)`, "USGS", "https://earthquake.usgs.gov/", "tinggi"));
      }
      if (ctx.airQuality?.live && ctx.airQuality?.aqi != null) {
        disEv.push(ev(`Bacaan model kualiti udara AQI ${ctx.airQuality.aqi} (PM2.5: ${ctx.airQuality.pm25 ?? "?"} µg/m³)`, "Open-Meteo Air Quality", "https://apims.doe.gov.my/"));
      }
      return {
        agent: "Ejen Perisikan Bencana",
        summary: ctx.quakes?.live ? `${ctx.quakes.count} gempa M4+ direkodkan USGS dalam 30 hari di rantau Malaysia.` : "Data gempa TIADA — semak USGS secara manual.",
        observations: [
          ctx.quakes?.live ? `${ctx.quakes.count} gempa serantau (rujuk senarai USGS).` : "USGS tidak dapat dicapai.",
          `Kebarangkalian hujan model: ${ctx.weather?.live ? `${ctx.weather.precipProbMax}%` : "tiada data"}. Untuk amaran banjir sahih rujuk InfoBanjir & METMalaysia.`,
          ctx.airQuality?.live ? `Kualiti udara model: US AQI ${ctx.airQuality.aqi ?? "?"}, PM2.5 ${ctx.airQuality.pm25 ?? "?"} µg/m³ (sahkan IPU di JAS APIMS).` : "Bacaan kualiti udara model tidak tersedia.",
        ],
        sources: [
          { name: "USGS", url: "https://earthquake.usgs.gov/" },
          { name: "METMalaysia", url: "https://www.met.gov.my/" },
          { name: "InfoBanjir", url: "https://infobanjir.water.gov.my/" },
          { name: "NADMA", url: "https://www.nadma.gov.my/" },
          { name: "JAS APIMS", url: "https://apims.doe.gov.my/" },
        ],
        confidence: "sederhana",
        limitations: ["Model hujan ≠ amaran banjir rasmi; model AQI ≠ IPU rasmi JAS."],
        evidence: disEv,
      };
    },
    infrastructure: () => ({
      agent: "Ejen Risiko Infrastruktur",
      summary: `Semakan daya tahan infrastruktur didokumenkan awam sekitar ${ctx.label}.`,
      observations: [
        `Lebuh raya: ${INFRA_REF.highway.join("; ")}.`,
        `Rel: ${INFRA_REF.rail.join("; ")}.`,
        `Tenaga: ${INFRA_REF.energy.join("; ")}.`,
        "Tiada dakwaan kerosakan/gangguan tanpa sumber operator — status semasa mesti disahkan dengan operator.",
      ],
      sources: [{ name: "NADMA", url: "https://www.nadma.gov.my/" }],
      confidence: "rendah",
      limitations: ["Tanpa suapan operator langsung — penilaian terhad kepada konteks geografi + rujukan statik."],
      evidence: [],
    }),
    customs: () => ({
      agent: "Ejen Perisikan Kastam & Perdagangan",
      summary: "Rujukan Akta Kastam 1967 & Akta Perdagangan Strategik 2010: pengelasan tarif, sekatan import/eksport, permit & pengecualian duti memerlukan dokumen JKDM/MITI.",
      observations: [
        "Semak HS code melalui portal JKDM/MITI/MATRADE.",
        "Keperluan permit bergantung barangan & negara asal — sahkan dengan ejen kastam berlesen.",
      ],
      sources: [{ name: "JKDM", url: "https://www.customs.gov.my/" }, { name: "MITI", url: "https://www.miti.gov.my/" }],
      confidence: "sederhana",
      limitations: ["Bukan nasihat undang-undang; rujuk Akta Kastam 1967 & perintah semasa."],
      evidence: [ev("Rujukan rangka kerja Akta Kastam 1967", "JKDM", "https://www.customs.gov.my/")],
    }),
    verification: () => ({
      agent: "Ejen Verifikasi Bukti",
      summary: "Semua dakwaan mesti mempunyai sumber + cap masa; dakwaan tanpa sokongan ditolak sebelum penerbitan SITREP.",
      observations: [
        "Peraturan: tiada rekaan risikan ketenteraan/terperingkat.",
        "Data model dilabel MODEL; data tiada dilabel TIADA.",
      ],
      sources: [],
      confidence: "tinggi",
      limitations: [],
      evidence: [],
    }),
    sitrep: () => ({
      agent: "Ejen Laporan SITREP",
      summary: "SITREP dijana mengikut struktur IRIS MALAYSIA dengan petikan sumber dan selang semakan.",
      observations: [],
      sources: [],
      confidence: "tinggi",
      limitations: [],
      evidence: [],
    }),
  };
  return L[id]();
}

export const AGENT_IDS: AgentId[] = ["geospatial", "maritime", "aviation", "disaster", "infrastructure", "customs", "verification", "sitrep"];
