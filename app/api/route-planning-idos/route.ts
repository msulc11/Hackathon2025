import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Haversine formula pro výpočet vzdálenosti
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Poloměr Země v km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, mode = 'car', destinations } = body;

    // Načti autobusové zastávky
    const busStopsPath = path.join(process.cwd(), 'dataSEC', 'Autobusové_zastávky_IREDO_6658952351530177739.geojson');
    const busStopsData = JSON.parse(fs.readFileSync(busStopsPath, 'utf-8'));
    const busStops = busStopsData.features;

    // Funkce pro nalezení nejbližší zastávky
    const findNearestBusStop = (lat: number, lon: number): any => {
      let nearest = null;
      let minDistance = Infinity;

      for (const stop of busStops) {
        const [stopLon, stopLat] = stop.geometry.coordinates;
        const distance = calculateDistance(lat, lon, stopLat, stopLon);
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = {
            name: stop.properties.nazev || stop.properties.name || 'Zastávka',
            coordinates: [stopLat, stopLon],
            distance: distance
          };
        }
      }
      
      return nearest;
    };

    if (mode === 'car') {
      // OSRM routing pro auto - jeden segment (origin -> destination)
      const coords = `${origin[1]},${origin[0]};${destination[0]},${destination[1]}`;
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      
      const response = await fetch(osrmUrl);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const route = data.routes[0];
        const routeCoords = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        
        return NextResponse.json({
          success: true,
          mode: 'car',
          route: routeCoords,
          distance: route.distance / 1000,
          duration: route.duration / 60
        });
      }
      
      // Fallback na přímou čáru
      return NextResponse.json({
        success: true,
        mode: 'car',
        route: [origin, [destination[1], destination[0]]],
        distance: calculateDistance(origin[0], origin[1], destination[1], destination[0]),
        duration: calculateDistance(origin[0], origin[1], destination[1], destination[0]) * 1.5
      });
    }

    if (mode === 'bus') {
      // Najdi nejbližší zastávky
      const originStop = findNearestBusStop(origin[0], origin[1]);
      const destStop = findNearestBusStop(destination[1], destination[0]);
      
      if (!originStop || !destStop) {
        return NextResponse.json({
          success: false,
          error: 'Nenalezeny autobusové zastávky v blízkosti'
        });
      }

      // Vytvoř IDOS URL s konkrétními zastávkami
      const fromName = encodeURIComponent(originStop.name);
      const toName = encodeURIComponent(destStop.name);
      const idosUrl = `https://idos.idnes.cz/vlakyautobusymhdvse/spojeni/?f=${fromName}&t=${toName}&fc=501400&tc=501400`;
      
      // Použij OSRM pro chůzi k zastávce a ze zastávky
      const walkToStopUrl = `https://router.project-osrm.org/route/v1/foot/${origin[1]},${origin[0]};${originStop.coordinates[1]},${originStop.coordinates[0]}?overview=full&geometries=geojson`;
      const busRouteUrl = `https://router.project-osrm.org/route/v1/driving/${originStop.coordinates[1]},${originStop.coordinates[0]};${destStop.coordinates[1]},${destStop.coordinates[0]}?overview=full&geometries=geojson`;
      const walkFromStopUrl = `https://router.project-osrm.org/route/v1/foot/${destStop.coordinates[1]},${destStop.coordinates[0]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;
      
      const [walkToRes, busRouteRes, walkFromRes] = await Promise.all([
        fetch(walkToStopUrl),
        fetch(busRouteUrl),
        fetch(walkFromStopUrl)
      ]);
      
      const walkToData = await walkToRes.json();
      const busRouteData = await busRouteRes.json();
      const walkFromData = await walkFromRes.json();
      
      // Sestavíme reálnou trasu
      let busRoute: [number, number][] = [];
      let walkToDistance = 0;
      let walkFromDistance = 0;
      let walkToDuration = 0;
      let walkFromDuration = 0;
      let busDistance = 0;
      let busDuration = 0;
      
      // Chůze k zastávce
      if (walkToData.code === 'Ok' && walkToData.routes?.[0]) {
        const route = walkToData.routes[0];
        busRoute.push(...route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]));
        walkToDistance = route.distance / 1000;
        walkToDuration = route.duration / 60;
      } else {
        busRoute.push(origin);
        busRoute.push(originStop.coordinates);
      }
      
      // Autobusová cesta (použijeme car routing jako aproximaci)
      if (busRouteData.code === 'Ok' && busRouteData.routes?.[0]) {
        const route = busRouteData.routes[0];
        busRoute.push(...route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]));
        busDistance = route.distance / 1000;
        busDuration = route.duration / 60;
      } else {
        // Fallback na přímou čáru
        busRoute.push(originStop.coordinates);
        busRoute.push(destStop.coordinates);
        busDistance = calculateDistance(
          originStop.coordinates[0], 
          originStop.coordinates[1], 
          destStop.coordinates[0], 
          destStop.coordinates[1]
        );
        busDuration = busDistance * 2; // odhad
      }
      
      // Chůze ze zastávky
      if (walkFromData.code === 'Ok' && walkFromData.routes?.[0]) {
        const route = walkFromData.routes[0];
        busRoute.push(...route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]));
        walkFromDistance = route.distance / 1000;
        walkFromDuration = route.duration / 60;
      } else {
        busRoute.push([destination[1], destination[0]]);
      }
      
      const totalDistance = walkToDistance + busDistance + walkFromDistance;
      const totalDuration = walkToDuration + busDuration + walkFromDuration;
      
      return NextResponse.json({
        success: true,
        mode: 'transit',
        route: busRoute,
        distance: totalDistance,
        duration: totalDuration,
        busStops: {
          origin: {
            name: originStop.name,
            coordinates: originStop.coordinates,
            distance: walkToDistance
          },
          destination: {
            name: destStop.name,
            coordinates: destStop.coordinates,
            distance: walkFromDistance
          }
        },
        transitDetails: [{
          line: 'Autobusové spojení',
          departure: originStop.name,
          arrival: destStop.name,
          note: `Klikněte na tlačítko níže pro přesné jízdní řády`,
          idosUrl: idosUrl,
          walkToStop: walkToDistance.toFixed(2),
          walkFromStop: walkFromDistance.toFixed(2),
          busDistance: busDistance.toFixed(2)
        }]
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Nepodporovaný režim dopravy'
    });

  } catch (error) {
    console.error('Route planning error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chyba při plánování trasy'
    });
  }
}
