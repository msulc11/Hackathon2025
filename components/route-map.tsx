'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Destination {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  coordinates: [number, number];
  website?: string;
  phone?: string;
  image: string;
}

interface RouteMapProps {
  userLocation: [number, number];
  destinations: Destination[];
}

interface RouteSegment {
  points: [number, number][];
  distance: number;
  duration: number;
  instructions: string[];
}

// Ikona pro uživatelovu polohu
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
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Ikona pro destinaci
const createDestinationIcon = (number: number) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 16px;
          font-weight: bold;
          color: white;
        ">${number}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

// Komponenta pro auto-fit bounds
function MapBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  
  useEffect(() => {
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, map]);
  
  return null;
}

export default function RouteMap({ userLocation, destinations }: RouteMapProps) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateRoute();
  }, [userLocation, destinations]);

  const calculateRoute = async () => {
    try {
      // Vytvoř seznam všech bodů (start + destinace)
      const allPoints = [
        userLocation,
        ...destinations.map(d => {
          const [lon, lat] = d.coordinates;
          return [lat, lon] as [number, number];
        })
      ];

      // Optimalizuj pořadí destinací (nearest neighbor algorithm)
      const optimizedOrder = optimizeRoute(allPoints);
      
      // Získej trasu z OSRM (OpenStreetMap Routing Machine)
      const coordinates = optimizedOrder.map(point => `${point[1]},${point[0]}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`
      );
      
      if (!response.ok) {
        throw new Error('Chyba při získávání trasy');
      }

      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const routeData = data.routes[0];
        
        // Převeď koordináty z [lon, lat] na [lat, lon]
        const routePoints = routeData.geometry.coordinates.map((coord: number[]) => 
          [coord[1], coord[0]] as [number, number]
        );
        
        setRoute(routePoints);
        setTotalDistance(routeData.distance / 1000); // převeď na km
        setTotalDuration(routeData.duration / 60); // převeď na minuty
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Chyba při plánování trasy:', error);
      // Fallback: přímé čáry mezi body
      const fallbackRoute = [
        userLocation,
        ...destinations.map(d => {
          const [lon, lat] = d.coordinates;
          return [lat, lon] as [number, number];
        })
      ];
      setRoute(fallbackRoute);
      setLoading(false);
    }
  };

  // Jednoduchá optimalizace trasy (nearest neighbor)
  const optimizeRoute = (points: [number, number][]): [number, number][] => {
    if (points.length <= 2) return points;
    
    const result: [number, number][] = [points[0]]; // začni u uživatele
    const remaining = points.slice(1);
    
    while (remaining.length > 0) {
      const current = result[result.length - 1];
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      remaining.forEach((point, index) => {
        const distance = calculateDistance(current[0], current[1], point[0], point[1]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      
      result.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }
    
    return result;
  };

  // Haversine formula pro vzdálenost
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Vypočítej bounds pro všechny body
  const bounds = L.latLngBounds([
    userLocation,
    ...destinations.map(d => {
      const [lon, lat] = d.coordinates;
      return [lat, lon] as [number, number];
    })
  ]);

  return (
    <div className="h-full relative">
      <MapContainer
        center={userLocation}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds bounds={bounds} />

        {/* Trasa */}
        {route.length > 0 && (
          <Polyline
            positions={route}
            color="#3b82f6"
            weight={4}
            opacity={0.7}
          />
        )}

        {/* Uživatelova poloha */}
        <Marker position={userLocation} icon={userLocationIcon}>
          <Popup>
            <div className="p-2 text-center">
              <p className="font-semibold">📍 Vaše poloha</p>
              <p className="text-xs text-gray-600 mt-1">
                Start cesty
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Destinace */}
        {destinations.map((dest, index) => {
          const [lon, lat] = dest.coordinates;
          return (
            <Marker
              key={dest.id}
              position={[lat, lon]}
              icon={createDestinationIcon(index + 1)}
            >
              <Popup maxWidth={320}>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{index + 1}</span>
                    <div>
                      <h3 className="font-bold text-lg">{dest.name}</h3>
                      <p className="text-xs text-gray-600">{dest.category}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                    {dest.description}
                  </p>
                  
                  <div className="flex gap-2">
                    {dest.website && (
                      <a
                        href={dest.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-500 text-white px-3 py-1 rounded-md"
                      >
                        🌐 Web
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-green-500 text-white px-3 py-1 rounded-md"
                    >
                      🗺️ Navigovat
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Info box */}
      {!loading && totalDistance > 0 && (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <span>🚗</span>
            <span>Informace o cestě</span>
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Celková vzdálenost:</span>
              <span className="font-semibold">{totalDistance.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Odhadovaný čas:</span>
              <span className="font-semibold">{Math.round(totalDuration)} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Počet zastávek:</span>
              <span className="font-semibold">{destinations.length}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 Trasa je optimalizována podle nejkratší vzdálenosti
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Plánuji trasu...</span>
          </div>
        </div>
      )}
    </div>
  );
}
