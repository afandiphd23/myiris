import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from "lucide-react";

type MapTheme = "dark" | "hydro" | "blueprint";

// Unjuran Equirectangular khusus rantau Malaysia (Lat: -1° hingga 9°U, Lon: 98° hingga 121°T)
// Menggunakan nisbah kosinus pada latitud tengah Malaysia (~4°U) supaya jarak darat/laut tidak herot.
const LON_MIN = 98.0;
const LON_MAX = 121.0;
const LAT_MIN = -0.5;
const LAT_MAX = 8.8;
const VIEW_W = 1150;
const VIEW_H = 465;

function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VIEW_W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VIEW_H;
  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

function unproject(x: number, y: number): [number, number] {
  const lon = LON_MIN + (x / VIEW_W) * (LON_MAX - LON_MIN);
  const lat = LAT_MAX - (y / VIEW_H) * (LAT_MAX - LAT_MIN);
  return [Number(lat.toFixed(4)), Number(lon.toFixed(4))];
}

function coordsToPath(pts: [number, number][], close = true): string {
  if (pts.length === 0) return "";
  const mapped = pts.map(([la, lo]) => project(la, lo));
  const d = mapped.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return close ? `${d} Z` : d;
}

// Poligon geografi berketepatan tinggi bagi Semenanjung Malaysia, Sarawak, Sabah, Pulau Pinang, Langkawi & Labuan
const PENINSULA_OUTLINE: [number, number][] = [
  [6.7, 100.18], [6.44, 100.13], [6.15, 100.32], [5.85, 100.36], [5.55, 100.35],
  [5.12, 100.4], [4.75, 100.56], [4.24, 100.61], [3.98, 100.78], [3.62, 101.02],
  [3.3, 101.25], [3.0, 101.38], [2.8, 101.42], [2.52, 101.79], [2.2, 102.24],
  [1.84, 102.92], [1.48, 103.39], [1.33, 103.55], [1.45, 103.75], [1.36, 104.15],
  [1.42, 104.28], [2.05, 104.05], [2.65, 103.82], [3.48, 103.45], [3.81, 103.35],
  [4.25, 103.46], [4.78, 103.44], [5.33, 103.14], [5.65, 102.78], [5.86, 102.52],
  [6.22, 102.22], [6.2, 102.02], [5.82, 101.85], [5.74, 101.55], [5.92, 101.18],
  [6.42, 100.95], [6.52, 100.45], [6.7, 100.18],
];

const LANGKAWI_OUTLINE: [number, number][] = [
  [6.46, 99.65], [6.43, 99.91], [6.27, 99.85], [6.28, 99.68],
];

const PENANG_ISLAND_OUTLINE: [number, number][] = [
  [5.48, 100.18], [5.44, 100.34], [5.26, 100.29], [5.28, 100.18],
];

const SARAWAK_OUTLINE: [number, number][] = [
  [1.8, 109.64], [1.62, 110.05], [1.68, 110.48], [1.55, 110.85], [1.95, 111.15],
  [2.45, 111.3], [2.8, 111.85], [3.18, 112.95], [3.32, 113.08], [3.85, 113.55],
  [4.38, 113.98], [4.58, 114.08], [4.45, 114.62], [4.25, 114.85], [4.75, 115.05],
  [4.96, 115.42], [4.3, 115.68], [3.65, 115.65], [3.05, 115.15], [2.48, 114.92],
  [1.9, 114.62], [1.45, 113.75], [1.3, 112.45], [1.05, 111.55], [0.92, 110.45],
  [1.22, 109.95], [1.52, 109.62], [1.8, 109.64],
];

const SABAH_OUTLINE: [number, number][] = [
  [4.96, 115.42], [5.38, 115.58], [5.68, 115.85], [5.98, 116.05], [6.45, 116.45],
  [6.92, 116.75], [7.03, 117.08], [6.65, 117.58], [6.15, 117.95], [5.84, 118.12],
  [5.48, 118.95], [5.22, 119.26], [4.95, 118.75], [4.62, 118.55], [4.25, 117.88],
  [4.18, 117.52], [4.32, 116.42], [4.32, 115.68], [4.96, 115.42],
];

const LABUAN_OUTLINE: [number, number][] = [
  [5.38, 115.18], [5.36, 115.29], [5.24, 115.26], [5.25, 115.16],
];

// Garis sempadan negeri utama (dalaman) untuk orientasi visual
const STATE_LINES: [number, number][][] = [
  // Perlis/Kedah/Perak/Selangor/NS/Melaka/Johor/Pahang/Terengganu/Kelantan
  [[6.42, 100.13], [6.42, 100.5]],
  [[5.12, 100.4], [5.5, 101.1], [5.92, 101.18]],
  [[4.75, 101.15], [4.65, 102.95], [5.65, 102.78]],
  [[3.75, 100.85], [3.85, 101.7], [4.65, 101.4]],
  [[2.65, 101.7], [2.95, 102.3], [3.85, 101.7]],
  [[2.4, 101.95], [2.48, 102.55], [2.1, 102.5]],
  [[1.84, 102.92], [2.55, 102.75], [2.65, 103.82]],
  [[4.1, 103.1], [4.78, 103.0], [5.65, 102.78]],
];

// Konteks daratan jiran (kelabu gelap, dilabel luar geofence Malaysia)
const NEIGHBOR_SUMATRA: [number, number][] = [
  [5.6, 98.0], [4.0, 98.9], [2.2, 100.2], [1.0, 102.2], [-0.5, 103.5], [-0.5, 98.0],
];
const NEIGHBOR_KALIMANTAN: [number, number][] = [
  [1.22, 109.95], [0.92, 110.45], [1.05, 111.55], [1.3, 112.45], [1.45, 113.75],
  [1.9, 114.62], [2.48, 114.92], [3.05, 115.15], [3.65, 115.65], [4.3, 115.68],
  [4.18, 117.52], [3.2, 117.8], [1.2, 118.8], [-0.5, 117.5], [-0.5, 109.2], [0.8, 109.0],
];
const NEIGHBOR_THAI: [number, number][] = [
  [6.7, 100.18], [6.52, 100.45], [6.42, 100.95], [5.92, 101.18], [5.74, 101.55],
  [5.82, 101.85], [6.2, 102.02], [6.22, 102.22], [7.8, 100.4], [8.8, 99.8], [8.8, 98.2], [6.7, 99.6],
];

const THEME_COLORS: Record<
  MapTheme,
  {
    sea: string;
    grid: string;
    neighborFill: string;
    neighborStroke: string;
    myFill: string;
    myStroke: string;
    stateLine: string;
  }
> = {
  dark: {
    sea: "#07101e",
    grid: "rgba(56, 189, 248, 0.08)",
    neighborFill: "#0d1626",
    neighborStroke: "#1e293b",
    myFill: "#13233b",
    myStroke: "#38bdf8",
    stateLine: "rgba(148, 163, 184, 0.25)",
  },
  hydro: {
    sea: "#061b2e",
    grid: "rgba(34, 211, 238, 0.10)",
    neighborFill: "#0f1e2e",
    neighborStroke: "#1e3a5f",
    myFill: "#14333b",
    myStroke: "#2dd4bf",
    stateLine: "rgba(45, 212, 191, 0.25)",
  },
  blueprint: {
    sea: "#0a192f",
    grid: "rgba(125, 211, 252, 0.14)",
    neighborFill: "#112240",
    neighborStroke: "#233554",
    myFill: "#1d3557",
    myStroke: "#7dd3fc",
    stateLine: "rgba(125, 211, 252, 0.3)",
  },
};

export default function MapViewVector({
  lat,
  lon,
  quakes,
  adsb,
  locations = [],
  floodProne = [],
  corridorPoints = [],
  show,
  onSelectPoint,
}: {
  lat: number;
  lon: number;
  quakes: any[];
  adsb: any[];
  locations?: any[];
  floodProne?: any[];
  corridorPoints?: { name: string; lat: number; lon: number }[];
  show: {
    maritime: boolean;
    aviation: boolean;
    disaster: boolean;
    geofence?: boolean;
    rangeRings?: boolean;
  };
  onSelectPoint?: (lat: number, lon: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ cx: number; cy: number; px: number; py: number; moved: boolean }>({
    cx: 0,
    cy: 0,
    px: 0,
    py: 0,
    moved: false,
  });
  const [hoverCoord, setHoverCoord] = useState<[number, number] | null>(null);
  const [selectedPopup, setSelectedPopup] = useState<{ title: string; sub: string; x: number; y: number } | null>(null);

  const tc = THEME_COLORS[theme];
  const [tx, ty] = project(lat, lon);

  // Convert screen mouse event to SVG world coordinates
  function clientToSvgWorld(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * VIEW_W;
    const relY = ((clientY - rect.top) / rect.height) * VIEW_H;
    const worldX = (relX - VIEW_W / 2 - pan.x) / zoom + VIEW_W / 2;
    const worldY = (relY - VIEW_H / 2 - pan.y) / zoom + VIEW_H / 2;
    return [worldX, worldY];
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    setDragging(true);
    dragStartRef.current = {
      cx: e.clientX,
      cy: e.clientY,
      px: pan.x,
      py: pan.y,
      moved: false,
    };
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const w = clientToSvgWorld(e.clientX, e.clientY);
    if (w) {
      const [cLat, cLon] = unproject(w[0], w[1]);
      if (cLat >= LAT_MIN && cLat <= LAT_MAX && cLon >= LON_MIN && cLon <= LON_MAX) {
        setHoverCoord([cLat, cLon]);
      }
    }
    if (!dragging) return;
    const dx = e.clientX - dragStartRef.current.cx;
    const dy = e.clientY - dragStartRef.current.cy;
    if (Math.hypot(dx, dy) > 4) dragStartRef.current.moved = true;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_W / rect.width;
    const scaleY = VIEW_H / rect.height;
    setPan({
      x: dragStartRef.current.px + dx * scaleX,
      y: dragStartRef.current.py + dy * scaleY,
    });
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragging) return;
    setDragging(false);
    if (!dragStartRef.current.moved) {
      const w = clientToSvgWorld(e.clientX, e.clientY);
      if (w && onSelectPoint) {
        const [cLat, cLon] = unproject(w[0], w[1]);
        onSelectPoint(cLat, cLon);
      }
    }
  }

  function focusOnTarget() {
    const [px, py] = project(lat, lon);
    const z = 2.4;
    setZoom(z);
    setPan({
      x: (VIEW_W / 2 - px) * z,
      y: (VIEW_H / 2 - py) * z,
    });
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedPopup(null);
  }

  // Geofence rectangles in SVG coordinates
  const [penX1, penY1] = project(7.65, 99.35);
  const [penX2, penY2] = project(1.0, 104.7);
  const [borX1, borY1] = project(7.4, 109.0);
  const [borX2, borY2] = project(0.85, 119.4);
  const [ovlX1, ovlY1] = project(7.4, 111.0);
  const [ovlX2, ovlY2] = project(5.5, 118.0);
  const [sgX1, sgY1] = project(1.55, 103.6);
  const [sgX2, sgY2] = project(1.0, 104.15);

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

  // 1 degree latitude ≈ 111 km → 50px in our projection
  const kmToSvgRadius = (km: number) => (km / 111) * (VIEW_H / (LAT_MAX - LAT_MIN));

  return (
    <div className="relative select-none overflow-hidden rounded-lg border border-slate-800 bg-[#07101e]">
      {/* Zero-API Vector SVG Map Viewport */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDragging(false)}
        className={`h-[460px] w-full md:h-[520px] ${dragging ? "cursor-grabbing" : "cursor-crosshair"}`}
        role="img"
        aria-label="Peta Vektor Geospatial Malaysia (Tanpa API)"
      >
        <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={tc.sea} />

        <g transform={`translate(${VIEW_W / 2 + pan.x}, ${VIEW_H / 2 + pan.y}) scale(${zoom}) translate(${-VIEW_W / 2}, ${-VIEW_H / 2})`}>
          {/* Graticule Lat/Lon Grid */}
          {Array.from({ length: 12 }, (_, i) => 99 + i * 2).map((lonLine) => {
            const [gx] = project(0, lonLine);
            return (
              <g key={`lon-${lonLine}`}>
                <line x1={gx} y1={0} x2={gx} y2={VIEW_H} stroke={tc.grid} strokeWidth={1 / zoom} />
                <text x={gx + 3} y={14} fill="#475569" fontSize={9 / zoom} fontFamily="monospace">
                  {lonLine}°E
                </text>
              </g>
            );
          })}
          {Array.from({ length: 9 }, (_, i) => i + 1).map((latLine) => {
            const [, gy] = project(latLine, LON_MIN);
            return (
              <g key={`lat-${latLine}`}>
                <line x1={0} y1={gy} x2={VIEW_W} y2={gy} stroke={tc.grid} strokeWidth={1 / zoom} />
                <text x={6} y={gy - 3} fill="#475569" fontSize={9 / zoom} fontFamily="monospace">
                  {latLine}°N
                </text>
              </g>
            );
          })}

          {/* Neighboring Non-Malaysian Landmasses (subdued for regional context) */}
          <path d={coordsToPath(NEIGHBOR_SUMATRA)} fill={tc.neighborFill} stroke={tc.neighborStroke} strokeWidth={1 / zoom} />
          <path d={coordsToPath(NEIGHBOR_KALIMANTAN)} fill={tc.neighborFill} stroke={tc.neighborStroke} strokeWidth={1 / zoom} />
          <path d={coordsToPath(NEIGHBOR_THAI)} fill={tc.neighborFill} stroke={tc.neighborStroke} strokeWidth={1 / zoom} />

          {/* Malaysia Landmasses: Peninsular, Langkawi, Penang, Sarawak, Sabah, Labuan */}
          <path d={coordsToPath(PENINSULA_OUTLINE)} fill={tc.myFill} stroke={tc.myStroke} strokeWidth={1.5 / zoom} />
          <path d={coordsToPath(LANGKAWI_OUTLINE)} fill={tc.myFill} stroke={tc.myStroke} strokeWidth={1.2 / zoom} />
          <path d={coordsToPath(PENANG_ISLAND_OUTLINE)} fill={tc.myFill} stroke={tc.myStroke} strokeWidth={1.2 / zoom} />
          <path d={coordsToPath(SARAWAK_OUTLINE)} fill={tc.myFill} stroke={tc.myStroke} strokeWidth={1.5 / zoom} />
          <path d={coordsToPath(SABAH_OUTLINE)} fill={tc.myFill} stroke={tc.myStroke} strokeWidth={1.5 / zoom} />
          <path d={coordsToPath(LABUAN_OUTLINE)} fill={tc.myFill} stroke={tc.myStroke} strokeWidth={1.2 / zoom} />

          {/* Internal State Lines */}
          {STATE_LINES.map((line, i) => (
            <path key={i} d={coordsToPath(line, false)} fill="none" stroke={tc.stateLine} strokeWidth={1 / zoom} strokeDasharray="3 2" />
          ))}

          {/* Waterbody & Territory Labels */}
          <text x={project(3.1, 99.8)[0]} y={project(3.1, 99.8)[1]} fill="#38bdf8" opacity={0.45} fontSize={10 / zoom} fontFamily="monospace">
            SELAT MELAKA
          </text>
          <text x={project(4.8, 106.2)[0]} y={project(4.8, 106.2)[1]} fill="#38bdf8" opacity={0.45} fontSize={11 / zoom} fontFamily="monospace">
            LAUT CHINA SELATAN (ZEE MALAYSIA)
          </text>
          <text x={project(6.4, 118.4)[0]} y={project(6.4, 118.4)[1]} fill="#38bdf8" opacity={0.45} fontSize={10 / zoom} fontFamily="monospace">
            LAUT SULU
          </text>
          <text x={project(3.9, 102.0)[0]} y={project(3.9, 102.0)[1]} fill="#94a3b8" opacity={0.55} fontSize={10 / zoom} fontWeight="bold">
            SEMENANJUNG
          </text>
          <text x={project(2.5, 113.2)[0]} y={project(2.5, 113.2)[1]} fill="#94a3b8" opacity={0.55} fontSize={10 / zoom} fontWeight="bold">
            SARAWAK
          </text>
          <text x={project(5.5, 116.8)[0]} y={project(5.5, 116.8)[1]} fill="#94a3b8" opacity={0.55} fontSize={10 / zoom} fontWeight="bold">
            SABAH
          </text>

          {/* Geofence Bounding Boxes */}
          {show.geofence && (
            <g>
              <rect
                x={penX1}
                y={penY1}
                width={penX2 - penX1}
                height={penY2 - penY1}
                fill="rgba(56, 189, 248, 0.02)"
                stroke="#38bdf8"
                strokeWidth={1 / zoom}
                strokeDasharray="5 4"
              />
              <rect
                x={borX1}
                y={borY1}
                width={borX2 - borX1}
                height={borY2 - borY1}
                fill="rgba(56, 189, 248, 0.02)"
                stroke="#38bdf8"
                strokeWidth={1 / zoom}
                strokeDasharray="5 4"
              />
              <rect
                x={ovlX1}
                y={ovlY1}
                width={ovlX2 - ovlX1}
                height={ovlY2 - ovlY1}
                fill="rgba(245, 158, 11, 0.04)"
                stroke="#f59e0b"
                strokeWidth={1 / zoom}
                strokeDasharray="3 4"
              />
              <rect
                x={sgX1}
                y={sgY1}
                width={sgX2 - sgX1}
                height={sgY2 - sgY1}
                fill="rgba(239, 68, 68, 0.14)"
                stroke="#ef4444"
                strokeWidth={1 / zoom}
              />
            </g>
          )}

          {/* Strategic Corridor Polyline */}
          {corridorPoints.length > 1 && (
            <g>
              <path
                d={coordsToPath(
                  corridorPoints.map((p) => [p.lat, p.lon]),
                  false
                )}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={2 / zoom}
                strokeDasharray="6 4"
              />
              {corridorPoints.map((p) => {
                const [cx, cy] = project(p.lat, p.lon);
                return (
                  <circle
                    key={p.name}
                    cx={cx}
                    cy={cy}
                    r={4.5 / zoom}
                    fill="#0891b2"
                    stroke="#22d3ee"
                    strokeWidth={1.5 / zoom}
                  >
                    <title>{`Koridor: ${p.name}`}</title>
                  </circle>
                );
              })}
            </g>
          )}

          {/* Disaster Layer: USGS Earthquakes + Flood Basins */}
          {show.disaster && (
            <g>
              {quakeArray.slice(0, 25).map((q: any, idx: number) => {
                const [qlon, qlat] = q.coords ?? [0, 0];
                if (!qlat || !qlon) return null;
                const [qx, qy] = project(qlat, qlon);
                const r = Math.max(4, 2 + (q.mag ?? 4) * 1.4) / zoom;
                const isStrong = (q.mag ?? 0) >= 5.5;
                return (
                  <circle
                    key={q.id ?? idx}
                    cx={qx}
                    cy={qy}
                    r={r}
                    fill={isStrong ? "rgba(220, 38, 38, 0.65)" : "rgba(217, 119, 6, 0.65)"}
                    stroke={isStrong ? "#ef4444" : "#f59e0b"}
                    strokeWidth={1.5 / zoom}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPopup({
                        title: `USGS M${q.mag ?? "?"} — ${q.place}`,
                        sub: `${qlat.toFixed(2)}°N, ${qlon.toFixed(2)}°E · ${q.time ? q.time.slice(0, 16) : ""}`,
                        x: qx,
                        y: qy,
                      });
                    }}
                  >
                    <title>{`USGS M${q.mag} — ${q.place}`}</title>
                  </circle>
                );
              })}

              {floodProne.map((f: any, idx: number) => {
                if (!f.lat || !f.lon) return null;
                const [fx, fy] = project(f.lat, f.lon);
                return (
                  <rect
                    key={`flood-${idx}`}
                    x={fx - 3.5 / zoom}
                    y={fy - 3.5 / zoom}
                    width={7 / zoom}
                    height={7 / zoom}
                    fill="#92400e"
                    stroke="#fbbf24"
                    strokeWidth={1.2 / zoom}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPopup({
                        title: `Lembangan Banjir: ${f.district} (${f.river})`,
                        sub: `${f.state} · ${f.note}`,
                        x: fx,
                        y: fy,
                      });
                      if (onSelectPoint) onSelectPoint(f.lat, f.lon);
                    }}
                  >
                    <title>{`Lembangan Banjir: ${f.district} (${f.river})`}</title>
                  </rect>
                );
              })}
            </g>
          )}

          {/* Maritime Layer: Strategic Ports */}
          {show.maritime &&
            ports.map((p: any) => {
              const [px, py] = project(p.lat, p.lon);
              return (
                <g
                  key={p.name}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPopup({
                      title: `Pelabuhan/Maritim: ${p.name}`,
                      sub: `${p.state ?? "Malaysia"} (${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E)`,
                      x: px,
                      y: py,
                    });
                    if (onSelectPoint) onSelectPoint(p.lat, p.lon);
                  }}
                >
                  <circle cx={px} cy={py} r={5 / zoom} fill="#065f46" stroke="#10b981" strokeWidth={1.5 / zoom}>
                    <title>{`${p.name} (${p.state ?? ""})`}</title>
                  </circle>
                  <text x={px + 7 / zoom} y={py + 3 / zoom} fill="#a7f3d0" fontSize={8.5 / zoom} fontFamily="sans-serif">
                    {p.name.replace("Pelabuhan ", "")}
                  </text>
                </g>
              );
            })}

          {/* Aviation Layer: Airports + Live ADS-B Aircraft */}
          {show.aviation && (
            <g>
              {airports.map((ap: any) => {
                const [ax, ay] = project(ap.lat, ap.lon);
                return (
                  <circle
                    key={ap.name}
                    cx={ax}
                    cy={ay}
                    r={4.2 / zoom}
                    fill="#4c1d95"
                    stroke="#a78bfa"
                    strokeWidth={1.4 / zoom}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPopup({
                        title: `Lapangan Terbang: ${ap.name}`,
                        sub: `${ap.state} (${ap.lat.toFixed(3)}°N, ${ap.lon.toFixed(3)}°E)`,
                        x: ax,
                        y: ay,
                      });
                      if (onSelectPoint) onSelectPoint(ap.lat, ap.lon);
                    }}
                  >
                    <title>{ap.name}</title>
                  </circle>
                );
              })}

              {adsbArray.slice(0, 100).map((s: any, idx: number) => {
                if (!s.lat || !s.lon) return null;
                const [sx, sy] = project(s.lat, s.lon);
                return (
                  <circle
                    key={s.icao ?? idx}
                    cx={sx}
                    cy={sy}
                    r={2.8 / zoom}
                    fill="#38bdf8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPopup({
                        title: `ADS-B: ${s.callsign || s.icao}`,
                        sub: `Alt: ${s.altM ?? "?"} m · Halaju: ${s.vel ? Math.round(s.vel * 3.6) + " km/j" : "?"}`,
                        x: sx,
                        y: sy,
                      });
                    }}
                  >
                    <title>{`ADS-B: ${s.callsign || s.icao} (${s.altM ?? "?"} m)`}</title>
                  </circle>
                );
              })}
            </g>
          )}

          {/* Range Rings around Active Target (25km, 50km, 100km) */}
          {show.rangeRings &&
            [25, 50, 100].map((rKm) => (
              <circle
                key={rKm}
                cx={tx}
                cy={ty}
                r={kmToSvgRadius(rKm)}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={0.45}
                strokeWidth={1 / zoom}
                strokeDasharray="3 3"
              />
            ))}

          {/* Active Target Crosshair & Marker */}
          <g>
            <line x1={tx - 14 / zoom} y1={ty} x2={tx + 14 / zoom} y2={ty} stroke="#38bdf8" strokeWidth={1.2 / zoom} />
            <line x1={tx} y1={ty - 14 / zoom} x2={tx} y2={ty + 14 / zoom} stroke="#38bdf8" strokeWidth={1.2 / zoom} />
            <circle cx={tx} cy={ty} r={7 / zoom} fill="rgba(2, 132, 199, 0.35)" stroke="#38bdf8" strokeWidth={2 / zoom} />
            <circle cx={tx} cy={ty} r={2.5 / zoom} fill="#ffffff" />
          </g>
        </g>
      </svg>

      {/* Top-Left Badge: 100% Native Zero-API Vector Engine */}
      <div className="no-print absolute top-3 left-3 flex items-center gap-2 rounded border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200">
        <span className="font-semibold text-sky-400">Peta Vektor Kendiri (Tanpa API)</span>
        {hoverCoord && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              Kursor: {hoverCoord[0].toFixed(3)}°N, {hoverCoord[1].toFixed(3)}°E
            </span>
          </>
        )}
      </div>

      {/* Top-Right Controls: Theme & Zoom */}
      <div className="no-print absolute top-3 right-3 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/90 p-1">
          {(
            [
              ["dark", "Gelap"],
              ["hydro", "Hidrografi"],
              ["blueprint", "Blueprint"],
            ] as [MapTheme, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTheme(k)}
              className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                theme === k ? "bg-sky-500 text-slate-950 font-semibold" : "text-slate-300 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded border border-slate-700/80 bg-slate-900/90 p-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(5, Number((z * 1.35).toFixed(2))))}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Zum Masuk"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Number((z / 1.35).toFixed(2))))}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Zum Keluar"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={focusOnTarget}
            className="rounded p-1.5 text-sky-400 hover:bg-slate-800 hover:text-sky-300"
            title="Zum ke Sasaran Aktif"
          >
            <Crosshair size={14} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Reset Paparan Malaysia"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Selected Marker Info Banner */}
      {selectedPopup && (
        <div className="no-print absolute bottom-12 left-3 flex items-center justify-between gap-4 rounded border border-sky-500/40 bg-slate-900/95 px-3.5 py-2 text-xs text-slate-100 shadow-lg">
          <div>
            <div className="font-semibold text-sky-300">{selectedPopup.title}</div>
            <div className="font-mono tabular-nums text-[11px] text-slate-300">{selectedPopup.sub}</div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPopup(null)}
            className="text-[11px] text-slate-400 underline hover:text-white"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Bottom Legend Bar */}
      <div className="no-print absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800/90 bg-slate-950/90 px-3 py-1.5 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono tabular-nums text-sky-300">
            Sasaran: {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-300">Pelabuhan (Bulatan Hijau)</span>
          <span aria-hidden="true">·</span>
          <span className="text-purple-300">Lapangan Terbang (Ungu)</span>
          <span aria-hidden="true">·</span>
          <span className="text-sky-300">Pesawat ADS-B (Titik Biru)</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300">Seismik/Banjir (Jingga)</span>
        </div>
        <span className="font-mono tabular-nums text-slate-400">Zum: {zoom.toFixed(1)}x</span>
      </div>
    </div>
  );
}
