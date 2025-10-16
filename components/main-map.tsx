'use client';

import { useState, useEffect, Suspense, lazy } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Lazy load map
const InteractiveMap = lazy(() => import('@/components/interactive-map'));

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
}

interface FilterState {
  transport: boolean;
  places: boolean;
}

export default function MainMap() {
  const [filters, setFilters] = useState<FilterState>({
    transport: false,
    places: true, // Defaultně zobrazit místa
  });
  
  const [allFeatures, setAllFeatures] = useState<Feature[]>([]);
  const [filteredFeatures, setFilteredFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ transport: 0, places: 0 });

  // Načti data při mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Aktualizuj filtrovaná data při změně filtrů
  useEffect(() => {
    filterData();
  }, [filters, allFeatures]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/map-data');
      if (response.ok) {
        const data = await response.json();
        setAllFeatures(data.features || []);
        setStats(data.stats || { transport: 0, places: 0 });
      }
    } catch (error) {
      console.error('Chyba při načítání dat:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    const filtered = allFeatures.filter(feature => {
      const category = feature.category.toLowerCase();
      
      // Doprava (autobusové zastávky)
      if (filters.transport && category.includes('autobusov')) {
        return true;
      }
      
      // Místa (všechno ostatní kromě autobusových zastávek)
      if (filters.places && !category.includes('autobusov')) {
        return true;
      }
      
      return false;
    });
    
    setFilteredFeatures(filtered);
  };

  const toggleFilter = (filterName: keyof FilterState) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const selectAll = () => {
    setFilters({ transport: true, places: true });
  };

  const deselectAll = () => {
    setFilters({ transport: false, places: false });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🗺️</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Plánio</h1>
              <p className="text-sm text-gray-600">Objevuj Královéhradecký kraj</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">
              {filteredFeatures.length} míst
            </Badge>
            <a
              href="/planio"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              AI Asistent →
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          {/* Sidebar s filtry */}
          <aside className="space-y-4">
            {/* Filter Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>🎯 Filtry</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      className="text-xs"
                    >
                      Vše
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAll}
                      className="text-xs"
                    >
                      Zrušit
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Doprava */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Checkbox
                      id="transport"
                      checked={filters.transport}
                      onCheckedChange={() => toggleFilter('transport')}
                    />
                    <Label
                      htmlFor="transport"
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🚌</span>
                          <span className="font-medium">Doprava</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {stats.transport}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        Autobusové zastávky
                      </p>
                    </Label>
                  </div>

                  {/* Místa */}
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Checkbox
                      id="places"
                      checked={filters.places}
                      onCheckedChange={() => toggleFilter('places')}
                    />
                    <Label
                      htmlFor="places"
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📍</span>
                          <span className="font-medium">Místa</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {stats.places}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        Památky, muzea, rozhledny, atd.
                      </p>
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="shadow-lg bg-gradient-to-br from-blue-50 to-purple-50">
              <CardHeader>
                <CardTitle className="text-lg">📊 Statistiky</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Celkem míst:</span>
                  <Badge variant="secondary">{stats.places + stats.transport}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Zobrazeno:</span>
                  <Badge className="bg-blue-600">{filteredFeatures.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Okresů:</span>
                  <Badge variant="outline">5</Badge>
                </div>
              </CardContent>
            </Card>

            {/* AI Assistant CTA */}
            <Card className="shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <div className="text-4xl">🤖</div>
                  <h3 className="font-bold text-green-900">
                    Potřebuješ poradit?
                  </h3>
                  <p className="text-sm text-green-800">
                    Zkus náš AI asistent pro personalizované návrhy výletů!
                  </p>
                  <a href="/planio">
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      Spustit AI asistenta
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Map Area */}
          <main>
            <Card className="shadow-xl">
              <CardContent className="p-0">
                {loading ? (
                  <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-gray-50">
                    <div className="text-center space-y-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600">Načítám mapu...</p>
                    </div>
                  </div>
                ) : (
                  <Suspense fallback={
                    <div className="h-[calc(100vh-200px)] flex items-center justify-center bg-gray-50">
                      <p className="text-gray-600">Připravuji mapu...</p>
                    </div>
                  }>
                    <InteractiveMap
                      features={filteredFeatures}
                      filters={filters}
                    />
                  </Suspense>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
