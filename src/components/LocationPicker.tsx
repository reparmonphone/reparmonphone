'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';

// Coordonnées de Sainte-Maxime, utilisées comme centrage par défaut de la carte
const DEFAULT_LAT = 43.3097;
const DEFAULT_LNG = 6.6393;

export default function LocationPicker({
  onChange,
  initialLat,
  initialLng,
}: {
  onChange: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [locating, setLocating] = useState(false);
  const [hasPlaced, setHasPlaced] = useState(!!(initialLat && initialLng));

  useEffect(() => {
    let cancelled = false;

    // Leaflet dépend de "window" — on ne peut l'importer que côté client, jamais au chargement serveur.
    import('leaflet').then((L) => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      const startLat = initialLat ?? DEFAULT_LAT;
      const startLng = initialLng ?? DEFAULT_LNG;

      const map = L.map(mapContainerRef.current).setView([startLat, startLng], initialLat ? 16 : 13);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Icône de pin personnalisée en SVG (évite le bug classique des icônes Leaflet par défaut
      // cassées lors du bundling webpack).
      const pinIcon = L.divIcon({
        className: '',
        html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="#0E7FDB"/>
          <circle cx="17" cy="17" r="7" fill="white"/>
        </svg>`,
        iconSize: [34, 44],
        iconAnchor: [17, 44],
      });

      function placeMarker(lat: number, lng: number) {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current!.getLatLng();
            onChange(pos.lat, pos.lng);
          });
        }
        setHasPlaced(true);
        onChange(lat, lng);
      }

      if (initialLat && initialLng) {
        placeMarker(initialLat, initialLng);
      }

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        placeMarker(e.latlng.lat, e.latlng.lng);
      });

      // Corrige un bug d'affichage fréquent de Leaflet quand la carte est montée dans un conteneur
      // initialement caché/redimensionné (taille mal calculée au premier rendu).
      setTimeout(() => map.invalidateSize(), 200);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
          mapRef.current.fire('click', { latlng: { lat: latitude, lng: longitude } });
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">
          Positionnez-vous sur la carte (cliquez ou faites glisser le repère)
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="text-xs text-brand font-medium hover:underline disabled:opacity-50"
        >
          {locating ? 'Localisation...' : '📍 Utiliser ma position actuelle'}
        </button>
      </div>
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-lg border border-gray-200 overflow-hidden"
      />
      {!hasPlaced && (
        <p className="text-xs text-gray-400 mt-1">
          Cliquez sur la carte à l&apos;endroit exact de l&apos;intervention — ça nous aide à vous trouver
          plus facilement.
        </p>
      )}
    </div>
  );
}
