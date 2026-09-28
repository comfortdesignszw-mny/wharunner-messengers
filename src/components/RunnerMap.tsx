import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Messenger } from '../types';

interface RunnerMapProps {
  messengers: Messenger[];
  selectedMessengerId?: string | null;
  onSelectMessenger?: (messenger: Messenger) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  singleRadius?: { lat: number; lng: number; radiusKm: number; name?: string };
}

export const RunnerMap: React.FC<RunnerMapProps> = ({
  messengers,
  selectedMessengerId,
  onSelectMessenger,
  center = [-17.8292, 31.0522], // Default: Harare CBD
  zoom = 12,
  height = '420px',
  singleRadius,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView(center, zoom);

      // OpenStreetMap tiles (free, reliable, global with great coverage in Zimbabwe)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      layersRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Don't necessarily destroy if re-rendering, but cleanup on unmount
    };
  }, []);

  // Update center if props change
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Render markers and coverage radius circles
  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current) return;

    layersRef.current.clearLayers();

    // If single radius view (e.g. in Messenger Profile)
    if (singleRadius) {
      const circle = L.circle([singleRadius.lat, singleRadius.lng], {
        color: '#128C7E',
        fillColor: '#25D366',
        fillOpacity: 0.18,
        radius: singleRadius.radiusKm * 1000,
        weight: 2,
      }).addTo(layersRef.current);

      const markerHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white font-bold shadow-xl border-2 border-white text-sm transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition">
          🏃
        </div>
      `;
      const icon = L.divIcon({
        html: markerHtml,
        className: 'custom-runner-icon',
        iconSize: [40, 40],
      });

      L.marker([singleRadius.lat, singleRadius.lng], { icon })
        .bindPopup(`<b>${singleRadius.name || 'Operating Area'}</b><br/>Coverage: ${singleRadius.radiusKm} km radius`)
        .addTo(layersRef.current);

      mapInstanceRef.current.fitBounds(circle.getBounds(), { padding: [30, 30] });
      return;
    }

    // Multiple messengers
    const bounds = L.latLngBounds([]);

    messengers.forEach((m) => {
      const isSelected = selectedMessengerId === m.id;
      const latLng: [number, number] = [m.centre_lat, m.centre_lng];
      bounds.extend(latLng);

      // Area coverage circle
      L.circle(latLng, {
        color: isSelected ? '#F59E0B' : '#128C7E',
        fillColor: isSelected ? '#F59E0B' : '#25D366',
        fillOpacity: isSelected ? 0.25 : 0.12,
        radius: m.radius_km * 1000,
        weight: isSelected ? 3 : 1.5,
      }).addTo(layersRef.current!);

      // Transport icon mapping
      const iconEmoji =
        m.transport_mode === 'foot'
          ? '🏃'
          : m.transport_mode === 'bicycle'
          ? '🚲'
          : m.transport_mode === 'motorbike'
          ? '🛵'
          : m.transport_mode === 'car'
          ? '🚗'
          : '🚐';

      const customHtml = `
        <div class="cursor-pointer group flex flex-col items-center">
          <div class="relative flex items-center justify-center w-11 h-11 rounded-full ${
            isSelected
              ? 'bg-amber-500 ring-4 ring-amber-300 ring-offset-2'
              : 'bg-emerald-700 hover:bg-emerald-600'
          } text-white shadow-xl border-2 border-white transition transform group-hover:scale-110">
            <span class="text-lg">${iconEmoji}</span>
            <div class="absolute -bottom-1 -right-1 bg-white text-slate-900 text-[10px] font-bold px-1 rounded-full border border-slate-200 shadow-xs">
              ★${m.rating_avg.toFixed(1)}
            </div>
          </div>
          <div class="mt-1 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md shadow-md border border-slate-200 text-[11px] font-bold text-slate-800 whitespace-nowrap">
            ${m.name.split(' ')[0]}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: customHtml,
        className: 'custom-messenger-marker',
        iconSize: [44, 60],
        iconAnchor: [22, 30],
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(layersRef.current!);

      marker.on('click', () => {
        if (onSelectMessenger) {
          onSelectMessenger(m);
        }
      });

      marker.bindPopup(`
        <div class="p-1 text-slate-800">
          <div class="font-bold text-sm">${m.name}</div>
          <div class="text-xs text-slate-500">${m.area_name} (${m.radius_km} km radius)</div>
          <div class="text-xs text-emerald-700 font-semibold mt-1">
            ${m.transport_mode.toUpperCase()} &bull; ${m.errands_completed} runs &bull; ★${m.rating_avg}
          </div>
        </div>
      `);
    });

    if (messengers.length > 0 && mapInstanceRef.current && !selectedMessengerId) {
      try {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (e) {
        // ignore bounds calculation if empty
      }
    }
  }, [messengers, selectedMessengerId, singleRadius]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} className="z-10" />
      <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 text-[11px] text-slate-600 font-medium">
        Zimbabwe OSM Map
      </div>
    </div>
  );
};
