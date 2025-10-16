'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const InteractiveMap = dynamic(() => import('@/components/interactive-map'), {
  ssr: false,
  loading: () => <div className="h-[calc(100vh-200px)] flex items-center justify-center">Načítání mapy...</div>
});

interface Feature {
  type: string;
  id: number;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: any;
  category: string;
  featureType?: 'transport' | 'place';
}

export default function MapaPage() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(15);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [filteredFeatures, setFilteredFeatures] = useState<Feature[]>([]);
  const [filters, setFilters] = useState({
    transport: true,
    places: true
  });
  const [stats, setStats] = useState({ transport: 0, places: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Požádat o polohu uživatele
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocationError(null);
        },
        (error) => {
          console.error('Chyba při získávání polohy:', error);
          setLocationError('Nepodařilo se získat vaši polohu. Zobrazuji všechna místa.');
          // Fallback na střed Královéhradeckého kraje
          setUserLocation([50.2091, 15.8327]);
        }
      );
    } else {
      setLocationError('Váš prohlížeč nepodporuje geolokaci.');
      setUserLocation([50.2091, 15.8327]);
    }
  }, []);

  // Načíst data z API
  useEffect(() => {
    fetch('/api/map-data')
      .then(res => res.json())
      .then(data => {
        setAllFeatures(data.features || []);
        setStats(data.stats || { transport: 0, places: 0, total: 0 });
        setLoading(false);
      })
      .catch(error => {
        console.error('Chyba při načítání dat:', error);
        setLoading(false);
      });
  }, []);

  // Vypočítat vzdálenost mezi dvěma body (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Poloměr Země v km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filtrovat místa podle polohy a filtru
  useEffect(() => {
    if (!userLocation || allFeatures.length === 0) {
      setFilteredFeatures([]);
      return;
    }

    const filtered = allFeatures.filter(feature => {
      // Filtr podle typu
      if (feature.featureType === 'transport' && !filters.transport) return false;
      if (feature.featureType === 'place' && !filters.places) return false;

      // Filtr podle vzdálenosti
      const [lon, lat] = feature.geometry.coordinates;
      const distance = calculateDistance(userLocation[0], userLocation[1], lat, lon);
      return distance <= radius;
    });

    setFilteredFeatures(filtered);
  }, [userLocation, allFeatures, radius, filters]);

  const transportCount = filteredFeatures.filter(f => f.featureType === 'transport').length;
  const placesCount = filteredFeatures.filter(f => f.featureType === 'place').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Načítání dat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <a href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Plánio
              </a>
              <div className="hidden md:flex gap-6">
                <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Domů
                </a>
                <a href="/mapa" className="text-blue-600 font-semibold">
                  Mapa
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <div className="w-80 bg-white/80 backdrop-blur-md border-r border-gray-200 p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Mapa okolí
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Objevte místa a dopravu ve vašem okolí
          </p>

          {/* Poloha */}
          <Card className="p-4 mb-6 bg-white/50">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <span>📍</span>
              <span>Vaše poloha</span>
            </h3>
            {locationError ? (
              <p className="text-sm text-amber-600">{locationError}</p>
            ) : userLocation ? (
              <p className="text-sm text-gray-600">
                {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
              </p>
            ) : (
              <p className="text-sm text-gray-600">Získávání polohy...</p>
            )}
          </Card>

          {/* Rozsah */}
          <Card className="p-4 mb-6 bg-white/50">
            <Label htmlFor="radius" className="font-semibold mb-2 block">
              Rozsah vyhledávání
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="radius"
                type="number"
                min="1"
                max="100"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-600 whitespace-nowrap">km</span>
            </div>
            <Input
              type="range"
              min="1"
              max="100"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full mt-3"
            />
          </Card>

          {/* Filtry */}
          <Card className="p-4 mb-6 bg-white/50">
            <h3 className="font-semibold mb-3">Zobrazit</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="transport"
                  checked={filters.transport}
                  onCheckedChange={(checked) => 
                    setFilters(prev => ({ ...prev, transport: checked as boolean }))
                  }
                />
                <Label htmlFor="transport" className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xl">🚌</span>
                  <span>Doprava ({transportCount})</span>
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="places"
                  checked={filters.places}
                  onCheckedChange={(checked) => 
                    setFilters(prev => ({ ...prev, places: checked as boolean }))
                  }
                />
                <Label htmlFor="places" className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xl">📍</span>
                  <span>Místa ({placesCount})</span>
                </Label>
              </div>
            </div>
          </Card>

          {/* Statistiky */}
          <Card className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <h3 className="font-semibold mb-3">Nalezeno v okolí {radius} km</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <span>🚌</span>
                  <span>Doprava</span>
                </span>
                <span className="font-bold">{transportCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <span>📍</span>
                  <span>Místa</span>
                </span>
                <span className="font-bold">{placesCount}</span>
              </div>
              <div className="pt-2 border-t border-white/20">
                <div className="flex justify-between items-center font-bold">
                  <span>Celkem</span>
                  <span>{filteredFeatures.length}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Mapa */}
        <div className="flex-1">
          {userLocation && filteredFeatures.length > 0 ? (
            <InteractiveMap 
              features={filteredFeatures} 
              filters={filters}
              userLocation={userLocation}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              {userLocation ? 'Žádná místa v okolí' : 'Získávání polohy...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
