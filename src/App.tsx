import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Ship, Plane, CloudRain, Building2, Landmark, Satellite, FileText, Languages, RefreshCw, TriangleAlert } from "lucide-react";
import MapView from "./components/MapView";
import { api } from "./lib/api";
import { STR, type Lang } from "./lib/i18n";
import "./index.css";

const RISK_COLOR: Record<string, string> = {
  LOW: "text-emerald-300 border-emerald-400/40", GUARDED: "text-teal-200 border-teal-400/40",
  MODERATE: "text-amber-300 border-amber-400/40", HIGH: "text-orange-400 border-orange-500/50",
  CRITICAL: "text-red-400 border-red-500/60", "INSUFFICIENT EVIDENCE": "text-slate-300 border-slate-400/40",
};

export default function App() {
  const [lang, setLang] = useState<Lang>("ms");
  const t = STR[lang];
  const [ref, setRef] = useState<any>(null);
  const [q, setQ] = useState("");
  const [lat, setLat] = useState(3.0);
  const [lon, setLon] = useState(101.4);
  const [stateSel, setStateSel] = useState("");
  const [asset, setAsset] = useState("maritim — Port Klang");
  const [show, setShow] = useState({ maritime: true, aviation: true, disaster: true });
  const [refreshSec, setRefreshSec] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [sitrep, setSitrep] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    api<any>("/api/reference").then(setRef).catch(() => {});
    api<any>("/api/health").then(setHealth).catch(() => {});
  }, []);

  // Detik kesegaran
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const pick = (name: string, la: number, lo: number, st?: string) => { setQ(name); setLat(la); setLon(lo); if (st) setStateSel(st); };
  const onState = (s: string) => {
    setStateSel(s);
    const c = ref?.stateCenters?.[s];
    if (c) { setLat(c[0]); setLon(c[1]); setQ(s); }
  };
  const matches = ((ref?.locations ?? []) as any[])
    .filter((l) => (!stateSel || l.state === stateSel) && l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  async function analyze() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr(""); setSitrep(null);
    try {
      const r = await api<any>("/api/analyze", { method: "POST", body: JSON.stringify({ lat, lon, label: q || `${lat},${lon}`, asset, state: stateSel }) });
      setResult(r); setLastFetch(Date.now());
      const h = await api<any>("/api/health").catch(() => null); if (h) setHealth(h);
      const a = await api<any[]>("/api/audit").catch(() => []); setAudit(a);
    } catch (e: any) { setErr(e.message); }
    finally { busyRef.current = false; setBusy(false); }
  }

  // Auto-segar boleh dikonfigurasi (spec §9)
  useEffect(() => {
    if (!refreshSec) return;
    const id = setInterval(() => { analyze(); }, refreshSec * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSec, lat, lon, q, asset, stateSel]);

  async function genSitrep() {
    setBusy(true); setErr("");
    try {
      const s = await api<any>("/api/sitrep", { method: "POST", body: JSON.stringify({ lat, lon, label: q || `${lat},${lon}`, asset }) });
      setSitrep(s);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const freshness = lastFetch ? Math.max(0, Math.round((Date.now() - lastFetch) / 1000)) : null;
  const isAlert = result && (result.risk.status === "HIGH" || result.risk.status === "CRITICAL");
  const timeline: any[] = result?.quakes?.timeline ?? [];
  const maxMag = Math.max(1, ...timeline.map((b: any) => b.maxMag ?? 0));

  return (
    <div className="min-h-screen bg-[#060d1a] p-3 md:p-6">
      <header className="no-print mb-4 flex flex-wrap items-center gap-3">
        <ShieldAlert className="text-cyan-300" />
        <div>
          <h1 className="text-xl font-bold tracking-widest text-cyan-200">{t.title} <span className="text-xs text-slate-400">V2.0</span></h1>
          <p className="text-xs text-slate-400">{t.sub} · Malaysia Only · MYT (UTC+8){freshness != null && ` · ${t.fetchedAgo} ${freshness}s`}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setLang(lang === "ms" ? "en" : "ms")} className="iris-card flex items-center gap-1 px-3 py-1.5 text-xs"><Languages size={14} />{lang === "ms" ? "BM | EN" : "EN | BM"}</button>
        </div>
      </header>

      {isAlert && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/60 bg-red-950/60 p-3 text-sm text-red-200">
          <TriangleAlert size={18} /><b>{t.alertBanner}:</b> {result.label} — {result.risk.status} ({result.risk.score}/100). {result.risk.followUp?.[0] ?? ""}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div>
          <MapView lat={lat} lon={lon} quakes={result?.quakes?.events ?? []} adsb={result?.adsb ?? []} show={show} />
          <div className="no-print mt-3 grid gap-2 md:grid-cols-[1fr_150px_110px_110px_auto_auto]">
            <div className="relative">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="iris-card w-full px-3 py-2 text-sm outline-none" />
              {q && matches.length > 0 && (
                <div className="iris-card absolute z-10 mt-1 max-h-48 w-full overflow-auto p-1">
                  {matches.map((m: any) => (
                    <button key={m.name} onClick={() => pick(m.name, m.lat, m.lon, m.state)} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-cyan-400/10">{m.name} · {m.state}</button>
                  ))}
                </div>
              )}
            </div>
            <select value={stateSel} onChange={(e) => onState(e.target.value)} className="iris-card px-2 py-2 text-xs">
              <option value="">{t.allStates}</option>
              {(ref?.states ?? []).map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" step="0.001" value={lat} onChange={(e) => setLat(Number(e.target.value))} className="iris-card px-2 py-2 text-xs" title="Lat" />
            <input type="number" step="0.001" value={lon} onChange={(e) => setLon(Number(e.target.value))} className="iris-card px-2 py-2 text-xs" title="Lon" />
            <button onClick={analyze} disabled={busy} className="flex items-center gap-1 rounded-lg bg-cyan-500/80 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{busy ? "…" : t.analyze}</button>
            <button onClick={genSitrep} disabled={busy} className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50"><span className="flex items-center gap-1"><FileText size={14} />{t.sitrep}</span></button>
          </div>
          <div className="no-print mt-2 flex flex-wrap items-center gap-2 text-xs">
            <select value={asset} onChange={(e) => setAsset(e.target.value)} className="iris-card px-2 py-1.5">
              {["maritim — Port Klang", "penerbangan — KLIA", "bencana — Kelantan", "maritim — Sabah", "infrastruktur — Sarawak", "kastam — Akta Kastam 1967", "umum"].map((a) => <option key={a}>{a}</option>)}
            </select>
            {(["maritime", "aviation", "disaster"] as const).map((k) => (
              <label key={k} className="iris-card flex items-center gap-1 px-2 py-1.5">
                <input type="checkbox" checked={show[k]} onChange={() => setShow({ ...show, [k]: !show[k] })} />{t[k]}
              </label>
            ))}
            <label className="iris-card flex items-center gap-1 px-2 py-1.5">{t.autoRefresh}:
              <select value={refreshSec} onChange={(e) => setRefreshSec(Number(e.target.value))} className="bg-transparent">
                <option value={0}>{t.off}</option><option value={60}>1m</option><option value={300}>5m</option><option value={900}>15m</option>
              </select>
            </label>
          </div>
          {err && <p className="mt-2 rounded-lg border border-red-500/50 bg-red-950/50 p-2 text-xs text-red-300">{err}</p>}

          {result && (
            <div className="iris-card mt-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-2 py-1 text-xs font-bold ${RISK_COLOR[result.risk.status]}`}>{result.risk.status} · {result.risk.score}/100</span>
                <span className="text-xs text-slate-400">Zon: {result.zone} · {result.label}</span>
              </div>
              <p className="mt-2 text-xs text-slate-300">{result.risk.methodology}</p>
              <div className="mt-2 grid gap-1">
                {result.risk.factors.map((f: any) => (
                  <div key={f.name} className="flex justify-between gap-2 text-xs"><span>{f.name} — <span className="text-slate-400">{f.note}</span></span><b>{f.value}/10</b></div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-slate-600/40 p-2">
                  <h4 className="text-xs font-bold text-cyan-200">{t.wxNow}{result.weather?.live ? "" : ` (${t.down})`}</h4>
                  {result.weather?.live ? (
                    <p className="mt-1 text-xs text-slate-300">
                      {result.weather.current?.temperature_2m ?? "?"}°C · {lang === "ms" ? "angin" : "wind"} {result.weather.current?.wind_speed_10m ?? "?"} km/j · {lang === "ms" ? "kebarangkalian hujan" : "rain prob."} {result.weather.precipProbMax ?? 0}% (model — {lang === "ms" ? "bukan amaran rasmi" : "not official"})
                    </p>
                  ) : <p className="mt-1 text-xs text-slate-500">{t.advisoriesNote}</p>}
                </div>
                <div className="rounded-lg border border-slate-600/40 p-2">
                  <h4 className="text-xs font-bold text-amber-200">{t.quakeHist}: {result.quakes.live ? `${result.quakes.count} M4+` : t.down}</h4>
                  {timeline.length > 0 && (
                    <svg viewBox="0 0 300 60" className="mt-1 h-14 w-full" role="img" aria-label={t.quakeHist}>
                      {timeline.map((b: any, i: number) => (
                        <rect key={b.date} x={i * 10} y={b.maxMag ? 60 - (b.maxMag / maxMag) * 56 : 58} width="8"
                          height={b.maxMag ? (b.maxMag / maxMag) * 56 : 2} rx="1"
                          fill={b.maxMag && b.maxMag >= 6 ? "#f87171" : "#f59e0b"} opacity={b.count ? 1 : 0.25}>
                          <title>{`${b.date}: ${b.count} gempa, maks M${b.maxMag ?? "-"}`}</title>
                        </rect>
                      ))}
                    </svg>
                  )}
                </div>
              </div>

              <h3 className="mt-3 text-xs font-bold text-cyan-200">{t.evidence} ({result.risk.evidence.length})</h3>
              <ul className="mt-1 space-y-1">
                {result.risk.evidence.map((e: any, i: number) => (
                  <li key={i} className="text-xs text-slate-300">• {e.observation} — <a className="text-cyan-300 underline" href={e.sourceUrl} target="_blank" rel="noreferrer">{e.source}</a> <span className="text-slate-500">{e.timestamp}</span></li>
                ))}
                {result.risk.evidence.length === 0 && <li className="text-xs text-slate-500">INSUFFICIENT EVIDENCE — tiada dakwaan disahkan.</li>}
              </ul>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div><h4 className="text-xs font-bold text-amber-200">{t.limitations}</h4><ul className="text-xs text-slate-400">{result.risk.limitations.map((l: string, i: number) => <li key={i}>• {l}</li>)}</ul></div>
                <div><h4 className="text-xs font-bold text-cyan-200">{t.actions}</h4><ul className="text-xs text-slate-300">{result.risk.followUp.map((l: string, i: number) => <li key={i}>• {l}</li>)}</ul></div>
              </div>
              {result.advisories?.floodProne?.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-400/30 p-2">
                  <h4 className="text-xs font-bold text-amber-200">{t.floodRef}{stateSel ? ` — ${stateSel}` : ""}</h4>
                  <ul className="mt-1 text-xs text-slate-300">{result.advisories.floodProne.map((f: any, i: number) => <li key={i}>• <b>{f.district}</b> ({f.river}) — {f.note}</li>)}</ul>
                  <p className="mt-1 text-[11px] text-slate-500">{t.advisoriesNote}</p>
                </div>
              )}
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {[{ i: <Ship size={14} />, h: "Maritim", f: result.agents?.[1] }, { i: <Plane size={14} />, h: "Penerbangan", f: result.agents?.[2] }, { i: <CloudRain size={14} />, h: "Bencana", f: result.agents?.[3] }].map((c: any, ix: number) => (
                  <div key={ix} className="rounded-lg border border-slate-600/40 p-2 text-xs"><b className="flex items-center gap-1 text-cyan-200">{c.i}{c.h}</b><p className="mt-1 text-slate-300">{c.f?.summary}</p></div>
                ))}
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {[{ i: <Building2 size={14} />, f: result.agents?.[4] }, { i: <Landmark size={14} />, f: result.agents?.[5] }, { i: <Satellite size={14} />, f: result.agents?.[6] }].map((c: any, ix: number) => (
                  <div key={ix} className="rounded-lg border border-slate-600/40 p-2 text-xs"><b className="text-cyan-200">{c.f?.agent}</b><p className="mt-1 text-slate-300">{c.f?.summary}</p></div>
                ))}
              </div>
            </div>
          )}

          {sitrep && (
            <div className="iris-card mt-3 bg-white p-4 text-black print:border-none" id="sitrep">
              <h2 className="text-sm font-bold">{sitrep.title}</h2>
              <p className="text-xs">ID: {sitrep.reportId} · {sitrep.timestampMYT} · {sitrep.location} ({sitrep.coords.join(", ")}) · {sitrep.assetCategory}</p>
              <p className="mt-2 text-xs"><b>Ringkasan:</b> {sitrep.execSummary}</p>
              <p className="mt-1 text-xs"><b>Pemerhatian disahkan:</b></p>
              <ul className="text-xs">{sitrep.observations.map((o: string, i: number) => <li key={i}>• {o}</li>)}</ul>
              <p className="mt-1 text-xs"><b>Keyakinan:</b> {sitrep.confidence} · <b>{t.nextReview}:</b> {sitrep.nextReview}</p>
              <p className="mt-1 text-xs"><b>Konteks kawal selia:</b> {sitrep.regulatory}</p>
              <p className="mt-1 text-xs"><b>Sumber:</b> {sitrep.citations.map((c: any) => `${c.name} (${c.url})`).join("; ")}</p>
              <div className="no-print mt-2 flex gap-2">
                <button onClick={() => { const blob = new Blob([JSON.stringify(sitrep, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${sitrep.reportId}.json`; a.click(); }} className="rounded bg-black px-3 py-1 text-xs text-white">{t.exportJson}</button>
                <button onClick={() => window.print()} className="rounded border px-3 py-1 text-xs">{t.exportPdf}</button>
              </div>
            </div>
          )}
        </div>

        <aside className="no-print space-y-3">
          <div className="iris-card p-3">
            <h3 className="text-xs font-bold text-cyan-200">{t.sources}</h3>
            <div className="mt-2 space-y-1">
              {(health?.sources ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-slate-200 underline">{s.name}</a>
                  <span className={s.lastOk ? "text-emerald-300" : "text-red-300"}>{s.lastOk ? t.live : t.down}</span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-slate-500">{t.portals}: METMalaysia · InfoBanjir · NADMA · CAAM · Jabatan Laut · JUPEM · JKDM/MITI (pautan portal — data model dilabel MODEL).</p>
              {(ref?.portals ?? []).map((p: any) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="mr-2 text-[11px] text-cyan-300 underline">{p.name}</a>)}
            </div>
          </div>
          <div className="iris-card p-3">
            <h3 className="flex items-center justify-between text-xs font-bold text-cyan-200">{t.audit}
              {audit.length > 0 && <button onClick={() => { const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "iris-audit.json"; a.click(); }} className="text-[11px] font-normal text-cyan-300 underline">JSON</button>}
            </h3>
            <div className="mt-1 max-h-48 space-y-1 overflow-auto">
              {audit.map((a: any, i: number) => <p key={i} className="text-[11px] text-slate-400">{a.at} · <b>{a.kind}</b> · {a.detail}</p>)}
              {audit.length === 0 && <p className="text-[11px] text-slate-500">Jalankan analisis untuk menjana log.</p>}
            </div>
          </div>
          <div className="iris-card p-3 text-[11px] text-slate-400">
            <b className="text-slate-200">Malaysia-only:</b> koordinat luar bbox ditolak (403). Zon ditandakan: darat / perairan-wilayah / zee / tuntutan-bertindih (label telus). Tiada rekaan risikan ketenteraan/terperingkat. Tiada pengelasan keselamatan rasmi.
          </div>
        </aside>
      </div>
      <span className="hidden">{tick}</span>
    </div>
  );
}
