'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const RouteMap = dynamic(() => import('@/components/route-planning-map'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center">Načítání mapy...</div>
});

interface Place {
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

export default function HomePage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Place[]>([]);
  const [dragStart, setDragStart] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number]>([50.2091, 15.8327]); // Výchozí: Hradec Králové
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Načti data
    fetch('/api/swipe-data')
      .then(res => res.json())
      .then(data => {
        console.log('Načtená data:', data.places?.slice(0, 3)); // Debug: první 3 místa
        setPlaces(data.places || []);
        setLoading(false);
      })
      .catch(error => {
        console.error('Chyba:', error);
        setLoading(false);
      });
    
    // Načti liked places z localStorage
    const stored = localStorage.getItem('likedPlaces');
    if (stored) {
      try {
        setLiked(JSON.parse(stored));
      } catch (e) {
        console.error('Chyba při načítání:', e);
      }
    }

    // Získej polohu pouze na klientu
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          console.log('Poloha získána:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Chyba při získávání polohy:', error);
          // Výchozí poloha je už nastavená v useState
          console.log('Používám výchozí polohu: Hradec Králové');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  }, [mounted]);

  useEffect(() => {
    if (liked.length > 0) {
      localStorage.setItem('likedPlaces', JSON.stringify(liked));
    }
  }, [liked]);

  const handleLike = () => {
    if (currentIndex < places.length) {
      const newLiked = [...liked, places[currentIndex]];
      setLiked(newLiked);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDislike = () => {
    if (currentIndex < places.length) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const offset = e.touches[0].clientX - dragStart;
      setDragOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (Math.abs(dragOffset) > 100) {
      if (dragOffset > 0) {
        handleLike();
      } else {
        handleDislike();
      }
    }
    setDragOffset(0);
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const offset = e.clientX - dragStart;
      setDragOffset(offset);
    }
  };

  const handleMouseUp = () => {
    if (Math.abs(dragOffset) > 100) {
      if (dragOffset > 0) {
        handleLike();
      } else {
        handleDislike();
      }
    }
    setDragOffset(0);
    setIsDragging(false);
  };

  const exportToGoogleMaps = () => {
    if (liked.length === 0 || !userLocation) {
      alert('Nejprve si vyberte místa!');
      return;
    }

    // Vytvoř URL pro Google Maps s více zastávkami
    const origin = `${userLocation[0]},${userLocation[1]}`;
    const destination = `${liked[liked.length - 1].coordinates[1]},${liked[liked.length - 1].coordinates[0]}`;
    
    let waypoints = '';
    if (liked.length > 1) {
      waypoints = liked.slice(0, -1).map(place => 
        `${place.coordinates[1]},${place.coordinates[0]}`
      ).join('|');
    }

    const travelMode = 'transit'; // Vždy autobus
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=${travelMode}`;
    
    window.open(url, '_blank');
  };

  if (loading || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Načítání...</p>
        </div>
      </div>
    );
  }

  const currentPlace = currentIndex < places.length ? places[currentIndex] : null;
  const rotation = dragOffset / 20;
  const opacity = 1 - Math.abs(dragOffset) / 300;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100" suppressHydrationWarning>
      {/* Navbar */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-blue-200 z-50 shadow-sm" suppressHydrationWarning>
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-blue-600 flex items-center gap-2">
                <Image src="/logo.png" alt="ZabrouzdAi" width={32} height={32} className="object-contain" />
                <span>ZabrouzdAi</span>
              </Link>
              <div className="hidden md:flex gap-6">
                <Link href="/" className="text-blue-600 font-semibold">
                  Objevuj
                </Link>
                <Link href="/mapa" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Mapa okolí
                </Link>
                <Link href="/brouzdal" className="text-gray-600 hover:text-blue-600 transition-colors">
                  Brouzdal
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {liked.length > 0 && (
                <>
                  <Button
                    onClick={() => {
                      setLiked([]);
                      localStorage.removeItem('likedPlaces');
                    }}
                    size="sm"
                    variant="outline"
                    className="hidden md:flex text-red-500 hover:text-red-700 border-red-300"
                  >
                    🗑️ Vymazat trasu
                  </Button>
                  <Button
                    onClick={exportToGoogleMaps}
                    size="sm"
                    className="hidden md:flex bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    📤 Export do Google Maps
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Swipe Cards (1/3) */}
        <div className="w-full md:w-1/3 flex flex-col bg-white/50 backdrop-blur-sm border-r border-blue-200">
          {/* Header */}
          <div className="p-4 border-b border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
              Objevuj místa
            </h1>
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>{currentIndex + 1} / {places.length}</span>
            </div>
          </div>

          {/* Card Area - zakázat výběr textu */}
          <div className="flex-1 flex items-center justify-center p-3 relative overflow-hidden select-none">
            {currentPlace ? (
              <div className="relative w-full max-w-sm h-[450px] select-none">
                {/* Next card preview */}
                {currentIndex + 1 < places.length && (
                  <div className="absolute inset-0 pointer-events-none">
                    <Card className="w-full h-full overflow-hidden shadow-lg opacity-20 scale-90">
                      <img
                        src={places[currentIndex + 1].image}
                        alt={places[currentIndex + 1].name}
                        className="w-full h-2/3 object-cover"
                      />
                    </Card>
                  </div>
                )}

                {/* Current card */}
                <div
                  className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none select-none"
                  style={{
                    transform: `translateX(${dragOffset}px) rotate(${rotation}deg)`,
                    opacity: opacity,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => isDragging && handleMouseUp()}
                >
                  <Card className="w-full h-full overflow-hidden shadow-2xl border-2 border-blue-100">
                    <div className="relative h-full flex flex-col select-none">
                      <div className="relative h-3/5 flex-shrink-0 bg-gray-100">
                        <img
                          src={currentPlace.image}
                          alt={currentPlace.name}
                          className="w-full h-full object-cover pointer-events-none"
                          draggable={false}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = '/hrady/1.jpg'; // Fallback na první hrad
                          }}
                        />
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-semibold shadow-md">
                            {currentPlace.category}
                          </span>
                        </div>
                        
                        {dragOffset > 50 && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <div className="bg-green-500 text-white text-3xl font-bold px-5 py-2 rounded-xl rotate-12 shadow-lg">
                              ❤️ LÍBÍ
                            </div>
                          </div>
                        )}
                        {dragOffset < -50 && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <div className="bg-red-500 text-white text-3xl font-bold px-5 py-2 rounded-xl -rotate-12 shadow-lg">
                              👎 NE
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3 flex-1 flex flex-col overflow-hidden select-none">
                        <h2 className="text-lg font-bold mb-1 line-clamp-1 select-none">
                          {currentPlace.name}
                        </h2>
                        <p className="text-xs text-gray-600 mb-2 flex items-center gap-1 select-none">
                          📍 {currentPlace.location}
                        </p>
                        <p className="text-xs text-gray-700 line-clamp-3 flex-1 select-none">
                          {currentPlace.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="p-8 text-center max-w-sm">
                <h2 className="text-2xl font-bold mb-4">🎉 Hotovo!</h2>
                <p className="text-gray-600 mb-4">
                  Prošli jste všechna místa. Líbilo se vám {liked.length} míst.
                </p>
                <Button 
                  onClick={() => {
                    setCurrentIndex(0);
                    setLiked([]);
                    localStorage.removeItem('likedPlaces');
                  }}
                  className="w-full"
                >
                  Začít znovu
                </Button>
              </Card>
            )}
          </div>

          {/* Controls */}
          {currentPlace && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex justify-center gap-4 mb-4">
                <Button
                  onClick={handleDislike}
                  size="lg"
                  variant="outline"
                  className="w-14 h-14 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-50"
                >
                  <span className="text-2xl">✕</span>
                </Button>
                <Button
                  onClick={handleLike}
                  size="lg"
                  className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
                >
                  <span className="text-2xl">❤️</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Map (2/3) */}
        <div className="hidden md:block md:w-2/3 relative">
          {userLocation && liked.length > 0 ? (
            <RouteMap
              userLocation={userLocation}
              destinations={liked}
              transportMode="bus"
              onClearRoute={() => {
                setLiked([]);
                localStorage.removeItem('likedPlaces');
              }}
              onLocationChange={(newLocation) => {
                setUserLocation(newLocation);
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 p-8 text-center">
              <div>
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-semibold mb-2">Začněte objevovat!</h3>
                <p className="text-gray-600">
                  Označte místa, která se vám líbí (❤️) a zobrazí se zde na mapě s optimální trasou.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
