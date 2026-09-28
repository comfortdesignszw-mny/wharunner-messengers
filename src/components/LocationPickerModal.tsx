import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Check, X, Search, Globe2 } from 'lucide-react';
import { ZIM_MAJOR_CITIES, ZimCity } from '../utils/cities';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: string, lat: number, lng: number) => void;
  title: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
}


export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title,
  initialAddress = '',
  initialLat = -17.8292,
  initialLng = 31.0522,
}) => {
  const [address, setAddress] = useState(initialAddress);
  const [coords, setCoords] = useState<[number, number]>([initialLat, initialLng]);
  const [isLocating, setIsLocating] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (initialAddress) setAddress(initialAddress);
    if (initialLat && initialLng) setCoords([initialLat, initialLng]);
  }, [initialAddress, initialLat, initialLng, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
        }).setView(coords, 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const customPin = L.divIcon({
          html: `<div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-base">📍</div>`,
          className: 'pin-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const marker = L.marker(coords, { draggable: true, icon: customPin }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setCoords([pos.lat, pos.lng]);
          // Approximate reverse address if empty
          if (!address) {
            setAddress(`Pin at [${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}]`);
          }
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          setCoords([e.latlng.lat, e.latlng.lng]);
        });

        markerRef.current = marker;
        mapRef.current = map;
      } else {
        mapRef.current.invalidateSize();
        mapRef.current.setView(coords, 14);
        if (markerRef.current) {
          markerRef.current.setLatLng(coords);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCoords(newCoords);
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView(newCoords, 16);
          markerRef.current.setLatLng(newCoords);
        }
        if (!address) {
          setAddress('My Current GPS Location');
        }
      },
      (err) => {
        setIsLocating(false);
        alert('Could not retrieve current location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectCity = (city: ZimCity) => {
    setAddress(`${city.name} (${city.province})`);
    setCoords([city.lat, city.lng]);
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([city.lat, city.lng], 14);
      markerRef.current.setLatLng([city.lat, city.lng]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Address input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Specific Address or Landmark Description
            </label>
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. TM Pick n Pay Avondale or Stand 452 Unit L, Chitungwiza"
                className="w-full pl-3.5 pr-28 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'GPS...' : 'My GPS'}</span>
              </button>
            </div>
          </div>

          {/* Quick Major Cities & Towns Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Globe2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Jump to Major City or Town across Zimbabwe:</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-100">
              {ZIM_MAJOR_CITIES.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleSelectCity(city)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-semibold text-slate-700 transition"
                >
                  📍 {city.name}
                </button>
              ))}
            </div>
          </div>


          {/* Leaflet Map Pinpoint */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold">Drag pin or tap map to adjust location:</span>
              <span className="font-mono text-[11px]">
                {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
              </span>
            </div>
            <div className="h-56 w-full rounded-xl overflow-hidden border border-slate-300">
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!address.trim()) {
                alert('Please enter an address or choose a landmark.');
                return;
              }
              onSelect(address.trim(), coords[0], coords[1]);
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <Check className="w-4 h-4" />
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
