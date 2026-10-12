import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Waves,
  Wind,
  Plane,
  FileText,
  Map as MapIcon,
  Radar,
  ArrowRight,
  Activity,
} from "lucide-react";
import { api } from "../lib/api";
import type { STR } from "../lib/i18n";

type T = (typeof STR)[keyof typeof STR];

function useCountUp(target: number, durationMs = 1200): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return val;
}

const STATS: { value: number; suffix: string; labelMs: string; labelEn: string }[] = [
  { value: 9, suffix: "", labelMs: "Airport utama", labelEn: "Major airports" },
  { value: 8, suffix: "", labelMs: "Ejen perisikan", labelEn: "Intel agents" },
  { value: 6, suffix: "", labelMs: "Pencemar IPU", labelEn: "API pollutants" },
  { value: 30, suffix: "", labelMs: "Hari seismik USGS", labelEn: "Days of USGS seismic" },
];

export default function LandingPage({
  t,
  lang,
  onEnter,
}: {
  t: T;
  lang: "ms" | "en";
  onEnter: (tab: "command" | "flights" | "corridors") => void;
}) {
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    api<any>("/api/health").then(setHealth).catch(() => {});
  }, []);

  const features: { icon: React.ReactNode; titleMs: string; titleEn: string; descMs: string; descEn: string }[] = [
    {
      icon: <ShieldCheck size={20} className="text-emerald-400" />,
      titleMs: "Geofence Malaysia-Only", titleEn: "Malaysia-Only Geofence",
      descMs: "Sasaran asing ditolak automatik (403) dengan zon telus: darat, ZEE, tuntutan-bertindih.",
      descEn: "Foreign targets auto-rejected (403) with transparent zones: land, EEZ, overlapping-claim.",
    },
    {
      icon: <Waves size={20} className="text-sky-400" />,
      titleMs: "Telemetri Live", titleEn: "Live Telemetry",
      descMs: "Cuaca, ombak, pasang surut, IPU jerebu & gempa — dilabel live / model / TIADA.",
      descEn: "Weather, waves, tides, haze API & quakes — labelled live / model / unavailable.",
    },
    {
      icon: <Radar size={20} className="text-teal-300" />,
      titleMs: "8 Ejen + Risiko Telus", titleEn: "8 Agents + Transparent Risk",
      descMs: "Penemuan berejen dengan bukti bersumber; skor risiko tunjuk pemberat & metodologi.",
      descEn: "Agentic findings with sourced evidence; risk scores show weights & methodology.",
    },
    {
      icon: <Plane size={20} className="text-cyan-200" />,
      titleMs: "Penerbangan Live + Grafik", titleEn: "Live Flights + Graphics",
      descMs: "Trafik ADS-B per airport utama dengan bar trafik & taburan altitud masa nyata.",
      descEn: "ADS-B traffic per major airport with traffic bars & live altitude mix.",
    },
    {
      icon: <MapIcon size={20} className="text-amber-300" />,
      titleMs: "Matriks Koridor", titleEn: "Corridor Matrix",
      descMs: "Imbasan serentak Selat Melaka, Laut China Selatan & koridor strategik lain.",
      descEn: "Simultaneous scans of the Malacca Strait, South China Sea & other corridors.",
    },
    {
      icon: <FileText size={20} className="text-purple-400" />,
      titleMs: "SITREP + Audit", titleEn: "SITREP + Audit",
      descMs: "Laporan situasi berversi (JSON/PDF) dengan gerbang verifikasi & log audit.",
      descEn: "Versioned situation reports (JSON/PDF) with verification gate & audit log.",
    },
  ];

  const tickers = [
    "METMalaysia", "InfoBanjir", "NADMA", "JAS APIMS", "CAAM", "Jabatan Laut",
    "USGS", "OpenSky", "adsb.lol", "JUPEM", "JKDM", "MITI",
  ];

  return (
    <div className="landing-root relative overflow-hidden">
      {/* Latar animasi */}
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-orb landing-orb-a" aria-hidden="true" />
      <div className="landing-orb landing-orb-b" aria-hidden="true" />

      {/* Hero */}
      <section className="relative mx-auto max-w-[1100px] px-6 pt-16 pb-10 text-center md:pt-24">
        <div className="landing-radar" aria-hidden="true">
          <div className="landing-radar-sweep" />
          <div className="landing-radar-dot landing-radar-dot-1" />
          <div className="landing-radar-dot landing-radar-dot-2" />
          <div className="landing-radar-dot landing-radar-dot-3" />
        </div>

        <p className="landing-anim landing-anim-1 mx-auto inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-300">
          <Activity size={13} />
          {lang === "ms" ? "Malaysia-Only · Data Masa Nyata" : "Malaysia-Only · Real-Time Data"}
        </p>
        <h1 className="landing-anim landing-anim-2 mt-5 text-4xl font-bold tracking-tight text-white md:text-6xl">
          IRIS <span className="landing-gradient">Malaysia</span>{" "}
          <span className="align-middle font-mono text-lg text-slate-400 md:text-xl">V2.0</span>
        </h1>
        <p className="landing-anim landing-anim-3 mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
          {t.sub} — {lang === "ms" ? "pantau cuaca, laut, udara, seismik & penerbangan setiap lokasi Malaysia dalam satu papan." : "monitor weather, sea, air, seismic & flights for every Malaysian location in one board."}
        </p>

        <div className="landing-anim landing-anim-4 mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onEnter("command")}
            className="group flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors"
          >
            {lang === "ms" ? "Buka Papan Operasi" : "Open Operations Board"}
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </button>
          <button
            type="button"
            onClick={() => onEnter("flights")}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/60 transition-colors"
          >
            <Plane size={15} />
            {t.navFlights}
          </button>
        </div>

        <p className="landing-anim landing-anim-5 mt-5 flex items-center justify-center gap-2 font-mono text-xs text-slate-400">
          <span className={`inline-block h-2 w-2 rounded-full ${health ? "landing-pulse bg-emerald-400" : "bg-slate-600"}`} />
          {health
            ? `${lang === "ms" ? "Backend LIVE" : "Backend LIVE"} · ${(health.sources ?? []).length} ${lang === "ms" ? "sumber" : "sources"}`
            : lang === "ms" ? "Menyemak status backend…" : "Checking backend status…"}
        </p>

        {/* Statistik count-up */}
        <div className="landing-anim landing-anim-6 mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((s) => <StatCell key={s.labelEn} stat={s} lang={lang} />)}
        </div>
      </section>

      {/* Ticker sumber */}
      <div className="landing-ticker-wrap relative border-y border-slate-800/80 py-3" aria-hidden="true">
        <div className="landing-ticker font-mono text-xs text-slate-400">
          {[...tickers, ...tickers].map((s, i) => (
            <span key={i} className="mx-5 whitespace-nowrap">
              ◆ {s}
            </span>
          ))}
        </div>
      </div>

      {/* Ciri */}
      <section className="relative mx-auto max-w-[1100px] px-6 py-12">
        <h2 className="text-center text-xl font-bold text-white md:text-2xl">
          {lang === "ms" ? "Keupayaan Platform" : "Platform Capabilities"}
        </h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.titleEn}
              className={`landing-anim landing-card iris-surface p-5 landing-anim-f${(i % 3) + 1}`}
            >
              <div className="flex items-center gap-2.5">
                {f.icon}
                <h3 className="text-sm font-bold text-white">{lang === "ms" ? f.titleMs : f.titleEn}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{lang === "ms" ? f.descMs : f.descEn}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[11px] leading-relaxed text-slate-500">
          {lang === "ms"
            ? "Data model dilabel MODEL; IPU ialah anggaran gaya JAS (rujuk APIMS rasmi); paras laut model bukan untuk navigasi. Tiada risikan ketenteraan/terperingkat direka."
            : "Model data is labelled MODEL; API is a JAS-style estimate (refer to official APIMS); model sea level is not for navigation. No military/classified intel is fabricated."}
        </p>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => onEnter("corridors")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-sky-500/60 transition-colors"
          >
            <Wind size={15} />
            {t.navCorridors}
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCell({ stat, lang }: { stat: (typeof STATS)[number]; lang: "ms" | "en" }) {
  const v = useCountUp(stat.value);
  return (
    <div className="iris-surface px-4 py-5">
      <div className="font-mono text-3xl font-bold text-sky-300 tabular-nums">
        {v}
        {stat.suffix}
      </div>
      <div className="mt-1 text-xs text-slate-300">{lang === "ms" ? stat.labelMs : stat.labelEn}</div>
    </div>
  );
}
