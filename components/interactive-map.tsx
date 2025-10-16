'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';

interface Feature {
  type: string;
  id: number;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    nazev: string;
    popis?: string;
    region?: string;
    typ_muzea?: string;
    zamereni_muzea?: string;
    primarni_zatrideni?: string;
    nazev_okresu?: string;
    nazev_obce?: string;
    www?: string;
    telefon?: string;
    telefon_1?: string;
    mobil_1?: string;
    email_1?: string;
  };
  category: string;
  featureType?: 'transport' | 'place'; // Nový field z API
}

interface InteractiveMapProps {
  features: Feature[];
  filters: {
    transport: boolean;
    places: boolean;
  };
}

// Ikony pro různé typy
const createIcon = (isTransport: boolean) => {
  const emoji = isTransport ? '🚌' : '📍';
  const color = isTransport ? '#f59e0b' : '#3b82f6';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      " class="marker-pin">
        <span style="
          transform: rotate(45deg);
          font-size: 16px;
        ">${emoji}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// Component to fit bounds
function MapBounds({ features }: { features: Feature[] }) {
  const map = useMap();

  useEffect(() => {
    if (features.length > 0) {
      const bounds = L.latLngBounds(
        features.map(feature => {
          const [lon, lat] = feature.geometry.coordinates;
          return [lat, lon] as [number, number];
        })
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    } else {
      // Default view - Hradec Králové region
      map.setView([50.2091, 15.8327], 10);
    }
  }, [features, map]);

  return null;
}

export default function InteractiveMap({ features, filters }: InteractiveMapProps) {
  const defaultCenter: [number, number] = [50.2091, 15.8327];

  return (
    <div className="h-[calc(100vh-200px)] relative">
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds features={features} />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {features.map((feature, index) => {
            const [lon, lat] = feature.geometry.coordinates;
            const isTransport = feature.featureType === 'transport';
            
            return (
              <Marker
                key={`${feature.id}-${index}`}
                position={[lat, lon]}
                icon={createIcon(isTransport)}
              >
                <Popup maxWidth={320} className="custom-popup">
                  <div className="p-3">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-1">
                          {feature.properties.nazev}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{isTransport ? '🚌' : '📍'}</span>
                          <span className="text-sm text-gray-600">
                            {feature.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {(feature.properties.popis || 
                      feature.properties.zamereni_muzea || 
                      feature.properties.region ||
                      feature.properties.primarni_zatrideni) && (
                      <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                        {feature.properties.popis || 
                         feature.properties.zamereni_muzea || 
                         feature.properties.region ||
                         feature.properties.primarni_zatrideni}
                      </p>
                    )}

                    {/* Location Info */}
                    <div className="space-y-1 mb-3 text-sm">
                      {feature.properties.nazev_obce && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>🏘️</span>
                          <span>{feature.properties.nazev_obce}</span>
                        </div>
                      )}
                      {feature.properties.nazev_okresu && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span>📍</span>
                          <span>{feature.properties.nazev_okresu}</span>
                        </div>
                      )}
                    </div>

                    {/* Contact & Links */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                      {feature.properties.www && (
                        <a
                          href={feature.properties.www}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors"
                        >
                          <span>🌐</span>
                          <span>Web</span>
                        </a>
                      )}
                      {(feature.properties.telefon || 
                        feature.properties.telefon_1 || 
                        feature.properties.mobil_1) && (
                        <a
                          href={`tel:${feature.properties.telefon || feature.properties.telefon_1 || feature.properties.mobil_1}`}
                          className="inline-flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 transition-colors"
                        >
                          <span>📞</span>
                          <span>Volat</span>
                        </a>
                      )}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-gray-600 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors"
                      >
                        <span>🗺️</span>
                        <span>Navigace</span>
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="font-semibold text-sm mb-2 text-gray-900">Legenda</h4>
        <div className="space-y-2">
          {filters.transport && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">🚌</span>
              <span className="text-gray-700">Doprava</span>
            </div>
          )}
          {filters.places && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">📍</span>
              <span className="text-gray-700">Místa</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
