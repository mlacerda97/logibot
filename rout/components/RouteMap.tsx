"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

type EntregaMapa = {
  id: string;
  ordem_entrega: number | null;
  lat: number | string | null;
  lng: number | string | null;
  cliente_nome?: string | null;
};

type LatLng = [number, number];

const BASE_COORD: LatLng = [-23.0116, -46.8125];
const OSRM_ROUTE_BASE = process.env.NEXT_PUBLIC_OSRM_ROUTE_BASE || "http://127.0.0.1:5001/route/v1/driving";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, points]);

  return null;
}

const markerIcon = (label: string, isBase = false) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width: ${isBase ? 26 : 24}px;
      height: ${isBase ? 26 : 24}px;
      border-radius: 9999px;
      background: ${isBase ? "#111827" : "#2563eb"};
      color: white;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      box-shadow: 0 6px 12px rgba(0,0,0,0.2);
      font-size: 11px;
    ">${label}</div>`,
    iconSize: isBase ? [26, 26] : [24, 24],
    iconAnchor: isBase ? [13, 13] : [12, 12]
  });

export default function RouteMap({ entregas }: { entregas: EntregaMapa[] }) {
  const [routeLine, setRouteLine] = useState<LatLng[]>([]);
  const [erroRota, setErroRota] = useState<string | null>(null);

  const pontosOrdenados = useMemo(() => {
    const comCoordenada = entregas
      .map((e) => {
        const lat = toNumber(e.lat);
        const lng = toNumber(e.lng);
        if (lat == null || lng == null) return null;
        return { ...e, lat, lng };
      })
      .filter((e): e is (EntregaMapa & { lat: number; lng: number }) => Boolean(e))
      .sort((a, b) => (a.ordem_entrega ?? 9999) - (b.ordem_entrega ?? 9999));

    return comCoordenada;
  }, [entregas]);

  const fallbackLine = useMemo<LatLng[]>(() => {
    const rota: LatLng[] = [BASE_COORD];
    pontosOrdenados.forEach((ponto) => rota.push([ponto.lat, ponto.lng]));
    if (pontosOrdenados.length > 0) rota.push(BASE_COORD);
    return rota;
  }, [pontosOrdenados]);

  useEffect(() => {
    let ignore = false;

    const carregarRota = async () => {
      if (pontosOrdenados.length === 0) {
        setRouteLine([]);
        setErroRota("Sem coordenadas para montar o mapa.");
        return;
      }

      try {
        setErroRota(null);
        const coords = [
          `${BASE_COORD[1]},${BASE_COORD[0]}`,
          ...pontosOrdenados.map((p) => `${p.lng},${p.lat}`),
          `${BASE_COORD[1]},${BASE_COORD[0]}`
        ].join(";");

        const url = `${OSRM_ROUTE_BASE}/${coords}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`OSRM retornou ${resp.status}`);
        const data = await resp.json();
        if (data?.code !== "Ok" || !data?.routes?.[0]?.geometry?.coordinates) {
          throw new Error(data?.message || "Rota indisponivel");
        }

        const line: LatLng[] = data.routes[0].geometry.coordinates.map((item: [number, number]) => [item[1], item[0]]);
        if (!ignore) setRouteLine(line);
      } catch {
        if (!ignore) {
          setRouteLine(fallbackLine);
          setErroRota("Rota detalhada indisponivel no momento. Exibindo linha aproximada.");
        }
      }
    };

    carregarRota();
    return () => {
      ignore = true;
    };
  }, [pontosOrdenados, fallbackLine]);

  const pontosParaMapa = routeLine.length > 0 ? routeLine : fallbackLine;

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mapa da Rota</p>
        <p className="text-xs font-bold text-gray-700">Base {" > "} Sequencia {" > "} Base</p>
        {erroRota && <p className="text-[10px] font-semibold text-amber-600 mt-1">{erroRota}</p>}
      </div>

      <div className="h-[380px] w-full">
        <MapContainer center={BASE_COORD} zoom={8} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={pontosParaMapa.length > 0 ? pontosParaMapa : [BASE_COORD]} />

          <Marker position={BASE_COORD} icon={markerIcon("B", true)}>
            <Tooltip direction="top" offset={[0, -8]} permanent>
              Base (E4Log)
            </Tooltip>
          </Marker>

          {pontosOrdenados.map((ponto, idx) => (
            <Marker key={ponto.id} position={[ponto.lat, ponto.lng]} icon={markerIcon(String(idx + 1))}>
              <Tooltip direction="top" offset={[0, -8]}>
                {idx + 1} - {ponto.cliente_nome || "Entrega"}
              </Tooltip>
            </Marker>
          ))}

          {pontosParaMapa.length > 1 && (
            <Polyline positions={pontosParaMapa} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
