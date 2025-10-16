'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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

export default function SwipeCards() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Place[]>([]);
  const [dragStart, setDragStart] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetch('/api/swipe-data')
      .then(res => res.json())
      .then(data => {
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
  }, []);

  // Ulož liked places do localStorage při každé změně
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Načítání míst...</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= places.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">🎉 Hotovo!</h2>
          <p className="text-gray-600 mb-6">
            Prošli jste všechna místa. Líbilo se vám {liked.length} z {places.length} míst.
          </p>
          {liked.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">💚 Místa, která se vám líbila:</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {liked.map((place, i) => (
                  <div key={i} className="text-left p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{place.name}</p>
                    <p className="text-sm text-gray-600">{place.category}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setCurrentIndex(0);
                setLiked([]);
                localStorage.removeItem('likedPlaces');
              }}
              variant="outline"
              className="flex-1"
            >
              Začít znovu
            </Button>
            <Link href="/plan" className="flex-1">
              <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600">
                Zobrazit plán
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const currentPlace = places[currentIndex];
  const rotation = dragOffset / 20;
  const opacity = 1 - Math.abs(dragOffset) / 300;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          Objevuj místa
        </h1>
        <div className="flex items-center gap-4">
          {liked.length > 0 && (
            <Link href="/plan">
              <Button size="sm" className="bg-gradient-to-r from-blue-500 to-purple-600">
                💚 {liked.length} Zobrazit plán
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{currentIndex + 1}</span>
            <span>/</span>
            <span>{places.length}</span>
          </div>
        </div>
      </div>

      {/* Karty */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="relative w-full max-w-md h-[600px]">
          {/* Následující karta (pozadí) */}
          {currentIndex + 1 < places.length && (
            <div className="absolute inset-0">
              <Card className="w-full h-full overflow-hidden shadow-xl opacity-50 scale-95">
                <div className="relative h-full">
                  <img
                    src={places[currentIndex + 1].image}
                    alt={places[currentIndex + 1].name}
                    className="w-full h-2/3 object-cover"
                  />
                  <div className="p-6">
                    <h2 className="text-2xl font-bold mb-2">
                      {places[currentIndex + 1].name}
                    </h2>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Aktuální karta */}
          <div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{
              transform: `translateX(${dragOffset}px) rotate(${rotation}deg)`,
              opacity: opacity,
              transition: isDragging ? 'none' : 'transform 0.3s, opacity 0.3s'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (isDragging) {
                handleMouseUp();
              }
            }}
          >
            <Card className="w-full h-full overflow-hidden shadow-2xl">
              <div className="relative h-full">
                {/* Obrázek */}
                <div className="relative h-2/3">
                  <img
                    src={currentPlace.image}
                    alt={currentPlace.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Kategorie badge */}
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-semibold">
                      {currentPlace.category}
                    </span>
                  </div>
                  
                  {/* Like/Dislike overlay při swipování */}
                  {dragOffset > 50 && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <div className="bg-green-500 text-white text-6xl font-bold px-8 py-4 rounded-xl rotate-12">
                        ❤️ LÍBÍ
                      </div>
                    </div>
                  )}
                  {dragOffset < -50 && (
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                      <div className="bg-red-500 text-white text-6xl font-bold px-8 py-4 rounded-xl -rotate-12">
                        👎 NE
                      </div>
                    </div>
                  )}
                </div>

                {/* Informace */}
                <div className="p-6 h-1/3 flex flex-col">
                  <h2 className="text-2xl font-bold mb-2 line-clamp-1">
                    {currentPlace.name}
                  </h2>
                  <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    📍 {currentPlace.location}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-3 flex-1">
                    {currentPlace.description}
                  </p>
                  
                  {/* Odkazy */}
                  <div className="flex gap-2 mt-3">
                    {currentPlace.website && (
                      <a
                        href={currentPlace.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🌐 Web
                      </a>
                    )}
                    {currentPlace.phone && (
                      <a
                        href={`tel:${currentPlace.phone}`}
                        className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞 Telefon
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Tlačítka */}
      <div className="p-6 flex justify-center gap-6">
        <Button
          onClick={handleDislike}
          size="lg"
          variant="outline"
          className="w-16 h-16 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-50"
        >
          <span className="text-2xl">✕</span>
        </Button>
        <Button
          onClick={handleLike}
          size="lg"
          className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
        >
          <span className="text-2xl">❤️</span>
        </Button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / places.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
