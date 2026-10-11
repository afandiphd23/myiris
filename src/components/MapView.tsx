import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Map as MapIcon } from "lucide-react";
import MapViewVector from "./MapViewVector";

type ShowState = {
  maritime: boolean;
  aviation: boolean;
  disaster: boolean;
  geofence?: boolean;
  rangeRings?: boolean;
};

type Props = {
  lat: number;
  lon: number;
  quakes: any[];
  adsb: any[];
  locations?: any[];
  floodProne?: any[];
  corridorPoints?: { name: string; lat: number; lon: number }[];
  show: ShowState;
  onSelectPoint?: (lat: number, lon: number) => void;
};

const MY_BOUNDS = L.latLngBounds([[-3.2, 96.5], [10.5, 121.5]]);
const MY_FIT = L.latLngBounds([
  [0.6, 98.5],
  [7.6, 119.6],
]);

function dotIcon(color: string, size = 12, border = "#fff"): L.DivIcon {
  return L.divIcon({
    className: "iris-dot",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${border};box-shadow:0 0 8px rgba(0,0,0,.6)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function squareIcon(color: string, size = 11): L.DivIcon {
  return L.divIcon({
    className: "iris-square",
    html: `<span style="display:block;width:${size}px;height:${size}px;background:${color};border:2px solid #fbbf24;box-shadow:0 0 8px rgba(0,0,0,.6)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Label bandar kekal — teks putih berhalo gelap supaya terbaca atas sebarang basemap berwarna
function cityLabelIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: "iris-city",
    html: `<span style="font:600 11px/1.2 system-ui,sans-serif;color:#fff;text-shadow:-1px -1px 0 #0f172a,1px -1px 0 #0f172a,-1px 1px 0 #0f172a,1px 1px 0 #0f172a,0 0 6px rgba(0,0,0,.9);white-space:nowrap;">● ${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [-8, -8],
  });
}

const CITY_LABELS: { name: string; lat: number; lon: number }[] = [
  { name: "Kuala Lumpur", lat: 3.139, lon: 101.687 },
  { name: "George Town", lat: 5.414, lon: 100.329 },
  { name: "Johor Bahru", lat: 1.492, lon: 103.741 },
  { name: "Kota Bharu", lat: 6.133, lon: 102.238 },
  { name: "Kuantan", lat: 3.807, lon: 103.326 },
  { name: "Kuching", lat: 1.553, lon: 110.359 },
  { name: "Kota Kinabalu", lat: 5.978, lon: 116.075 },
];

// Skala warna magnitud gempa: kuning → jingga → merah → merah pekat
function quakeColor(mag: number): { color: string; fill: string } {
  if (mag >= 6.5) return { color: "#b91c1c", fill: "#dc2626" };
  if (mag >= 5.5) return { color: "#ef4444", fill: "#f87171" };
  if (mag >= 4.5) return { color: "#f59e0b", fill: "#fbbf24" };
  return { color: "#eab308", fill: "#fde047" };
}

// Warna ADS-B mengikut altitud: rendah (sian) → sederhana (biru) → tinggi (ungu)
function adsbColor(altM: number | null | undefined): string {
  if (altM != null && altM >= 10000) return "#a78bfa";
  if (altM != null && altM >= 5000) return "#38bdf8";
  return "#22d3ee";
}

export default function MapView({
  lat,
  lon,
  quakes,
  adsb,
  locations = [],
  floodProne = [],
  corridorPoints = [],
  show,
  onSelectPoint,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const targetRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectPoint);
  onSelectRef.current = onSelectPoint;

  const [mode, setMode] = useState<"live" | "offline">("live");
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [zoomLabel, setZoomLabel] = useState("5.0");
  const [follow, setFollow] = useState(true);
  const [tileError, setTileError] = useState(false);

  // Init map once
  useEffect(() => {
    if (mode !== "live") return;
    if (!containerRef.current || mapRef.current) return;

    // TANPA KUNCI: semua jubin bebas API-key (CARTO dialih keluar — watermark "API KEY REQUIRED").
    // Lalai = basemap BERWARNA supaya peta hidup: OSM Standard, dengan alternatif
    // Jalan Berwarna (Esri), Gelap (Esri Dark Gray), Satelit (Esri) dan Topografi (OTM).
    const esriAttr =
      "Tiles &copy; Esri &mdash; Esri, TomTom, Garmin, FAO, NOAA, USGS, &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
    const street = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: esriAttr }
    );
    const darkBase = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 16, maxZoom: 19, attribution: esriAttr }
    );
    const darkRef = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 16, maxZoom: 19, attribution: esriAttr }
    );
    const dark = L.layerGroup([darkBase, darkRef]);
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
      }
    );
    const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, SRTM | style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    });

    const map = L.map(containerRef.current, {
      center: [4.2, 110.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: MY_BOUNDS,
      maxBoundsViscosity: 0.7,
      zoomControl: false,
      worldCopyJump: true,
      layers: [osm],
    });

    osm.on("tileerror", () => setTileError(true));
    street.on("tileerror", () => setTileError(true));

    L.control
      .layers(
        {
          "Ceria (OSM)": osm,
          "Jalan Berwarna (Esri)": street,
          "Gelap (Esri)": dark,
          "Satelit (Esri)": satellite,
          "Topografi (OTM)": topo,
        },
        undefined,
        { position: "bottomright" }
      )
      .addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

    overlayRef.current = L.layerGroup().addTo(map);
    targetRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onSelectRef.current?.(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
    });
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setHover([Number(e.latlng.lat.toFixed(3)), Number(e.latlng.lng.toFixed(3))]);
    });
    map.on("zoomend", () => setZoomLabel(map.getZoom().toFixed(1)));
    setZoomLabel(map.getZoom().toFixed(1));
    map.fitBounds(MY_FIT);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      targetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Render overlays when data / toggles change
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    const targetLayer = targetRef.current;
    if (!map || !overlay || !targetLayer || mode !== "live") return;

    overlay.clearLayers();
    targetLayer.clearLayers();

    const ports =
      locations.filter((l) => l.kind === "pelabuhan" || l.kind === "maritim").length > 0
        ? locations.filter((l) => l.kind === "pelabuhan" || l.kind === "maritim")
        : [
            { lat: 2.999, lon: 101.392, name: "Port Klang", state: "Selangor" },
            { lat: 1.362, lon: 103.551, name: "Tanjung Pelepas", state: "Johor" },
            { lat: 5.414, lon: 100.347, name: "Pelabuhan Pulau Pinang", state: "Pulau Pinang" },
            { lat: 3.974, lon: 103.438, name: "Pelabuhan Kuantan", state: "Pahang" },
            { lat: 3.268, lon: 113.062, name: "Pelabuhan Bintulu", state: "Sarawak" },
            { lat: 5.985, lon: 116.051, name: "Pelabuhan Kota Kinabalu", state: "Sabah" },
          ];
    const airports = locations.filter((l) => l.kind === "lapangan-terbang");
    const quakeArray = Array.isArray(quakes) ? quakes : [];
    const adsbArray = Array.isArray(adsb) ? adsb : [];

    // Label bandar utama — sentiasa dipapar supaya peta berwarna bernyawa
    CITY_LABELS.forEach((c) => {
      L.marker([c.lat, c.lon], { icon: cityLabelIcon(c.name), interactive: false, keyboard: false }).addTo(overlay);
    });

    if (show.geofence) {
      // Kod warna zon: Semenanjung = biru langit, Sabah/Sarawak = hijau zamrud,
      // tuntutan bertindih = ambar, Singapura = merah (luar geofence)
      const boxes: { b: L.LatLngBoundsExpression; color: string; fill: number; dash?: string; name: string }[] = [
        { b: [[1.0, 99.35], [7.65, 104.7]], color: "#38bdf8", fill: 0.07, dash: "5 4", name: "Geofence Semenanjung" },
        { b: [[0.85, 109.0], [7.4, 119.4]], color: "#10b981", fill: 0.07, dash: "5 4", name: "Geofence Sabah/Sarawak" },
        { b: [[5.5, 111.0], [7.4, 118.0]], color: "#f59e0b", fill: 0.1, dash: "3 4", name: "Zon Tuntutan Bertindih" },
        { b: [[1.0, 103.6], [1.55, 104.15]], color: "#ef4444", fill: 0.16, name: "Singapura (Luar Geofence)" },
      ];
      boxes.forEach((g) => {
        L.rectangle(g.b, {
          color: g.color,
          weight: 1.5,
          dashArray: g.dash,
          fillColor: g.color,
          fillOpacity: g.fill,
        })
          .bindTooltip(g.name, { sticky: true, direction: "top" })
          .addTo(overlay);
      });
    }

    if (corridorPoints.length > 1) {
      const line = corridorPoints.map((p) => [p.lat, p.lon] as [number, number]);
      // Kilauan sian di bawah garis koridor supaya menonjol atas basemap berwarna
      L.polyline(line, { color: "#22d3ee", weight: 8, opacity: 0.22 }).addTo(overlay);
      L.polyline(line, { color: "#0e7490", weight: 4, opacity: 0.9 }).addTo(overlay);
      L.polyline(line, { color: "#a5f3fc", weight: 2, dashArray: "6 4", opacity: 0.95 }).addTo(overlay);
      corridorPoints.forEach((p) => {
        L.marker([p.lat, p.lon], { icon: dotIcon("#0891b2", 12, "#ecfeff"), title: `Koridor: ${p.name}` })
          .bindPopup(`<b>Koridor: ${p.name}</b><br/><span>${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E</span>`)
          .addTo(overlay);
      });
    }

    if (show.disaster) {
      quakeArray.slice(0, 25).forEach((q: any, idx: number) => {
        const [qlon, qlat] = q.coords ?? [0, 0];
        if (!qlat || !qlon) return;
        const mag = q.mag ?? 4;
        const qc = quakeColor(mag);
        L.circleMarker([qlat, qlon], {
          radius: Math.max(5, 2 + mag * 1.6),
          color: qc.color,
          weight: 2,
          fillColor: qc.fill,
          fillOpacity: 0.7,
        })
          .bindPopup(
            `<b>USGS M${q.mag ?? "?"} — ${q.place ?? "gempa"}</b><br/><span>${qlat.toFixed(2)}°N, ${qlon.toFixed(2)}°E · ${q.time ? String(q.time).slice(0, 16) : ""}</span>`
          )
          .addTo(overlay);
        void idx;
      });
      (floodProne ?? []).forEach((f: any, idx: number) => {
        if (!f.lat || !f.lon) return;
        L.marker([f.lat, f.lon], { icon: squareIcon("#92400e"), title: `Banjir: ${f.district}` })
          .bindPopup(`<b>Lembangan Banjir: ${f.district} (${f.river ?? ""})</b><br/><span>${f.state ?? ""} · ${f.note ?? ""}</span>`)
          .addTo(overlay);
        void idx;
      });
    }

    if (show.maritime) {
      ports.forEach((p: any) => {
        if (p.lat == null || p.lon == null) return;
        L.marker([p.lat, p.lon], { icon: dotIcon("#059669", 13, "#ecfdf5"), title: p.name })
          .bindTooltip(`⚓ ${p.name}`, { direction: "top", offset: [0, -8] })
          .bindPopup(
            `<b>Pelabuhan/Maritim: ${p.name}</b><br/><span>${p.state ?? "Malaysia"} (${Number(p.lat).toFixed(3)}°N, ${Number(p.lon).toFixed(3)}°E)</span>`
          )
          .addTo(overlay);
      });
    }

    if (show.aviation) {
      airports.forEach((ap: any) => {
        if (ap.lat == null || ap.lon == null) return;
        L.marker([ap.lat, ap.lon], { icon: dotIcon("#7c3aed", 12, "#ede9fe"), title: ap.name })
          .bindTooltip(`✈ ${ap.name}`, { direction: "top", offset: [0, -8] })
          .bindPopup(
            `<b>Lapangan Terbang: ${ap.name}</b><br/><span>${ap.state ?? ""} (${Number(ap.lat).toFixed(3)}°N, ${Number(ap.lon).toFixed(3)}°E)</span>`
          )
          .addTo(overlay);
      });
      adsbArray.slice(0, 100).forEach((s: any) => {
        if (!s.lat || !s.lon) return;
        const ac = adsbColor(s.altM);
        L.circleMarker([s.lat, s.lon], {
          radius: 4,
          color: "#0f172a",
          weight: 1,
          fillColor: ac,
          fillOpacity: 0.95,
        })
          .bindTooltip(`ADS-B: ${s.callsign || s.icao} (${s.altM ?? "?"} m)`, { direction: "top", offset: [0, -4] })
          .bindPopup(
            `<b>ADS-B: ${s.callsign || s.icao}</b><br/><span>Alt: ${s.altM ?? "?"} m · Halaju: ${s.vel ? Math.round(s.vel * 3.6) + " km/j" : "?"}</span>`
          )
          .addTo(overlay);
      });
    }

    // Active target + range rings (always on top) — jingga terang supaya menonjol atas basemap berwarna
    if (show.rangeRings) {
      [25000, 50000, 100000].forEach((rM) => {
        L.circle([lat, lon], {
          radius: rM,
          color: "#f97316",
          weight: 1.5,
          dashArray: "4 3",
          opacity: 0.65,
          fill: false,
        }).addTo(targetLayer);
      });
    }
    L.marker([lat, lon], {
      icon: dotIcon("#ea580c", 17, "#fff7ed"),
      title: "Sasaran aktif",
      zIndexOffset: 1000,
    })
      .bindPopup(`<b>Sasaran: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E</b>`)
      .addTo(targetLayer);
    L.circleMarker([lat, lon], { radius: 3.5, color: "#7c2d12", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(
      targetLayer
    );
  }, [mode, lat, lon, quakes, adsb, locations, floodProne, corridorPoints, show]);

  // Follow active target on analyze / preset select
  const prevTarget = useRef(`${lat},${lon}`);
  useEffect(() => {
    const key = `${lat},${lon}`;
    if (prevTarget.current === key) return;
    prevTarget.current = key;
    if (follow && mode === "live" && mapRef.current) {
      mapRef.current.flyTo([lat, lon], Math.max(mapRef.current.getZoom(), 7), { duration: 0.8 });
    }
  }, [lat, lon, follow, mode]);

  if (mode === "offline") {
    return (
      <div className="relative">
        <div className="no-print absolute top-3 right-3 z-[1100] flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/90 p-1">
          <button
            type="button"
            onClick={() => setMode("live")}
            className="flex items-center gap-1.5 rounded bg-sky-500 px-2.5 py-1 text-xs font-semibold text-slate-950"
          >
            <MapIcon size={13} /> Peta Live
          </button>
        </div>
        <MapViewVector
          lat={lat}
          lon={lon}
          quakes={quakes}
          adsb={adsb}
          locations={locations}
          floodProne={floodProne}
          corridorPoints={corridorPoints}
          show={show}
          onSelectPoint={onSelectPoint}
        />
      </div>
    );
  }

  return (
    <div className="relative select-none overflow-hidden rounded-lg border border-slate-800 bg-[#07101e]">
      <div ref={containerRef} className="h-[460px] w-full md:h-[520px]" role="application" aria-label="Peta Leaflet Malaysia" />

      <div className="no-print absolute top-3 left-3 z-[1000] flex items-center gap-2 rounded border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200">
        <span className="font-semibold text-sky-400">Peta Live Leaflet</span>
        {hover ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              Kursor: {hover[0].toFixed(3)}°N, {hover[1].toFixed(3)}°E
            </span>
          </>
        ) : (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-400">
              Sasaran: {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
            </span>
          </>
        )}
      </div>

      <div className="no-print absolute top-3 right-3 z-[1000] flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/90 p-1">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title="Zum Masuk"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title="Zum Keluar"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.flyTo([lat, lon], 8, { duration: 0.8 })}
          className="rounded p-1.5 text-sky-400 hover:bg-slate-800 hover:text-sky-300"
          title="Zum ke Sasaran Aktif"
        >
          <Crosshair size={14} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.fitBounds(MY_FIT)}
          className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title="Reset Paparan Malaysia"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={() => setMode("offline")}
          className="rounded px-2 py-1.5 text-[11px] text-slate-400 underline hover:text-white"
          title="Tukar ke mod vektor offline (tanpa jubin)"
        >
          Vektor Offline
        </button>
      </div>

      {tileError && (
        <div className="no-print absolute top-14 right-3 z-[1000] max-w-[260px] rounded border border-amber-500/50 bg-amber-950/90 px-3 py-2 text-[11px] text-amber-200">
          Jubin peta gagal dimuat (rangkaian/offline). Tukar ke{" "}
          <button type="button" onClick={() => setMode("offline")} className="font-semibold underline hover:text-white">
            Vektor Offline
          </button>
          .
        </div>
      )}

      <div className="no-print absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800/90 bg-slate-950/90 px-3 py-1.5 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-emerald-300">● Pelabuhan</span>
          <span aria-hidden="true">·</span>
          <span className="text-violet-300">● Lapangan Terbang</span>
          <span aria-hidden="true">·</span>
          <span className="text-sky-300">● ADS-B (sian→ungu ikut altitud)</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300">● Gempa (kuning→merah ikut magnitud)</span>
          <span aria-hidden="true">·</span>
          <span className="text-orange-300">◎ Sasaran + gelang 25/50/100km</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-slate-300">
            <input type="checkbox" checked={follow} onChange={() => setFollow((f) => !f)} className="accent-sky-400" />
            Ikut sasaran
          </label>
          <span className="font-mono tabular-nums text-slate-400">Zum: {zoomLabel}x</span>
        </div>
      </div>
    </div>
  );
}
