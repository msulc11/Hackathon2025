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
  featureType?: 'transport' | 'place';
  emoji?: string; // Přidáno emoji
}

interface InteractiveMapProps {
  features: Feature[];
  filters: {
    transport: boolean;
    places: boolean;
  };
  userLocation?: [number, number]; // Poloha uživatele
}

// Ikony pro různé typy - použije emoji z kategorie
const createIcon = (feature: Feature) => {
  const emoji = feature.emoji || (feature.featureType === 'transport' ? '🚌' : '📍');
  const color = feature.featureType === 'transport' ? '#f59e0b' : '#3b82f6';
  
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

export default function InteractiveMap({ features, filters, userLocation }: InteractiveMapProps) {
  const defaultCenter: [number, number] = userLocation || [50.2091, 15.8327];

  // Ikona pro polohu uživatele
  const userLocationIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="
        background: #ef4444;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 0 0 2px #ef4444, 0 4px 6px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return (
    <div className="h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds features={features} />

        {/* Poloha uživatele */}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>
              <div className="p-2 text-center">
                <p className="font-semibold">📍 Vaše poloha</p>
                <p className="text-xs text-gray-600 mt-1">
                  {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount();
            let size = 'small';
            let sizeClass = 'w-10 h-10 text-sm';
            
            if (count > 100) {
              size = 'large';
              sizeClass = 'w-16 h-16 text-lg';
            } else if (count > 10) {
              size = 'medium';
              sizeClass = 'w-12 h-12 text-base';
            }
            
            return L.divIcon({
              html: `
                <div class="flex items-center justify-center ${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold shadow-lg border-4 border-white">
                  ${count}
                </div>
              `,
              className: 'custom-cluster-icon',
              iconSize: L.point(40, 40, true)
            });
          }}
        >
          {features.map((feature, index) => {
            const [lon, lat] = feature.geometry.coordinates;
            
            return (
              <Marker
                key={`${feature.id}-${index}`}
                position={[lat, lon]}
                icon={createIcon(feature)}
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
                          className="inline-flex items-center gap-1 text-xs bg-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors"
                          style={{ color: 'white', textDecoration: 'none' }}
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
                          className="inline-flex items-center gap-1 text-xs bg-green-600 px-3 py-1.5 rounded-md hover:bg-green-700 active:bg-green-800 transition-colors"
                          style={{ color: 'white', textDecoration: 'none' }}
                        >
                          <span>📞</span>
                          <span>Volat</span>
                        </a>
                      )}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-cyan-600 px-3 py-1.5 rounded-md hover:bg-cyan-700 active:bg-cyan-800 transition-colors"
                        style={{ color: 'white', textDecoration: 'none' }}
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
    </div>
  );
}
