import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  FileText,
  Languages,
  TriangleAlert,
  Search,
  Download,
  Printer,
  Trash2,
  MapPin,
  Compass,
  ShieldCheck,
  ExternalLink,
  Plane,
  Moon,
  Sun,
  Accessibility,
  Home,
} from "lucide-react";
import MapView from "./components/MapView";
import LandingPage from "./components/LandingPage";
import { api } from "./lib/api";
import { STR, type Lang } from "./lib/i18n";
import { loadTheme, applyTheme, THEMES, type Theme } from "./lib/theme";
import "./index.css";

type ActiveTab = "command" | "corridors" | "flights" | "customs" | "sitreps" | "audit";

const RISK_TEXT_STYLE: Record<string, string> = {
  LOW: "text-emerald-400",
  GUARDED: "text-teal-300",
  MODERATE: "text-amber-400",
  HIGH: "text-orange-400",
  CRITICAL: "text-red-400",
  "INSUFFICIENT EVIDENCE": "text-slate-400",
};

const IPU_TEXT_STYLE: Record<string, string> = {
  emerald: "text-emerald-400",
  yellow: "text-yellow-300",
  orange: "text-orange-400",
  red: "text-red-400",
  purple: "text-purple-400",
  slate: "text-slate-400",
};

const TIDE_TREND_ARROW: Record<string, string> = { menaik: "↗", menurun: "↘", mendatar: "→" };

export default function App() {
  const [lang, setLang] = useState<Lang>("ms");
  const t = STR[lang];
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Landing page: papar pada lawatan pertama; kekal diskip selepas masuk.
  const [showLanding, setShowLanding] = useState(() => {
    try {
      return localStorage.getItem("iris-landing") !== "masuk";
    } catch {
      return true;
    }
  });
  const enterApp = (tab: ActiveTab = "command") => {
    try {
      localStorage.setItem("iris-landing", "masuk");
    } catch {
      /* abaikan */
    }
    setActiveTab(tab);
    setShowLanding(false);
  };
  const [activeTab, setActiveTab] = useState<ActiveTab>("command");

  const [ref, setRef] = useState<any>(null);
  const [q, setQ] = useState("Port Klang");
  const [searchOpen, setSearchOpen] = useState(false);
  const [lat, setLat] = useState(2.999);
  const [lon, setLon] = useState(101.392);
  const [stateSel, setStateSel] = useState("Selangor");
  const [asset, setAsset] = useState("maritim — Port Klang");
  const [scenario, setScenario] = useState("live");
  const [customNotes, setCustomNotes] = useState("");
  const [show, setShow] = useState({
    maritime: true,
    aviation: true,
    disaster: true,
    geofence: true,
    rangeRings: true,
  });
  const [refreshSec, setRefreshSec] = useState(0);

  const [result, setResult] = useState<any>(null);
  const [sitrep, setSitrep] = useState<any>(null);
  const [sitrepList, setSitrepList] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState("all");

  // Corridor matrix state
  const [corridorId, setCorridorId] = useState("selat-melaka");
  const [corridorScan, setCorridorScan] = useState<any>(null);
  const [corridorBusy, setCorridorBusy] = useState(false);

  // Flights board state (9 airport utama)
  const [flights, setFlights] = useState<any>(null);
  const [flightsBusy, setFlightsBusy] = useState(false);
  const [flightAirport, setFlightAirport] = useState("all");

  // Customs & Trade state
  const [customsQ, setCustomsQ] = useState("");
  const [customsData, setCustomsData] = useState<any>(null);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const busyRef = useRef(false);

  // Initial load of reference data, health, customs, sitreps, and initial Port Klang analysis
  useEffect(() => {
    api<any>("/api/reference").then(setRef).catch(() => {});
    api<any>("/api/health").then(setHealth).catch(() => {});
    api<any[]>("/api/sitreps").then(setSitrepList).catch(() => {});
    api<any>("/api/customs").then(setCustomsData).catch(() => {});
    analyzeTarget(2.999, 101.392, "Port Klang", "maritim — Port Klang", "Selangor", "live", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Freshness ticker
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);

  async function analyzeTarget(
    targetLat = lat,
    targetLon = lon,
    targetLabel = q || `${targetLat},${targetLon}`,
    targetAsset = asset,
    targetState = stateSel,
    targetScenario = scenario,
    targetNotes = customNotes
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr("");
    try {
      const r = await api<any>("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          lat: targetLat,
          lon: targetLon,
          label: targetLabel,
          asset: targetAsset,
          state: targetState,
          scenario: targetScenario,
          notes: targetNotes,
        }),
      });
      setResult(r);
      setLastFetch(Date.now());
      const h = await api<any>("/api/health").catch(() => null);
      if (h) setHealth(h);
      const a = await api<any[]>("/api/audit").catch(() => []);
      setAudit(a);
    } catch (e: any) {
      setErr(e.message);
      const a = await api<any[]>("/api/audit").catch(() => []);
      setAudit(a);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Configurable auto-refresh
  useEffect(() => {
    if (!refreshSec) return;
    const id = setInterval(() => {
      analyzeTarget();
      if (activeTab === "flights") loadFlights();
    }, refreshSec * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSec, lat, lon, q, asset, stateSel, scenario, customNotes, activeTab]);

  const pickLocation = (name: string, la: number, lo: number, st?: string, switchTab = true) => {
    setQ(name);
    setLat(la);
    setLon(lo);
    if (st) setStateSel(st);
    setSearchOpen(false);
    if (switchTab) setActiveTab("command");
    analyzeTarget(la, lo, name, asset, st ?? stateSel, scenario, customNotes);
  };

  const onStateChange = (s: string) => {
    setStateSel(s);
    const c = ref?.stateCenters?.[s];
    if (c) {
      setLat(c[0]);
      setLon(c[1]);
      setQ(s);
      analyzeTarget(c[0], c[1], s, asset, s, scenario, customNotes);
    }
  };

  const onMapPointClick = (cLat: number, cLon: number) => {
    const label = `Titik Peta (${cLat.toFixed(3)}, ${cLon.toFixed(3)})`;
    setLat(cLat);
    setLon(cLon);
    setQ(label);
    analyzeTarget(cLat, cLon, label, asset, stateSel, scenario, customNotes);
  };

  async function genSitrep() {
    setBusy(true);
    setErr("");
    try {
      const s = await api<any>("/api/sitrep", {
        method: "POST",
        body: JSON.stringify({ lat, lon, label: q || `${lat},${lon}`, asset }),
      });
      setSitrep(s);
      const list = await api<any[]>("/api/sitreps").catch(() => []);
      setSitrepList(list);
      const a = await api<any[]>("/api/audit").catch(() => []);
      setAudit(a);
      setActiveTab("sitreps");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runCorridorScan(cid = corridorId) {
    setCorridorBusy(true);
    setErr("");
    try {
      const res = await api<any>("/api/batch-scan", {
        method: "POST",
        body: JSON.stringify({ corridorId: cid }),
      });
      setCorridorScan(res);
      const a = await api<any[]>("/api/audit").catch(() => []);
      setAudit(a);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setCorridorBusy(false);
    }
  }

  async function loadFlights() {
    setFlightsBusy(true);
    setErr("");
    try {
      const f = await api<any>("/api/flights");
      setFlights(f);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setFlightsBusy(false);
    }
  }

  async function searchCustoms(queryStr: string) {
    setCustomsQ(queryStr);
    try {
      const d = await api<any>(`/api/customs?q=${encodeURIComponent(queryStr)}`);
      setCustomsData(d);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function removeSitrep(id: string) {
    await api<any>(`/api/sitreps/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    const list = await api<any[]>("/api/sitreps").catch(() => []);
    setSitrepList(list);
    if (sitrep?.reportId === id) setSitrep(list[0] ?? null);
  }

  function exportSitrepMarkdown(s: any) {
    const md = [
      `# ${s.title}`,
      ``,
      `- **ID Laporan:** ${s.reportId}`,
      `- **Masa (MYT):** ${s.timestampMYT}`,
      `- **Lokasi:** ${s.location} (${s.coords.join(", ")})`,
      `- **Kategori Aset:** ${s.assetCategory}`,
      `- **Status Risiko:** ${s.risk.status} (${s.risk.score}/100)`,
      `- **Keyakinan:** ${s.confidence}`,
      `- **Semakan Seterusnya:** ${s.nextReview}`,
      ``,
      `## Ringkasan Eksekutif`,
      s.execSummary,
      ``,
      `## Pemerhatian Disahkan`,
      ...s.observations.map((o: string) => `- ${o}`),
      ``,
      `## Konteks Geospatial & Kawal Selia`,
      `- ${s.geoContext}`,
      `- ${s.regulatory}`,
      ``,
      `## Tindakan Susulan`,
      ...(s.actions ?? []).map((a: string) => `- ${a}`),
      ``,
      `## Sumber Dipetik`,
      ...(s.citations ?? []).map((c: any) => `- [${c.name}](${c.url})`),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${s.reportId}.md`;
    a.click();
  }

  function exportCorridorCsv() {
    if (!corridorScan?.rows) return;
    const headers = ["Name", "State", "Lat", "Lon", "Zone", "RiskStatus", "RiskScore", "TempC", "WindKmh", "PrecipProbPct", "WaveM", "AQI", "IPU", "IPUCategory", "TideM", "TideTrend"];
    const lines = [
      headers.join(","),
      ...corridorScan.rows.map((r: any) =>
        [
          `"${r.name}"`,
          `"${r.state}"`,
          r.lat,
          r.lon,
          r.zone,
          r.riskStatus,
          r.riskScore,
          r.tempC ?? "",
          r.windKmh ?? "",
          r.precipProb ?? "",
          r.waveM ?? "",
          r.aqi ?? "",
          r.ipu ?? "",
          `"${r.ipuCategory ?? ""}"`,
          r.tideM ?? "",
          r.tideTrend ?? "",
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `iris-corridor-${corridorScan.corridor?.id ?? "scan"}.csv`;
    a.click();
  }

  const matches = ((ref?.locations ?? []) as any[])
    .filter((l) => (!stateSel || l.state === stateSel) && l.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 10);

  const freshness = lastFetch ? Math.max(0, Math.round((Date.now() - lastFetch) / 1000)) : null;
  const isAlert = result && (result.risk.status === "HIGH" || result.risk.status === "CRITICAL");
  const timeline: any[] = result?.quakes?.timeline ?? [];
  const maxMag = Math.max(1, ...timeline.map((b: any) => b.maxMag ?? 0));
  const forecast24h: any[] = result?.weather?.forecast24h ?? [];
  const activeCorridorObj = ((ref?.corridors ?? []) as any[]).find((c) => c.id === corridorId);

  // Grafik flights: data terbitan daripada papan flights + penapis airport semasa
  const flightBoardsAll: any[] = flights?.boards ?? [];
  const maxBoardCount = Math.max(1, ...flightBoardsAll.map((b: any) => b.count ?? 0));
  const altPool: any[] =
    flightAirport === "all"
      ? [...flightBoardsAll.flatMap((b: any) => b.flights ?? []), ...((flights?.enRoute ?? []) as any[])]
      : (flightBoardsAll.find((b: any) => b.name === flightAirport)?.flights ?? []);
  const ALT_BANDS: [number, number][] = [[0, 5000], [5000, 10000], [10000, 20000], [20000, 30000], [30000, 999999]];
  const ALT_LABELS = ["0–5k", "5–10k", "10–20k", "20–30k", "30k+"];
  const altCounts = ALT_BANDS.map(([lo, hi]) =>
    altPool.filter((f: any) => f.altM != null && f.altM * 3.28084 >= lo && f.altM * 3.28084 < hi).length
  );
  const maxAltCount = Math.max(1, ...altCounts);
  const altKnown = altCounts.reduce((a, c) => a + c, 0);
  const shortAirportCode = (n: string) => n.match(/\(([^)]+)\)/)?.[1] ?? n.slice(0, 8);

  const filteredAudit = audit.filter((a) => (auditFilter === "all" ? true : a.kind === auditFilter));

  if (showLanding) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-100">
        <LandingPage t={t} lang={lang} onEnter={enterApp} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100">
      {/* Top Bar Contract: Zone 1 (Single-line Brand) — Zone 2 (5 Single-line Nav Links) — Zone 3 (1 Primary CTA) */}
      <header className="no-print flex items-center justify-between gap-8 border-b border-slate-800 bg-[#0f172a] px-6 py-3.5">
        <a
          href="#command"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab("command");
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          {t.title}
        </a>
        <button
          type="button"
          onClick={() => setShowLanding(true)}
          title={t.landingHome}
          aria-label={t.landingHome}
          className="rounded p-1.5 text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <Home size={15} />
        </button>

        <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-300">
          {(
            [
              ["command", t.navCommand],
              ["corridors", t.navCorridors],
              ["flights", t.navFlights],
              ["customs", t.navCustoms],
              ["sitreps", t.navSitreps],
              ["audit", t.navAudit],
            ] as [ActiveTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (id === "corridors" && !corridorScan) runCorridorScan(corridorId);
                if (id === "flights" && !flights) loadFlights();
              }}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === id
                  ? "text-sky-400 underline underline-offset-8 decoration-2"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => analyzeTarget()}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
            {busy ? "…" : t.analyze}
          </button>
        </div>
      </header>

      {/* Workspace Sub-Toolbar: Context, MYT Clock, Freshness, Auto-Refresh, SITREP & Language Switcher */}
      <div className="no-print border-b border-slate-800/80 bg-[#0b1120] px-6 py-2.5">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-200">{t.sub}</span>
            <span aria-hidden="true">·</span>
            <span>Malaysia-Only Geofence (Semenanjung, Sabah, Sarawak, Labuan)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">MYT (UTC+8)</span>
            {freshness != null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-sky-300">
                  {t.fetchedAgo} {freshness}s
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-300 whitespace-nowrap shrink-0">
              <span>{t.autoRefresh}:</span>
              <select
                value={refreshSec}
                onChange={(e) => setRefreshSec(Number(e.target.value))}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200 outline-none"
              >
                <option value={0}>{t.off}</option>
                <option value={60}>60s</option>
                <option value={300}>300s</option>
                <option value={900}>900s</option>
              </select>
            </label>

            <button
              type="button"
              onClick={genSitrep}
              disabled={busy}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500/60 hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <FileText size={13} />
              {t.sitrep}
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === "ms" ? "en" : "ms")}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 whitespace-nowrap shrink-0 transition-colors"
            >
              <Languages size={13} />
              {lang === "ms" ? "BM / EN" : "EN / BM"}
            </button>

            <div
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 p-1"
              role="group"
              aria-label={t.themeLabel}
            >
              {THEMES.map((id) => (
                <button
                  key={id}
                  type="button"
                  title={id === "dark" ? t.themeDark : id === "light" ? t.themeLight : t.themeSenior}
                  aria-label={id === "dark" ? t.themeDark : id === "light" ? t.themeLight : t.themeSenior}
                  aria-pressed={theme === id}
                  onClick={() => setTheme(id)}
                  className={`rounded p-1.5 transition-colors ${
                    theme === id ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {id === "dark" ? <Moon size={13} /> : id === "light" ? <Sun size={13} /> : <Accessibility size={13} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container (1440px baseline) */}
      <main className="mx-auto max-w-[1440px] px-6 py-5">
        {/* Verified High-Risk Banner */}
        {isAlert && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/60 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            <div className="flex items-center gap-2.5">
              <TriangleAlert size={18} className="shrink-0 text-red-400" />
              <div>
                <span className="font-semibold">{t.alertBanner}:</span> {result.label}
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums font-bold">
                  {result.risk.status} ({result.risk.score}/100)
                </span>
                <span aria-hidden="true"> · </span>
                <span>{result.risk.followUp?.[0] ?? ""}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={genSitrep}
              className="rounded bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/30 whitespace-nowrap shrink-0"
            >
              {t.sitrep}
            </button>
          </div>
        )}

        {/* Error / Rejection Alert */}
        {err && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/60 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <TriangleAlert size={16} className="shrink-0 text-amber-400" />
              <span>{err}</span>
            </div>
            <button
              type="button"
              onClick={() => setErr("")}
              className="text-xs text-amber-300 underline hover:text-white whitespace-nowrap shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* ==================== TAB 1: GEOSPATIAL COMMAND ==================== */}
        {activeTab === "command" && (
          <div className="space-y-6">
            {/* Control Strip: Search, State, Lat/Lon, Asset Category, Scenario Mode */}
            <section className="no-print iris-surface p-4">
              <div className="grid gap-3 md:grid-cols-[1.4fr_160px_115px_115px_210px_220px]">
                {/* Location Search with Autocomplete */}
                <div className="relative">
                  <div className="flex items-center rounded border border-slate-700 bg-slate-900 px-3 py-2">
                    <Search size={14} className="mr-2 shrink-0 text-slate-400" />
                    <input
                      value={q}
                      onFocus={() => setSearchOpen(true)}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setSearchOpen(true);
                      }}
                      placeholder={t.search}
                      className="w-full bg-transparent text-xs text-slate-100 outline-none"
                    />
                  </div>
                  {searchOpen && matches.length > 0 && (
                    <div className="absolute z-[500] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
                      {matches.map((m: any) => (
                        <button
                          key={m.name}
                          type="button"
                          onClick={() => pickLocation(m.name, m.lat, m.lon, m.state, false)}
                          className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                        >
                          <span>
                            {m.name} <span className="text-slate-400">· {m.state}</span>
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400">
                            {m.lat.toFixed(2)}, {m.lon.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* State selector */}
                <select
                  value={stateSel}
                  onChange={(e) => onStateChange(e.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="">{t.allStates}</option>
                  {(ref?.states ?? []).map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Latitude */}
                <input
                  type="number"
                  step="0.001"
                  value={lat}
                  onChange={(e) => setLat(Number(e.target.value))}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono tabular-nums text-xs text-slate-200 outline-none"
                  title="Latitude"
                />

                {/* Longitude */}
                <input
                  type="number"
                  step="0.001"
                  value={lon}
                  onChange={(e) => setLon(Number(e.target.value))}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-2 font-mono tabular-nums text-xs text-slate-200 outline-none"
                  title="Longitude"
                />

                {/* Asset Category */}
                <select
                  value={asset}
                  onChange={(e) => {
                    setAsset(e.target.value);
                    analyzeTarget(lat, lon, q, e.target.value, stateSel, scenario, customNotes);
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 outline-none"
                >
                  {[
                    "maritim — Port Klang",
                    "penerbangan — KLIA",
                    "bencana — Kelantan",
                    "maritim — Sabah",
                    "infrastruktur — Sarawak",
                    "kastam — Akta Kastam 1967",
                    "tenaga — Pengerang / Bintulu",
                    "umum",
                  ].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>

                {/* Scenario Stress-Test Selector */}
                <select
                  value={scenario}
                  onChange={(e) => {
                    setScenario(e.target.value);
                    analyzeTarget(lat, lon, q, asset, stateSel, e.target.value, customNotes);
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-sky-300 outline-none"
                >
                  <option value="live">{t.scenarioLive}</option>
                  <option value="monsoon-surge">{t.scenarioMonsoon}</option>
                  <option value="haze-episode">{t.scenarioHaze}</option>
                  <option value="seismic-tremor">{t.scenarioSeismic}</option>
                </select>
              </div>

              {/* Layer toggles & Map hint */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold text-slate-300">{t.layers}:</span>
                  {(
                    [
                      ["maritime", t.maritime],
                      ["aviation", t.aviation],
                      ["disaster", t.disaster],
                      ["geofence", t.geofence],
                      ["rangeRings", t.rangeRings],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex cursor-pointer items-center gap-1.5 text-slate-300 hover:text-white whitespace-nowrap shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(show[k])}
                        onChange={() => setShow({ ...show, [k]: !show[k] })}
                        className="accent-sky-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400">{t.clickMapHint}</span>
              </div>
            </section>

            {/* Full-Width 4-Column Live Environmental & Sensor Telemetry Strip (di atas peta) */}
            {result && (
              <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 1. Weather Model */}
                <div className="iris-surface p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t.wxNow}</span>
                    <span className="font-mono tabular-nums text-sky-300">
                      {result.weather?.live ? t.model : t.down}
                    </span>
                  </div>
                  {result.weather?.live ? (
                    <div className="mt-2">
                      <div className="font-mono tabular-nums text-2xl font-bold text-white">
                        {result.weather.current?.temperature_2m ?? "—"}°C
                      </div>
                      <p className="mt-1 font-mono tabular-nums text-xs text-slate-300">
                        Angin {result.weather.current?.wind_speed_10m ?? "—"} km/j · Hujan maks {result.weather.precipProbMax ?? 0}%
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Kelembapan {result.weather.current?.relative_humidity_2m ?? "—"}% · Bukan amaran rasmi METMalaysia
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">{t.advisoriesNote}</p>
                  )}
                </div>

                {/* 2. Marine & Wave State */}
                <div className="iris-surface p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t.marineNow}</span>
                    <span className="font-mono tabular-nums text-emerald-300">
                      {result.marine?.live ? t.model : "DARATAN / TIADA"}
                    </span>
                  </div>
                  {result.marine?.live ? (
                    <div className="mt-2">
                      <div className="font-mono tabular-nums text-2xl font-bold text-white">
                        {result.marine.waveHeightM} m
                      </div>
                      <p className="mt-1 font-mono tabular-nums text-xs text-slate-300">
                        Tempoh {result.marine.wavePeriodS ?? "—"} s · Arah {result.marine.waveDirectionDeg ?? "—"}°
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Maks 24j: {result.marine.maxWave24hM} m · Sahkan Jabatan Laut
                      </p>
                      {result.marine.tide ? (
                        <div className="mt-2 border-t border-slate-700/60 pt-2">
                          <p className="text-[11px] text-slate-400">{t.tide} (MSL)</p>
                          <p className="mt-0.5 font-mono tabular-nums text-sm font-bold text-cyan-200">
                            {result.marine.tide.currentM} m {TIDE_TREND_ARROW[result.marine.tide.trend] ?? ""}{" "}
                            <span className="font-normal text-slate-300">{result.marine.tide.trend}</span>
                          </p>
                          <p className="mt-0.5 font-mono tabular-nums text-[11px] text-slate-300">
                            {result.marine.tide.nextHigh
                              ? `Pasang ${result.marine.tide.nextHigh.heightM} m @ ${String(result.marine.tide.nextHigh.time).slice(11, 16)}`
                              : ""}
                            {result.marine.tide.nextHigh && result.marine.tide.nextLow ? " · " : ""}
                            {result.marine.tide.nextLow
                              ? `Surut ${result.marine.tide.nextLow.heightM} m @ ${String(result.marine.tide.nextLow.time).slice(11, 16)}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Model GTSM — datum MSL global, bukan LAT. Sahkan jadual rasmi.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Tiada data pasang surut model bagi koordinat ini (daratan/liputan terhad).
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      Pilih pelabuhan atau perairan (cth. Port Klang, Selat Melaka, ZEE) untuk bacaan ombak langsung.
                    </p>
                  )}
                </div>

                {/* 3. Air Quality & Haze */}
                <div className="iris-surface p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t.aqNow}</span>
                    <span className="font-mono tabular-nums text-sky-300">
                      {result.airQuality?.live ? t.model : t.down}
                    </span>
                  </div>
                  {result.airQuality?.live ? (
                    <div className="mt-2">
                      {result.airQuality.ipu?.live ? (
                        <>
                          <div
                            className={`font-mono tabular-nums text-2xl font-bold ${IPU_TEXT_STYLE[result.airQuality.ipu.color] ?? "text-white"}`}
                          >
                            IPU {result.airQuality.ipu.ipu} ·{" "}
                            {lang === "ms" ? result.airQuality.ipu.categoryMs : result.airQuality.ipu.categoryEn}
                          </div>
                          <p className="mt-1 font-mono tabular-nums text-xs text-slate-300">
                            Dominan: {result.airQuality.ipu.dominant ?? "—"} · US AQI {result.airQuality.aqi ?? "—"} (rujukan)
                          </p>
                          <p className="mt-1 font-mono tabular-nums text-[11px] text-slate-400">
                            {(result.airQuality.ipu.subIndices ?? [])
                              .filter((s: any) => s.value != null)
                              .map((s: any) => `${s.pollutant}: ${s.value}`)
                              .join(" · ")}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="font-mono tabular-nums text-2xl font-bold text-white">
                            AQI {result.airQuality.aqi ?? "—"}
                          </div>
                          <p className="mt-1 font-mono tabular-nums text-xs text-slate-300">
                            PM2.5: {result.airQuality.pm25 ?? "—"} µg/m³ · PM10: {result.airQuality.pm10 ?? "—"} µg/m³
                          </p>
                        </>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">
                        Anggaran model gaya JAS — IPU rasmi di{" "}
                        <a href="https://apims.doe.gov.my/" target="_blank" rel="noreferrer" className="text-sky-300 underline">
                          JAS APIMS
                        </a>
                        .
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Data kualiti udara tidak dapat dicapai.</p>
                  )}
                </div>

                {/* 4. 30-Day USGS Seismic Timeline */}
                <div className="iris-surface p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t.quakeHist}</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {result.quakes?.live ? `${result.quakes.count} M4+` : t.down}
                    </span>
                  </div>
                  {timeline.length > 0 && (
                    <svg viewBox="0 0 300 60" className="mt-2 h-14 w-full" role="img" aria-label={t.quakeHist}>
                      {timeline.map((b: any, i: number) => (
                        <rect
                          key={b.date}
                          x={i * 10}
                          y={b.maxMag ? 60 - (b.maxMag / maxMag) * 56 : 58}
                          width="8"
                          height={b.maxMag ? (b.maxMag / maxMag) * 56 : 2}
                          rx="1"
                          fill={b.maxMag && b.maxMag >= 6 ? "#f87171" : "#f59e0b"}
                          opacity={b.count ? 1 : 0.25}
                        >
                          <title>{`${b.date}: ${b.count} gempa, maks M${b.maxMag ?? "-"}`}</title>
                        </rect>
                      ))}
                    </svg>
                  )}
                </div>
              </section>
            )}

            {/* Primary 2-Column Split: Interactive Map (Left) + Risk & Proximity Telemetry (Right) */}
            <section className="grid items-stretch gap-6 lg:grid-cols-[1fr_420px]">
              <div className="iris-surface flex flex-col justify-between p-4">
                <MapView
                  lat={lat}
                  lon={lon}
                  quakes={result?.quakes?.events ?? []}
                  adsb={result?.adsb?.states ?? []}
                  locations={ref?.locations ?? []}
                  floodProne={ref?.floodProne ?? []}
                  corridorPoints={activeCorridorObj?.points ?? []}
                  show={show}
                  onSelectPoint={onMapPointClick}
                />

                {/* Quick Strategic Presets Bar below map */}
                <div className="no-print mt-3 flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-slate-400">Pintas Strategik:</span>
                  {[
                    { name: "Port Klang", lat: 2.999, lon: 101.392, state: "Selangor" },
                    { name: "KLIA (KUL)", lat: 2.745, lon: 101.71, state: "Selangor" },
                    { name: "Kota Bharu", lat: 6.133, lon: 102.238, state: "Kelantan" },
                    { name: "Tanjung Pelepas", lat: 1.362, lon: 103.551, state: "Johor" },
                    { name: "Pelabuhan Bintulu", lat: 3.268, lon: 113.062, state: "Sarawak" },
                    { name: "Kota Kinabalu", lat: 5.978, lon: 116.075, state: "Sabah" },
                    { name: "Laut China Selatan (ZEE)", lat: 4.5, lon: 105.5, state: "Pahang" },
                  ].map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => pickLocation(p.name, p.lat, p.lon, p.state, false)}
                      className="rounded border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300 hover:border-sky-500/50 hover:text-white whitespace-nowrap shrink-0 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Transparent Risk Score Breakdown & Proximity Radar */}
              <div className="iris-surface flex flex-col justify-between p-5">
                {result ? (
                  <div className="space-y-5">
                    {/* Unboxed Metadata & Primary Risk Score */}
                    <div className="border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Zon: {result.zone}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {result.coords[0].toFixed(3)}°N, {result.coords[1].toFixed(3)}°E
                        </span>
                        {result.scenario && result.scenario !== "live" && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300 font-semibold">SIMULASI</span>
                          </>
                        )}
                      </div>

                      <div className="mt-2 flex items-baseline justify-between gap-4">
                        <h2 className="text-lg font-bold text-white">{result.label}</h2>
                        <div className="text-right font-mono tabular-nums">
                          <span className={`text-xl font-bold ${RISK_TEXT_STYLE[result.risk.status] ?? "text-slate-200"}`}>
                            {result.risk.status}
                          </span>
                          <span className="ml-2 text-sm text-slate-300">{result.risk.score}/100</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">{result.risk.methodology}</p>
                    </div>

                    {/* Transparent Factor Table */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200">Pecahan Pemberat Faktor Risiko</h3>
                      <div className="mt-2.5 divide-y divide-slate-800/80 border-t border-b border-slate-800">
                        {result.risk.factors.map((f: any) => (
                          <div key={f.name} className="py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-200">
                                {f.name} <span className="font-mono tabular-nums text-slate-400">({f.weight}%)</span>
                              </span>
                              <span className="font-mono tabular-nums font-semibold text-sky-300">{f.value}/10</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-400">{f.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Geospatial Proximity Radar */}
                    {result.proximity && (
                      <div>
                        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                          <Compass size={14} className="text-sky-400" />
                          {t.proximityTitle}
                        </h3>
                        <div className="mt-2 divide-y divide-slate-800/70 border-t border-b border-slate-800 text-xs">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-slate-400">{t.nearestPort}</span>
                            <span className="font-mono tabular-nums text-slate-200">
                              {result.proximity.nearestPort
                                ? `${result.proximity.nearestPort.name} (${result.proximity.nearestPort.distKm} km)`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-slate-400">{t.nearestAirport}</span>
                            <span className="font-mono tabular-nums text-slate-200">
                              {result.proximity.nearestAirport
                                ? `${result.proximity.nearestAirport.name} (${result.proximity.nearestAirport.distKm} km)`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-slate-400">{t.nearestFlood}</span>
                            <span className="font-mono tabular-nums text-slate-200">
                              {result.proximity.nearestFloodBasin
                                ? `${result.proximity.nearestFloodBasin.district} · ${result.proximity.nearestFloodBasin.river} (${result.proximity.nearestFloodBasin.distKm} km)`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-slate-400">{t.nearestQuake}</span>
                            <span className="font-mono tabular-nums text-amber-300">
                              {result.proximity.nearestQuake
                                ? `M${result.proximity.nearestQuake.mag} (${result.proximity.nearestQuake.distKm} km)`
                                : "Tiada M4+"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-slate-400">{t.nearestAircraft}</span>
                            <span className="font-mono tabular-nums text-sky-300">
                              {result.proximity.nearestAircraft
                                ? `${result.proximity.nearestAircraft.callsign} (${result.proximity.nearestAircraft.distKm} km · ${result.proximity.aircraftWithin100Km} dlm 100km)`
                                : "Tiada jejak aktif"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">Memuatkan telemetri lokasi Malaysia…</div>
                )}

                {/* Compliance / Verification Gate Quick Tester */}
                <div className="no-print mt-4 border-t border-slate-800 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => analyzeTarget(1.352, 103.819, "Singapura (Ujian Luar Sempadan)", asset, "", "live", "")}
                      className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-amber-500/50 hover:text-amber-200 whitespace-nowrap shrink-0"
                    >
                      {t.testForeignReject}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomNotes("pergerakan tentera sulit");
                        analyzeTarget(lat, lon, q, asset, stateSel, scenario, "pergerakan tentera sulit");
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-amber-500/50 hover:text-amber-200 whitespace-nowrap shrink-0"
                    >
                      {t.testClaimVerify}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 24-Hour Hourly Precipitation & Wind Forecast Bar + Verified Evidence */}
            {result && (
              <section className="grid gap-6 lg:grid-cols-2">
                {/* 24h Forecast Chart */}
                <div className="iris-surface p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">{t.forecast24h}</h3>
                    <span className="font-mono tabular-nums text-xs text-slate-400">Open-Meteo · 24j</span>
                  </div>
                  {forecast24h.length > 0 ? (
                    <div className="mt-4">
                      <svg viewBox="0 0 480 90" className="h-24 w-full">
                        {forecast24h.map((h: any, idx: number) => {
                          const barH = Math.max(3, (h.precipProb / 100) * 70);
                          return (
                            <g key={h.time}>
                              <rect
                                x={idx * 20}
                                y={75 - barH}
                                width="14"
                                height={barH}
                                rx="1.5"
                                fill={h.precipProb >= 70 ? "#f59e0b" : "#38bdf8"}
                                opacity={0.85}
                              >
                                <title>{`${h.time.slice(11, 16)} MYT — Hujan: ${h.precipProb}%, Suhu: ${h.tempC ?? "?"}°C, Angin: ${h.windKmh ?? "?"} km/j`}</title>
                              </rect>
                              {idx % 4 === 0 && (
                                <text x={idx * 20} y={88} fill="#94a3b8" fontSize="9" fontFamily="monospace">
                                  {h.time.slice(11, 16)}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Bar jingga menunjukkan kebarangkalian hujan model ≥ 70%. Sahkan amaran ribut petir/monsun melalui METMalaysia.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">Unjuran 24 jam tidak tersedia.</p>
                  )}
                </div>

                {/* Verified Evidence & Follow-Up Actions */}
                <div className="iris-surface p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      {t.evidence} <span className="font-mono tabular-nums text-sky-400">({result.risk.evidence.length})</span>
                    </h3>
                    <span className="text-xs text-slate-400">Gerbang Verifikasi Aktif</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                    {result.risk.evidence.map((e: any, i: number) => (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800/60 pb-1.5">
                        <span>
                          {e.observation} —{" "}
                          <a className="text-sky-300 underline" href={e.sourceUrl} target="_blank" rel="noreferrer">
                            {e.source}
                          </a>
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500">{e.timestamp.slice(11, 19)}Z</span>
                      </li>
                    ))}
                    {result.risk.evidence.length === 0 && (
                      <li className="text-xs text-slate-500">INSUFFICIENT EVIDENCE — tiada dakwaan disahkan.</li>
                    )}
                  </ul>

                  <div className="mt-4 grid gap-4 border-t border-slate-800 pt-3 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-semibold text-amber-300">{t.limitations}</h4>
                      <ul className="mt-1 space-y-1 text-xs text-slate-400">
                        {result.risk.limitations.map((l: string, i: number) => (
                          <li key={i}>• {l}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-sky-300">{t.actions}</h4>
                      <ul className="mt-1 space-y-1 text-xs text-slate-300">
                        {result.risk.followUp.map((l: string, i: number) => (
                          <li key={i}>• {l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 8 Specialized Intelligence Agents Matrix */}
            {result?.agents && (
              <section className="iris-surface p-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">{t.agentsTitle}</h3>
                  <span className="text-xs text-slate-400">8 Ejen Domain Malaysia · Bukti & Batasan Eksplisit</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {result.agents.map((ag: any) => (
                    <div key={ag.agent} className="flex flex-col justify-between rounded border border-slate-800 bg-[#0b1120] p-3.5 text-xs">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span>Keyakinan: {ag.confidence}</span>
                          <span className="font-mono tabular-nums">{ag.evidence?.length ?? 0} bukti</span>
                        </div>
                        <h4 className="mt-1 font-semibold text-sky-300">{ag.agent}</h4>
                        <p className="mt-1.5 leading-relaxed text-slate-200">{ag.summary}</p>
                        {ag.observations?.length > 0 && (
                          <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                            {ag.observations.map((obs: string, idx: number) => (
                              <li key={idx}>• {obs}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {ag.sources?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800/80 pt-2 text-[11px]">
                          {ag.sources.map((s: any) => (
                            <a
                              key={s.url}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 underline hover:text-sky-200"
                            >
                              {s.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Static Flood Reference for Selected State */}
            {result?.advisories?.floodProne?.length > 0 && (
              <section className="iris-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-semibold text-amber-300">
                    {t.floodRef}
                    {stateSel ? ` — ${stateSel}` : ""}
                  </h3>
                  <span className="text-xs text-slate-400">{t.advisoriesNote}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {result.advisories.floodProne.map((f: any, i: number) => (
                    <div key={i} className="flex items-start justify-between gap-3 rounded border border-slate-800 bg-[#0b1120] p-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-100">
                          {f.district} · <span className="text-amber-300">{f.river}</span>
                        </div>
                        <p className="mt-1 text-slate-400">{f.note}</p>
                      </div>
                      {f.lat && f.lon && (
                        <button
                          type="button"
                          onClick={() => pickLocation(`${f.district} (${f.river})`, f.lat, f.lon, f.state, false)}
                          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-sky-300 hover:border-sky-500 whitespace-nowrap shrink-0"
                        >
                          {t.selectOnMap}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ==================== TAB 2: CORRIDOR MATRIX ==================== */}
        {activeTab === "corridors" && (
          <div className="space-y-6">
            <section className="iris-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{t.navCorridors}</h2>
                  <p className="mt-1 text-xs text-slate-400">{t.corridorDesc}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={corridorId}
                    onChange={(e) => {
                      setCorridorId(e.target.value);
                      runCorridorScan(e.target.value);
                    }}
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none"
                  >
                    {((ref?.corridors ?? []) as any[]).map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === "ms" ? c.nameMs : c.nameEn}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => runCorridorScan(corridorId)}
                    disabled={corridorBusy}
                    className="flex items-center gap-1.5 rounded bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw size={13} className={corridorBusy ? "animate-spin" : ""} />
                    {t.scanCorridor}
                  </button>
                  {corridorScan?.rows && (
                    <button
                      type="button"
                      onClick={exportCorridorCsv}
                      className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-slate-500 whitespace-nowrap shrink-0"
                    >
                      <Download size={13} />
                      {t.exportCsv}
                    </button>
                  )}
                </div>
              </div>

              {corridorBusy ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Mengimbas telemetri cuaca, laut, kualiti udara & seismik merentasi koridor strategik…
                </div>
              ) : corridorScan?.rows ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 pr-4 font-medium">Lokasi Strategik</th>
                        <th className="px-3 py-2.5 font-medium">Negeri</th>
                        <th className="px-3 py-2.5 font-medium">Zon</th>
                        <th className="px-3 py-2.5 text-right font-medium">Koordinat</th>
                        <th className="px-3 py-2.5 text-right font-medium">Suhu (°C)</th>
                        <th className="px-3 py-2.5 text-right font-medium">Angin (km/j)</th>
                        <th className="px-3 py-2.5 text-right font-medium">Hujan (24j)</th>
                        <th className="px-3 py-2.5 text-right font-medium">Ombak (m)</th>
                        <th className="px-3 py-2.5 text-right font-medium">IPU</th>
                        <th className="px-3 py-2.5 text-right font-medium">Pasang (m)</th>
                        <th className="px-3 py-2.5 text-right font-medium">Status Risiko</th>
                        <th className="py-2.5 pl-4 text-right font-medium">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {corridorScan.rows.map((r: any) => (
                        <tr key={r.name} className="hover:bg-slate-900/60">
                          <td className="py-3 pr-4 font-semibold text-white">{r.name}</td>
                          <td className="px-3 py-3 text-slate-300">{r.state}</td>
                          <td className="px-3 py-3 text-slate-400">{r.zone}</td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-300">
                            {r.lat.toFixed(3)}, {r.lon.toFixed(3)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                            {r.tempC != null ? `${r.tempC}°C` : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                            {r.windKmh != null ? r.windKmh : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-sky-300">
                            {r.precipProb != null ? `${r.precipProb}%` : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-300">
                            {r.waveM != null ? `${r.waveM} m` : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                            {r.ipu != null ? `${r.ipu}${r.ipuCategory ? ` ${r.ipuCategory}` : ""}` : (r.aqi != null ? `AQI ${r.aqi}` : "—")}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-cyan-200">
                            {r.tideM != null ? `${r.tideM} m ${TIDE_TREND_ARROW[r.tideTrend] ?? ""}` : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            <span className={`font-bold ${RISK_TEXT_STYLE[r.riskStatus] ?? "text-slate-200"}`}>
                              {r.riskStatus}
                            </span>{" "}
                            <span className="text-slate-400">({r.riskScore})</span>
                          </td>
                          <td className="py-3 pl-4 text-right">
                            <button
                              type="button"
                              onClick={() => pickLocation(r.name, r.lat, r.lon, r.state, true)}
                              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-sky-300 hover:border-sky-500 whitespace-nowrap shrink-0"
                            >
                              <MapPin size={12} />
                              {t.selectOnMap}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </div>
        )}

        {/* ==================== TAB 3: CUSTOMS & STRATEGIC TRADE ==================== */}
        {activeTab === "flights" && (
          <div className="space-y-6">
            <section className="iris-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <Plane size={18} className="text-sky-400" />
                    {t.navFlights} — Airport Utama Malaysia
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">{t.flightsDesc}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={flightAirport}
                    onChange={(e) => setFlightAirport(e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none"
                  >
                    <option value="all">{t.allAirports}</option>
                    {((flights?.boards ?? []) as any[]).map((b: any) => (
                      <option key={b.name} value={b.name}>
                        {b.name} ({b.count})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadFlights}
                    disabled={flightsBusy}
                    className="flex items-center gap-1.5 rounded bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw size={13} className={flightsBusy ? "animate-spin" : ""} />
                    {t.autoRefresh}
                  </button>
                </div>
              </div>

              {flightsBusy && !flights ? (
                <div className="py-12 text-center text-xs text-slate-400">Memuatkan trafik ADS-B masa nyata…</div>
              ) : flights?.live ? (
                <div className="mt-4 space-y-5">
                  <p className="font-mono tabular-nums text-xs text-slate-400">
                    <span className="text-emerald-300">{t.model}</span> · {flights.count} jejak · radius {flights.radiusKm ?? 80}km ·
                    sumber {flights.source ?? "opensky"} · dikemas kini {String(flights.fetchedAt ?? "").slice(11, 19)}Z
                  </p>
                  {flights.stale && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono tabular-nums text-[11px] text-amber-200">
                      Data LEWAT {flights.staleSec ?? "?"}s — OpenSky + fallback tidak dapat dihubungi. Paparan terakhir yang
                      berjaya, bukan trafik semasa.
                    </p>
                  )}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <h3 className="text-xs font-semibold text-slate-200">{t.flightsTraffic}</h3>
                      <svg
                        viewBox={`0 0 480 ${flightBoardsAll.length * 30 + 8}`}
                        className="mt-3 w-full"
                        role="img"
                        aria-label={t.flightsTraffic}
                      >
                        {flightBoardsAll.map((b: any, i: number) => {
                          const w = Math.max(3, ((b.count ?? 0) / maxBoardCount) * 300);
                          return (
                            <g key={b.name}>
                              <text x={0} y={i * 30 + 19} fill="#94a3b8" fontSize="12" fontFamily="monospace">
                                {shortAirportCode(b.name)}
                              </text>
                              <rect
                                x={64}
                                y={i * 30 + 6}
                                width={w}
                                height={16}
                                rx={3}
                                fill={(b.count ?? 0) > 0 ? "#38bdf8" : "#1e293b"}
                                opacity={(b.count ?? 0) > 0 ? 0.9 : 1}
                              >
                                <title>{`${b.name}: ${b.count ?? 0} trafik`}</title>
                              </rect>
                              <text x={70 + w} y={i * 30 + 19} fill="#e2e8f0" fontSize="12" fontFamily="monospace">
                                {b.count ?? 0}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <h3 className="text-xs font-semibold text-slate-200">
                        {t.flightsAlt}
                        {flightAirport !== "all" && <span className="font-normal text-slate-400"> · {flightAirport}</span>}
                      </h3>
                      <svg viewBox="0 0 300 96" className="mt-3 h-28 w-full" role="img" aria-label={t.flightsAlt}>
                        {altCounts.map((c, i) => {
                          const h = Math.max(3, (c / maxAltCount) * 62);
                          return (
                            <g key={ALT_LABELS[i]}>
                              <rect
                                x={i * 60 + 12}
                                y={74 - h}
                                width={36}
                                height={h}
                                rx={2}
                                fill="#38bdf8"
                                opacity={c ? 0.9 : 0.25}
                              >
                                <title>{`${ALT_LABELS[i]} ft: ${c} pesawat`}</title>
                              </rect>
                              <text x={i * 60 + 30} y={70 - h} fill="#e2e8f0" fontSize="10" textAnchor="middle" fontFamily="monospace">
                                {c}
                              </text>
                              <text x={i * 60 + 30} y={88} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                                {ALT_LABELS[i]}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                      <p className="mt-1 font-mono tabular-nums text-[11px] text-slate-500">
                        {altKnown} beraltitud · {altPool.length - altKnown} tanpa bacaan altitud
                      </p>
                    </div>
                  </div>
                  {((flightAirport === "all" ? flights.boards : flights.boards.filter((b: any) => b.name === flightAirport)) as any[]).map(
                    (b: any) => (
                      <div key={b.name} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-white">
                            {b.name} <span className="font-normal text-slate-400">· {b.state}</span>
                          </h3>
                          <span className="font-mono tabular-nums text-xs text-sky-300">
                            {b.count} trafik · {b.lat.toFixed(3)}, {b.lon.toFixed(3)}
                          </span>
                        </div>
                        {b.flights.length > 0 ? (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-400">
                                  <th className="py-2 pr-4 font-medium">Callsign</th>
                                  <th className="px-3 py-2 font-medium">ICAO</th>
                                  <th className="px-3 py-2 text-right font-medium">Alt (ft)</th>
                                  <th className="px-3 py-2 text-right font-medium">Halaju (km/j)</th>
                                  <th className="px-3 py-2 text-right font-medium">Arah (°)</th>
                                  <th className="py-2 pl-4 text-right font-medium">Jarak (km)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/70">
                                {b.flights.slice(0, 25).map((f: any) => (
                                  <tr key={f.icao || f.callsign} className="hover:bg-slate-900/60">
                                    <td className="py-2 pr-4 font-mono font-semibold text-white">{f.callsign}</td>
                                    <td className="px-3 py-2 font-mono uppercase text-slate-400">{f.icao}</td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">
                                      {f.altM != null ? Math.round(f.altM * 3.28084).toLocaleString("en-US") : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">
                                      {f.velKmh ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">
                                      {f.heading ?? "—"}
                                    </td>
                                    <td className="py-2 pl-4 text-right font-mono tabular-nums text-emerald-300">{f.distKm}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {b.flights.length > 25 && (
                              <p className="mt-1 text-[11px] text-slate-500">
                                Papar 25 daripada {b.flights.length} trafik terdekat.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">{t.noFlights}</p>
                        )}
                      </div>
                    )
                  )}
                  {(flights.enRoute ?? []).length > 0 && flightAirport === "all" && (
                    <p className="font-mono tabular-nums text-[11px] text-slate-500">
                      {t.enRoute}: {(flights.enRoute as any[]).length} jejak di luar radius airport (jelajah/laluan atas).
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Trafik ADS-B sukarela masa nyata — bukan jadual berlepas/ketibaan. Sahkan status penerbangan dengan
                    operator/CAAM.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
                  <p className="font-semibold">Data ADS-B TIADA (OpenSky had kadar/outage) — bukan sifar trafik.</p>
                  <button
                    type="button"
                    onClick={loadFlights}
                    disabled={flightsBusy}
                    className="mt-2 rounded border border-amber-500/40 px-3 py-1.5 text-[11px] hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    Cuba semula
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "customs" && (
          <div className="space-y-6">
            <section className="iris-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{t.customsTitle}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {customsData?.disclaimer ?? "Rujukan Akta Kastam 1967 (JKDM) & Akta Perdagangan Strategik 2010 (MITI)."}
                  </p>
                </div>
                <div className="flex w-full max-w-md items-center rounded border border-slate-700 bg-slate-900 px-3 py-2">
                  <Search size={14} className="mr-2 shrink-0 text-slate-400" />
                  <input
                    value={customsQ}
                    onChange={(e) => searchCustoms(e.target.value)}
                    placeholder={t.customsSearch}
                    className="w-full bg-transparent text-xs text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-800">
                {(customsData?.items ?? []).map((item: any) => (
                  <div key={item.hsPrefix} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums text-sm font-bold text-sky-400">HS {item.hsPrefix}</span>
                        <h3 className="text-sm font-semibold text-white">
                          {lang === "ms" ? item.commodityMs : item.commodityEn}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">
                        {item.agency} · {item.actRef}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      {lang === "ms" ? item.permitNoteMs : item.permitNoteEn}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-400">Pintu Masuk / Pelabuhan Utama:</span>
                      {item.keyPorts.map((kp: string) => {
                        const found = ((ref?.locations ?? []) as any[]).find((l) => l.name === kp);
                        return (
                          <button
                            key={kp}
                            type="button"
                            onClick={() => {
                              if (found) {
                                setAsset("kastam — Akta Kastam 1967");
                                pickLocation(found.name, found.lat, found.lon, found.state, true);
                              }
                            }}
                            className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-sky-300 hover:border-sky-500 whitespace-nowrap shrink-0"
                          >
                            {kp}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ==================== TAB 4: SITREP ARCHIVE ==================== */}
        {activeTab === "sitreps" && (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* Left Sidebar: Generated SITREPs list */}
            <aside className="no-print iris-surface p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-semibold text-white">Arkib Laporan SITREP ({sitrepList.length})</h2>
                <button
                  type="button"
                  onClick={genSitrep}
                  disabled={busy}
                  className="rounded bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  + {t.sitrep}
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {sitrepList.map((s: any) => (
                  <div
                    key={s.reportId}
                    className={`flex items-center justify-between gap-2 rounded border p-3 text-xs transition-colors ${
                      sitrep?.reportId === s.reportId
                        ? "border-sky-500/60 bg-slate-900"
                        : "border-slate-800 bg-[#0b1120] hover:border-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSitrep(s)}
                      className="flex-1 text-left"
                    >
                      <div className="font-mono tabular-nums font-semibold text-sky-300">{s.reportId}</div>
                      <div className="mt-0.5 font-medium text-slate-200">{s.location}</div>
                      <div className="mt-0.5 font-mono tabular-nums text-[11px] text-slate-400">
                        {s.risk.status} ({s.risk.score}/100) · {s.timestampMYT}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSitrep(s.reportId)}
                      className="p-1 text-slate-500 hover:text-red-400"
                      title="Padam SITREP"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {sitrepList.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-500">
                    Tiada SITREP dijana dalam sesi ini. Klik "{t.sitrep}" untuk menjana laporan rasmi.
                  </p>
                )}
              </div>
            </aside>

            {/* Right Pane: Active SITREP Document */}
            <section className="iris-surface p-6 print:border-none print:bg-white print:text-black" id="sitrep">
              {sitrep ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4 print:border-slate-300">
                    <div>
                      <div className="font-mono tabular-nums text-xs text-sky-400 print:text-slate-700">
                        ID: {sitrep.reportId} · {sitrep.timestampMYT}
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-white print:text-black">{sitrep.title}</h2>
                      <p className="mt-1 text-xs text-slate-400 print:text-slate-700">
                        Lokasi: <strong className="text-slate-200 print:text-black">{sitrep.location}</strong> (
                        <span className="font-mono tabular-nums">{sitrep.coords.join(", ")}</span>) · Kategori:{" "}
                        {sitrep.assetCategory}
                      </p>
                    </div>
                    <div className="no-print flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(sitrep, null, 2)], { type: "application/json" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `${sitrep.reportId}.json`;
                          a.click();
                        }}
                        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 whitespace-nowrap shrink-0"
                      >
                        <Download size={13} />
                        {t.exportJson}
                      </button>
                      <button
                        type="button"
                        onClick={() => exportSitrepMarkdown(sitrep)}
                        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 whitespace-nowrap shrink-0"
                      >
                        <Download size={13} />
                        {t.exportMd}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex items-center gap-1 rounded bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 whitespace-nowrap shrink-0"
                      >
                        <Printer size={13} />
                        {t.exportPdf}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded border border-slate-800 bg-[#0b1120] p-3 text-xs print:border-slate-300 print:bg-slate-50">
                      <span className="text-slate-400">Status & Skor Risiko</span>
                      <div className="mt-1 font-mono tabular-nums text-base font-bold text-white print:text-black">
                        {sitrep.risk.status} ({sitrep.risk.score}/100)
                      </div>
                    </div>
                    <div className="rounded border border-slate-800 bg-[#0b1120] p-3 text-xs print:border-slate-300 print:bg-slate-50">
                      <span className="text-slate-400">Tahap Keyakinan</span>
                      <div className="mt-1 font-semibold text-slate-200 print:text-black">{sitrep.confidence}</div>
                    </div>
                    <div className="rounded border border-slate-800 bg-[#0b1120] p-3 text-xs print:border-slate-300 print:bg-slate-50">
                      <span className="text-slate-400">{t.nextReview}</span>
                      <div className="mt-1 font-mono tabular-nums font-semibold text-sky-300 print:text-black">
                        {sitrep.nextReview}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs leading-relaxed">
                    <h3 className="font-semibold text-sky-300 print:text-black">Ringkasan Eksekutif</h3>
                    <p className="mt-1 text-slate-200 print:text-black">{sitrep.execSummary}</p>
                  </div>

                  <div className="text-xs">
                    <h3 className="font-semibold text-sky-300 print:text-black">
                      Pemerhatian Disahkan ({sitrep.observations.length})
                    </h3>
                    <ul className="mt-1.5 space-y-1 text-slate-300 print:text-black">
                      {sitrep.observations.map((o: string, i: number) => (
                        <li key={i} className="font-mono tabular-nums text-[11px]">
                          • {o}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid gap-4 border-t border-slate-800 pt-4 text-xs md:grid-cols-2 print:border-slate-300">
                    <div>
                      <h3 className="font-semibold text-sky-300 print:text-black">Konteks Geospatial</h3>
                      <p className="mt-1 text-slate-300 print:text-black">{sitrep.geoContext}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sky-300 print:text-black">Konteks Kawal Selia Malaysia</h3>
                      <p className="mt-1 text-slate-300 print:text-black">{sitrep.regulatory}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-4 text-xs print:border-slate-300">
                    <h3 className="font-semibold text-sky-300 print:text-black">Petikan Sumber Sahih</h3>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      {sitrep.citations.map((c: any) => (
                        <a
                          key={c.url}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-300 underline print:text-black"
                        >
                          {c.name} ({c.url})
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-slate-400">
                  Pilih laporan SITREP daripada senarai di sebelah kiri atau klik "{t.sitrep}" untuk menjana laporan baharu.
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================== TAB 5: SOURCES & AUDIT ==================== */}
        {activeTab === "audit" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Data Source Verification & Official Portals */}
            <section className="iris-surface p-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-white">
                  <ShieldCheck size={16} className="text-sky-400" />
                  {t.sources}
                </h2>
                <button
                  type="button"
                  onClick={() => api<any>("/api/health").then(setHealth).catch(() => {})}
                  className="text-xs text-sky-400 underline hover:text-sky-300"
                >
                  Semak Semula
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-800">
                {(health?.sources ?? []).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-3 text-xs">
                    <div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-slate-100 underline hover:text-sky-300"
                      >
                        {s.name}
                      </a>
                      <div className="mt-0.5 font-mono tabular-nums text-[11px] text-slate-400">
                        Jenis: {s.kind.toUpperCase()} · TTL: {s.freshSec ?? "—"}s
                        {s.lastOk ? ` · OK: ${s.lastOk.slice(11, 19)}Z` : ""}
                        {s.lastError ? ` · Ralat: ${s.lastError}` : ""}
                      </div>
                    </div>
                    <span className={`font-mono tabular-nums font-bold ${s.lastOk ? "text-emerald-400" : "text-red-400"}`}>
                      {s.lastOk ? t.live : t.down}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-800 pt-4">
                <h3 className="text-xs font-semibold text-slate-200">{t.portals}</h3>
                <p className="mt-1 text-[11px] text-slate-400">
                  Pautan rasmi agensi kerajaan Malaysia untuk pengesahan silang operasi.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(ref?.portals ?? []).map((p: any) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded border border-slate-800 bg-[#0b1120] px-3 py-2 text-xs text-slate-200 hover:border-sky-500/50 hover:text-sky-300"
                    >
                      <span>{p.name}</span>
                      <ExternalLink size={12} className="shrink-0 text-slate-500" />
                    </a>
                  ))}
                </div>
              </div>
            </section>

            {/* Security & Geofence Audit Log */}
            <section className="iris-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white">
                  {t.audit} <span className="font-mono tabular-nums text-xs text-slate-400">({filteredAudit.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 outline-none"
                  >
                    <option value="all">Semua Peristiwa</option>
                    <option value="analyze">Analisis</option>
                    <option value="sitrep">SITREP</option>
                    <option value="batch-scan">Imbasan Koridor</option>
                    <option value="reject">Penolakan Geofence (403)</option>
                    <option value="verification-block">Sekatan Bukti (422)</option>
                    <option value="alert">Amaran Risiko</option>
                  </select>
                  {audit.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = "iris-audit.json";
                        a.click();
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-sky-300 hover:border-slate-500 whitespace-nowrap shrink-0"
                    >
                      {t.exportJson}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 max-h-[460px] divide-y divide-slate-800/70 overflow-auto text-xs">
                {filteredAudit.map((a: any, i: number) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 py-2.5">
                    <div>
                      <span className="font-mono font-semibold text-sky-300">{a.kind}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="text-slate-200">{a.detail}</span>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                      {a.at.slice(11, 19)}Z
                    </span>
                  </div>
                ))}
                {filteredAudit.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-500">Tiada rekod audit sepadan penapis.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
      <span className="hidden">{tick}</span>
    </div>
  );
}
