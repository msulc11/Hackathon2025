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
  transportMode?: 'car' | 'bus';
  onClearRoute?: () => void;
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

// Ikona pro autobusovou zastávku
const busStopIcon = L.divIcon({
  className: 'bus-stop-marker',
  html: `
    <div style="
      background: #3b82f6;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">🚌</div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24]
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

export default function RouteMap({ userLocation, destinations, transportMode = 'car', onClearRoute }: RouteMapProps) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transitDetails, setTransitDetails] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any>(null);
  const [allBusStops, setAllBusStops] = useState<any[]>([]);

  useEffect(() => {
    calculateRoute();
  }, [userLocation, destinations, transportMode]);

  // Načti všechny autobusové zastávky pro zobrazení na mapě
  useEffect(() => {
    if (transportMode === 'bus') {
      fetch('/api/map-data')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.busStops) {
            // Zobraz pouze zastávky v oblasti zájmu (v blízkosti trasy)
            if (destinations.length > 0 && route.length > 0) {
              const relevantStops = data.busStops.filter((stop: any) => {
                const [lon, lat] = stop.geometry.coordinates;
                // Zkontroluj, jestli je zastávka do 5km od některého bodu na trase
                return route.some(point => {
                  const dist = calculateDistance(point[0], point[1], lat, lon);
                  return dist < 5;
                });
              });
              setAllBusStops(relevantStops.slice(0, 50)); // Max 50 zastávek
            } else {
              setAllBusStops([]);
            }
          }
        })
        .catch(err => console.error('Chyba při načítání zastávek:', err));
    } else {
      setAllBusStops([]);
    }
  }, [transportMode, destinations, route]);

  const calculateRoute = async () => {
    setLoading(true);
    setTransitDetails([]);
    setBusStops(null);
    
    try {
      if (destinations.length === 0) {
        setLoading(false);
        return;
      }

      // Optimalizuj pořadí destinací
      const allPoints = [
        userLocation,
        ...destinations.map(d => {
          const [lon, lat] = d.coordinates;
          return [lat, lon] as [number, number];
        })
      ];
      const optimizedOrder = optimizeRoute(allPoints);
      
      // Použij nové API pro plánování trasy
      const mode = transportMode === 'bus' ? 'transit' : 'driving';
      
      // Rozděl na segmenty a naplánuj každý zvlášť
      const allRoutePoints: [number, number][] = [];
      let totalDist = 0;
      let totalTime = 0;
      const allTransitDetails: any[] = [];
      
      for (let i = 0; i < optimizedOrder.length - 1; i++) {
        const origin = optimizedOrder[i];
        const destination = optimizedOrder[i + 1];
        
        const response = await fetch('/api/route-planning-idos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin,
            destination: [destination[1], destination[0]],
            mode: transportMode === 'bus' ? 'bus' : 'car',
            destinations: destinations
          })
        });
        
        if (!response.ok) {
          throw new Error('API call failed');
        }
        
        const data = await response.json();
        
        if (data.success) {
          allRoutePoints.push(...data.route);
          totalDist += data.distance;
          totalTime += data.duration;
          
          if (data.transitDetails) {
            allTransitDetails.push(...data.transitDetails);
          }
          
          if (data.busStops && i === 0) {
            setBusStops(data.busStops);
          }
        }
      }
      
      setRoute(allRoutePoints);
      setTotalDistance(totalDist);
      setTotalDuration(totalTime);
      setTransitDetails(allTransitDetails);
      setLoading(false);
      
    } catch (error) {
      console.error('Chyba při plánování trasy:', error);
      
      // Fallback: přímé čáry
      const fallbackRoute = [
        userLocation,
        ...destinations.map(d => {
          const [lon, lat] = d.coordinates;
          return [lat, lon] as [number, number];
        })
      ];
      
      let totalDist = 0;
      for (let i = 0; i < fallbackRoute.length - 1; i++) {
        totalDist += calculateDistance(
          fallbackRoute[i][0], fallbackRoute[i][1],
          fallbackRoute[i + 1][0], fallbackRoute[i + 1][1]
        );
      }
      
      setRoute(fallbackRoute);
      setTotalDistance(totalDist);
      setTotalDuration((totalDist / (transportMode === 'bus' ? 30 : 60)) * 60);
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
            color={transportMode === 'bus' ? '#3b82f6' : '#8b5cf6'}
            weight={4}
            opacity={0.7}
          />
        )}

        {/* Autobusové zastávky - zobraz pouze pokud je vybraný bus mode */}
        {transportMode === 'bus' && allBusStops.map((stop, index) => {
          const [lon, lat] = stop.geometry.coordinates;
          return (
            <Marker
              key={`bus-stop-${index}`}
              position={[lat, lon]}
              icon={busStopIcon}
            >
              <Popup>
                <div className="p-2">
                  <p className="font-semibold text-blue-700">🚌 {stop.properties.nazev || stop.properties.name || 'Zastávka'}</p>
                  <p className="text-xs text-gray-600 mt-1">Autobusová zastávka</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

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
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span>{transportMode === 'car' ? '🚗' : '🚌'}</span>
              <span>Informace o cestě</span>
            </h4>
            {onClearRoute && (
              <button
                onClick={onClearRoute}
                className="text-red-500 hover:text-red-700 text-xs font-semibold"
                title="Vymazat trasu"
              >
                ✕ Vymazat
              </button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Typ dopravy:</span>
              <span className="font-semibold">{transportMode === 'car' ? 'Auto' : 'Autobus'}</span>
            </div>
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
          
          {/* Transit Details */}
          {transportMode === 'bus' && transitDetails.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <h5 className="font-semibold text-sm mb-2 text-blue-700">🚌 Informace o spojení:</h5>
              <div className="space-y-3">
                {transitDetails.map((detail, index) => (
                  <div key={index} className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3">
                    {detail.departure && (
                      <div className="font-semibold text-blue-800 mb-2 text-sm">
                        {detail.departure} → {detail.arrival}
                      </div>
                    )}
                    {detail.walkToStop && (
                      <div className="text-gray-600 mb-1">
                        🚶 Cesta k zastávce: {detail.walkToStop} km
                      </div>
                    )}
                    {detail.busDistance && (
                      <div className="text-blue-700 font-semibold mb-1">
                        � Vzdálenost autobusem: {detail.busDistance} km
                      </div>
                    )}
                    {detail.walkFromStop && (
                      <div className="text-gray-600 mb-2">
                        🚶 Cesta ze zastávky: {detail.walkFromStop} km
                      </div>
                    )}
                    {detail.idosUrl && (
                      <a 
                        href={detail.idosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                      >
                        📅 Zobrazit jízdní řády na IDOS
                      </a>
                    )}
                    {detail.note && (
                      <div className="text-blue-600 text-xs mt-2 italic">
                        💡 {detail.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {busStops && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <h5 className="font-semibold text-sm mb-2 text-blue-700">🚏 Použité zastávky:</h5>
              <div className="text-xs space-y-2 bg-blue-50 rounded-lg p-2">
                <div>
                  <span className="font-semibold text-blue-800">Výchozí:</span>
                  <br />
                  <span className="text-gray-700">{busStops.origin?.name}</span>
                  <span className="text-gray-500"> ({busStops.origin?.distance.toFixed(2)} km od vaší polohy)</span>
                </div>
                <div>
                  <span className="font-semibold text-blue-800">Cílová:</span>
                  <br />
                  <span className="text-gray-700">{busStops.destination?.name}</span>
                  <span className="text-gray-500"> ({busStops.destination?.distance.toFixed(2)} km od cíle)</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 {transportMode === 'car' 
                ? 'Trasa je optimalizována podle nejkratší vzdálenosti' 
                : 'Pro přesné jízdní řády klikněte na "Export do Google Maps"'}
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
