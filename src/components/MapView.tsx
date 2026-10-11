import { useEffect, useRef } from "react";
import L from "leaflet";

export default function MapView({ lat, lon, quakes, adsb, show }: {
  lat: number; lon: number;
  quakes: any[]; adsb: any[];
  show: { maritime: boolean; aviation: boolean; disaster: boolean };
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const m = L.map(divRef.current).setView([4.2, 102.25], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 18,
    }).addTo(m);
    mapRef.current = m;
    layerRef.current = L.layerGroup().addTo(m);
  }, []);

  useEffect(() => {
    const m = mapRef.current, lg = layerRef.current;
    if (!m || !lg) return;
    lg.clearLayers();
    L.marker([lat, lon]).addTo(lg).bindPopup(`Fokus: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
    m.setView([lat, lon], 7);
    if (show.disaster) for (const q of quakes.slice(0, 20)) {
      const [qlon, qlat] = q.coords ?? [0, 0];
      if (!qlat || !qlon) continue;
      L.circleMarker([qlat, qlon], { radius: 3 + (q.mag ?? 4), color: "#f59e0b" })
        .addTo(lg).bindPopup(`M${q.mag} — ${q.place}`);
    }
    if (show.aviation) for (const s of adsb.slice(0, 60)) {
      if (!s.lat || !s.lon) continue;
      L.circleMarker([s.lat, s.lon], { radius: 3, color: "#22d3ee" })
        .addTo(lg).bindPopup(`${s.callsign || s.icao} · ${s.altM ?? "?"} m`);
    }
    if (show.maritime) {
      // Penanda pelabuhan utama Malaysia (statik, didokumenkan awam)
      const ports: [number, number, string][] = [
        [2.999, 101.392, "Port Klang"], [1.362, 103.551, "Tanjung Pelepas"],
        [5.414, 100.347, "Pulau Pinang"], [3.974, 103.438, "Kuantan"],
        [3.268, 113.062, "Bintulu"], [5.985, 116.051, "Kota Kinabalu"],
      ];
      for (const [a, o, n] of ports) L.marker([a, o], { opacity: 0.9 }).addTo(lg).bindPopup(n);
    }
  }, [lat, lon, quakes, adsb, show]);

  return <div ref={divRef} className="h-[52vh] w-full rounded-xl border border-cyan-400/20 md:h-[62vh]" />;
}
