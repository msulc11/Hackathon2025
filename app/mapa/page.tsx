'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

const InteractiveMap = dynamic(() => import('@/components/interactive-map'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center">Načítání mapy...</div>
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
  emoji?: string;
}

// Kategorie pro filtry
const CATEGORY_FILTERS = [
  { key: 'hrady', name: '🏰 Hrady', type: 'place' },
  { key: 'zahrady', name: '🌳 Botanické zahrady', type: 'place' },
  { key: 'muzea', name: '🖼️ Muzea a galerie', type: 'place' },
  { key: 'divadla', name: '🎭 Divadla', type: 'place' },
  { key: 'pivovary', name: '🍺 Pivovary', type: 'place' },
  { key: 'rozhledny', name: '🗼 Rozhledny', type: 'place' },
  { key: 'koupani', name: '🏊 Letní koupání', type: 'place' },
  { key: 'pamatky', name: '🏛️ Památky', type: 'place' },
  { key: 'bus', name: '🚌 Autobusové zastávky', type: 'transport' },
];

export default function MapaPage() {
  const [userLocation, setUserLocation] = useState<[number, number]>([50.2091, 15.8327]);
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [radius, setRadius] = useState(50);
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [filteredFeatures, setFilteredFeatures] = useState<Feature[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<Record<string, boolean>>({
    hrady: true,
    zahrady: true,
    muzea: true,
    divadla: true,
    pivovary: true,
    rozhledny: true,
    koupani: true,
    pamatky: true,
    bus: false, // Výchozí vypnuto kvůli velkému množství
  });
  const [stats, setStats] = useState({ transport: 0, places: 0, total: 0, categories: {} });
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Získej polohu uživatele
  useEffect(() => {
    if (!mounted) return;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          // Tiše použij výchozí polohu
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  }, [mounted]);

  // Načíst data z API
  useEffect(() => {
    if (!mounted) return;
    
    fetch('/api/map-data')
      .then(res => res.json())
      .then(data => {
        console.log('Načteno míst:', data.features?.length);
        setAllFeatures(data.features || []);
        setStats(data.stats || { transport: 0, places: 0, total: 0, categories: {} });
        setLoading(false);
      })
      .catch(error => {
        console.error('Chyba při načítání dat:', error);
        setLoading(false);
      });
  }, [mounted]);

  // Geocoding - převod adresy na souřadnice
  const handleAddressSearch = async () => {
    if (!address.trim()) return;
    
    setAddressLoading(true);
    try {
      // Použij Nominatim (OpenStreetMap) geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=cz`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setUserLocation([lat, lon]);
        console.log('Adresa nalezena:', lat, lon);
      } else {
        alert('Adresa nenalezena. Zkuste jiný formát (např. "Hradec Králové" nebo "Praha").');
      }
    } catch (error) {
      console.error('Chyba při hledání adresy:', error);
      alert('Chyba při hledání adresy.');
    } finally {
      setAddressLoading(false);
    }
  };

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
      // Kontrola validity dat
      if (!feature.geometry || !feature.geometry.coordinates) {
        return false;
      }

      // Filtr podle kategorie
      const categoryName = feature.category.toLowerCase();
      if (categoryName.includes('hrad') && !categoryFilters.hrady) return false;
      if (categoryName.includes('zahrad') && !categoryFilters.zahrady) return false;
      if (categoryName.includes('muzea') && !categoryFilters.muzea) return false;
      if (categoryName.includes('divadl') && !categoryFilters.divadla) return false;
      if (categoryName.includes('pivovar') && !categoryFilters.pivovary) return false;
      if (categoryName.includes('rozhled') && !categoryFilters.rozhledny) return false;
      if (categoryName.includes('koupán') && !categoryFilters.koupani) return false;
      if (categoryName.includes('památk') && !categoryFilters.pamatky) return false;
      if (categoryName.includes('autobus') && !categoryFilters.bus) return false;

      // Filtr podle vzdálenosti
      const [lon, lat] = feature.geometry.coordinates;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        return false;
      }
      
      const distance = calculateDistance(userLocation[0], userLocation[1], lat, lon);
      return distance <= radius;
    });

    setFilteredFeatures(filtered);
  }, [userLocation, allFeatures, radius, categoryFilters]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Načítání dat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md border-b border-blue-200 z-50 shadow-sm">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold text-blue-600 flex items-center gap-2">
              <Image src="/logo.png" alt="ZabrouzdAi" width={32} height={32} />
              <span>ZabrouzdAi</span>
            </Link>
            <div className="hidden md:flex gap-8 absolute left-1/2 transform -translate-x-1/2">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <span>Objevuj</span>
              </Link>
              <Link href="/mapa" className="text-blue-600 font-semibold flex items-center gap-2">
                <span className="text-xl">🗺️</span>
                <span>Mapa okolí</span>
              </Link>
              <Link href="/brouzdal" className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-2">
                <Image src="/brouzdal.png" alt="Brouzdal" width={100} height={40} className="object-contain" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden pt-16">{/* pt-16 for fixed navbar */}
        {/* Sidebar - 1/3 width */}
        <div className="w-full md:w-1/3 bg-white/80 backdrop-blur-md border-r border-blue-200 overflow-y-auto">
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Mapa okolí
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              Objevte zajímavá místa v Královéhradeckém kraji
            </p>

            {/* Poloha */}
            <Card className="p-4 mb-4 bg-white/90 border-blue-200">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-700">
                <span>📍</span>
                <span>Vaše poloha</span>
              </h3>
              
              {/* Adresa */}
              <div className="mb-3">
                <Label htmlFor="address" className="text-sm mb-1 block">Zadejte adresu</Label>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    type="text"
                    placeholder="např. Hradec Králové"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                    className="flex-1 border-blue-300"
                  />
                  <Button 
                    onClick={handleAddressSearch}
                    disabled={addressLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {addressLoading ? '...' : '🔍'}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
              </p>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setUserLocation([position.coords.latitude, position.coords.longitude]);
                      }
                    );
                  }
                }}
                className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                🔄 Použít moji GPS polohu
              </Button>
            </Card>

            {/* Rozsah */}
            <Card className="p-4 mb-4 bg-white/90 border-blue-200">
              <Label htmlFor="radius" className="font-semibold mb-2 block text-blue-700">
                Rozsah vyhledávání
              </Label>
              <div className="flex items-center gap-3 mb-3">
                <Input
                  id="radius"
                  type="number"
                  min="1"
                  max="100"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="flex-1 border-blue-300"
                />
                <span className="text-sm text-gray-600 whitespace-nowrap font-semibold">km</span>
              </div>
              <Input
                type="range"
                min="1"
                max="100"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </Card>

            {/* Filtry kategorií */}
            <Card className="p-4 mb-4 bg-white/90 border-blue-200">
              <h3 className="font-semibold mb-3 text-blue-700">Zobrazit kategorie</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {CATEGORY_FILTERS.map((cat) => {
                  const count = filteredFeatures.filter(f => {
                    const name = f.category.toLowerCase();
                    if (cat.key === 'hrady') return name.includes('hrad');
                    if (cat.key === 'zahrady') return name.includes('zahrad');
                    if (cat.key === 'muzea') return name.includes('muzea');
                    if (cat.key === 'divadla') return name.includes('divadl');
                    if (cat.key === 'pivovary') return name.includes('pivovar');
                    if (cat.key === 'rozhledny') return name.includes('rozhled');
                    if (cat.key === 'koupani') return name.includes('koupán');
                    if (cat.key === 'pamatky') return name.includes('památk');
                    if (cat.key === 'bus') return name.includes('autobus');
                    return false;
                  }).length;

                  return (
                    <div key={cat.key} className="flex items-center gap-3">
                      <Checkbox
                        id={cat.key}
                        checked={categoryFilters[cat.key]}
                        onCheckedChange={(checked) => 
                          setCategoryFilters(prev => ({ ...prev, [cat.key]: checked as boolean }))
                        }
                        className="border-blue-400 data-[state=checked]:bg-blue-600"
                      />
                      <Label htmlFor={cat.key} className="flex items-center gap-2 cursor-pointer text-sm flex-1">
                        <span>{cat.name}</span>
                        <span className="ml-auto text-gray-500 font-semibold">({count})</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Statistiky */}
            <Card className="p-4 bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-0">
              <h3 className="font-semibold mb-3">Nalezeno v okolí {radius} km</h3>
              <div className="text-center">
                <div className="text-4xl font-bold mb-1">{filteredFeatures.length}</div>
                <div className="text-sm opacity-90">celkem míst</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Mapa - 2/3 width */}
        <div className="hidden md:block md:w-2/3 relative">
          {userLocation && filteredFeatures.length > 0 ? (
            <InteractiveMap 
              features={filteredFeatures} 
              filters={{ transport: true, places: true }}
              userLocation={userLocation}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-blue-50">
              <div className="text-center text-gray-500">
                <span className="text-4xl mb-2 block">🗺️</span>
                {filteredFeatures.length === 0 ? (
                  <>
                    <p className="font-semibold">Žádná místa v okolí</p>
                    <p className="text-sm">Zkuste zvýšit rozsah vyhledávání</p>
                  </>
                ) : (
                  <p>Načítání mapy...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
