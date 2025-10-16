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
  onLocationChange?: (location: [number, number]) => void;
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
        background: linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%);
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 6px rgba(59, 130, 246, 0.4);
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

// Komponenta pro zachycení kliknutí na mapu
function MapClickHandler({ isEnabled, onLocationSet }: { isEnabled: boolean; onLocationSet: (location: [number, number]) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (!isEnabled) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
      onLocationSet([e.latlng.lat, e.latlng.lng]);
    };
    
    map.on('click', handleClick);
    map.getContainer().style.cursor = 'crosshair';
    
    return () => {
      map.off('click', handleClick);
      map.getContainer().style.cursor = '';
    };
  }, [isEnabled, map, onLocationSet]);
  
  return null;
}

export default function RouteMap({ userLocation, destinations, transportMode = 'car', onClearRoute, onLocationChange }: RouteMapProps) {
  const [route, setRoute] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transitDetails, setTransitDetails] = useState<any[]>([]);
  const [busStops, setBusStops] = useState<any>(null);
  const [allBusStops, setAllBusStops] = useState<any[]>([]);
  const [isSettingLocation, setIsSettingLocation] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      console.log('Plánuji trasu s lokací:', userLocation, 'Destinace:', destinations.length);
      calculateRoute();
    }
  }, [userLocation, destinations, transportMode, mounted]);

  // Načti všechny autobusové zastávky pro zobrazení na mapě
  useEffect(() => {
    if (!mounted) return;
    
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
  }, [destinations, route, mounted]);

  const calculateRoute = async () => {
    setLoading(true);
    setTransitDetails([]);
    setBusStops(null);
    
    try {
      if (destinations.length === 0) {
        setLoading(false);
        return;
      }

      // Začni od user location a pak projdi všechny destinace
      const allPoints = [
        userLocation,
        ...destinations.map(d => {
          const [lon, lat] = d.coordinates;
          return [lat, lon] as [number, number];
        })
      ];
      
      const optimizedOrder = optimizeRoute(allPoints);
      
      // Vždy použij bus/transit mód
      const mode = 'bus';
      
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
            mode: 'bus',
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

  // Vypočítej bounds pro všechny body (včetně user location)
  const bounds = L.latLngBounds([
    userLocation,
    ...destinations.map(d => {
      const [lon, lat] = d.coordinates;
      return [lat, lon] as [number, number];
    })
  ]);

  // Center mapy na user location
  const mapCenter = userLocation;

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Načítání mapy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative" suppressHydrationWarning>
      <MapContainer
        center={mapCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds bounds={bounds} />
        <MapClickHandler 
          isEnabled={isSettingLocation} 
          onLocationSet={(loc) => {
            setIsSettingLocation(false);
            if (onLocationChange) {
              onLocationChange(loc);
            }
          }} 
        />

        {/* Trasa */}
        {route.length > 0 && (
          <Polyline
            positions={route}
            color="#3b82f6"
            weight={4}
            opacity={0.8}
          />
        )}

        {/* Autobusové zastávky */}
        {allBusStops.map((stop, index) => {
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
              key={`${dest.id}-${index}`}
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

      {/* Info box - kompaktní verze */}
      {!loading && totalDistance > 0 && (
        <div 
          className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-[1000] w-80 max-h-[70vh] overflow-y-auto"
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            setIsScrolled(target.scrollTop > 0);
          }}
        >
          <div className={`flex items-center justify-between mb-2 sticky top-[-12px] bg-white pb-2 border-b border-blue-200 z-10 transition-all ${isScrolled ? 'pt-5' : 'pt-0'}`}>
            <h4 className="font-semibold flex items-center gap-2 text-sm text-blue-700">
              <span>🚌</span>
              <span>Trasa</span>
            </h4>
            <div className="flex gap-1">
              {onLocationChange && (
                <button
                  onClick={() => setIsSettingLocation(!isSettingLocation)}
                  className={`${isSettingLocation ? 'bg-blue-500 text-white' : 'text-blue-500 hover:bg-blue-50'} text-xs font-semibold px-2 py-1 rounded transition-colors`}
                  title="Nastavit polohu kliknutím na mapu"
                >
                  {isSettingLocation ? '✓ Hotovo' : '📍 Moje poloha'}
                </button>
              )}
              {onClearRoute && (
                <button
                  onClick={onClearRoute}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50"
                  title="Vymazat trasu"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {isSettingLocation && (
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              📍 Klikněte na mapu pro nastavení vaší polohy
            </div>
          )}
          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Start:</span>
              <span className="font-semibold text-blue-600">📍 Vaše poloha</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Doprava:</span>
              <span className="font-semibold text-blue-600">🚌 Autobus</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Vzdálenost:</span>
              <span className="font-semibold">{totalDistance.toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Čas:</span>
              <span className="font-semibold">{Math.round(totalDuration)} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Zastávky:</span>
              <span className="font-semibold">{destinations.length}</span>
            </div>
          </div>
          
          {/* Transit Details */}
          {transitDetails.length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <h5 className="font-semibold text-xs mb-2 text-blue-700">
                🚌 Spojení ({transitDetails.length})
              </h5>
              <div className="space-y-2">
                {transitDetails.map((detail, index) => (
                  <div key={index} className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                    <div className="font-bold text-blue-900 mb-1">
                      {index + 1}. {detail.departure} → {detail.arrival}
                    </div>
                    <div className="space-y-0.5 text-xs mb-2">
                      {detail.walkToStop && (
                        <div className="text-gray-600">
                          🚶 K zastávce: <strong>{detail.walkToStop} km</strong>
                        </div>
                      )}
                      {detail.busDistance && (
                        <div className="text-blue-700 font-semibold">
                          🚌 Autobusem: <strong>{detail.busDistance} km</strong>
                        </div>
                      )}
                      {detail.walkFromStop && (
                        <div className="text-gray-600">
                          🚶 Ze zastávky: <strong>{detail.walkFromStop} km</strong>
                        </div>
                      )}
                    </div>
                    {detail.idosUrl && (
                      <a 
                        href={detail.idosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded text-xs font-semibold transition-all w-full"
                      >
                        <span>📅</span>
                        <span>Jízdní řády</span>
                      </a>
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
              💡 Pro přesné jízdní řády klikněte na tlačítko "📅 Jízdní řády"
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
