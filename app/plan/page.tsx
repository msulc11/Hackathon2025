'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import RouteMap from '@/components/route-planning-map';

interface LikedPlace {
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

export default function PlanPage() {
  const [likedPlaces, setLikedPlaces] = useState<LikedPlace[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Načti liked places z localStorage
    const stored = localStorage.getItem('likedPlaces');
    if (stored) {
      try {
        setLikedPlaces(JSON.parse(stored));
      } catch (e) {
        console.error('Chyba při načítání:', e);
      }
    }

    // Získej polohu uživatele
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLoading(false);
        },
        (error) => {
          console.error('Chyba při získávání polohy:', error);
          // Fallback na Hradec Králové
          setUserLocation([50.2091, 15.8327]);
          setLoading(false);
        }
      );
    } else {
      setUserLocation([50.2091, 15.8327]);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Připravuji plán...</p>
        </div>
      </div>
    );
  }

  if (likedPlaces.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">📍 Žádná místa</h2>
          <p className="text-gray-600 mb-6">
            Nejprve si vyberte místa, která vás zajímají pomocí swipe karet.
          </p>
          <Link href="/">
            <Button className="w-full">
              Začít objevovat
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Plánio
              </Link>
              <div className="hidden md:flex gap-6">
                <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Objevuj
                </Link>
                <Link href="/mapa" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Mapa okolí
                </Link>
                <Link href="/plan" className="text-blue-600 font-semibold">
                  Můj plán
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <div className="w-80 bg-white/80 backdrop-blur-md border-r border-gray-200 p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Váš výlet
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Optimální trasa pro {likedPlaces.length} {likedPlaces.length === 1 ? 'místo' : likedPlaces.length < 5 ? 'místa' : 'míst'}
          </p>

          {/* Statistiky */}
          <Card className="p-4 mb-6 bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>Přehled</span>
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Počet zastávek</span>
                <span className="font-bold">{likedPlaces.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Vaše poloha</span>
                <span className="font-bold">📍</span>
              </div>
            </div>
          </Card>

          {/* Seznam míst */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
              Vybraná místa
            </h3>
            {likedPlaces.map((place, index) => (
              <Card key={place.id} className="p-3 hover:shadow-md transition-shadow">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{place.name}</h4>
                    <p className="text-xs text-gray-600 truncate">{place.category}</p>
                    <p className="text-xs text-gray-500 truncate">📍 {place.location}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Akce */}
          <div className="mt-6 space-y-3">
            <Button
              onClick={() => {
                localStorage.removeItem('likedPlaces');
                window.location.href = '/';
              }}
              variant="outline"
              className="w-full"
            >
              Vymazat a začít znovu
            </Button>
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1">
          {userLocation && (
            <RouteMap
              userLocation={userLocation}
              destinations={likedPlaces}
            />
          )}
        </div>
      </div>
    </div>
  );
}
