import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { origin, destination, destinations, mode } = await request.json();
    
    if (mode === 'transit' || mode === 'bus') {
      // Načti autobusové zastávky
      const dataPath = path.join(process.cwd(), 'dataSEC');
      const allFiles = fs.readdirSync(dataPath);
      const busStopsFile = allFiles.find(f => f.startsWith('Autobusové_zastávky_IREDO_'));
      
      let busStops: any[] = [];
      if (busStopsFile) {
        const content = fs.readFileSync(path.join(dataPath, busStopsFile), 'utf-8');
        const data = JSON.parse(content);
        busStops = data.features || [];
      }
      
      // Najdi nejbližší zastávky k počátku a cíli
      const findNearestBusStop = (lat: number, lon: number): any => {
        let nearest = null;
        let minDistance = Infinity;
        
        busStops.forEach((stop: any) => {
          const [stopLon, stopLat] = stop.geometry.coordinates;
          const distance = calculateDistance(lat, lon, stopLat, stopLon);
          
          if (distance < minDistance) {
            minDistance = distance;
            nearest = {
              name: stop.properties.nazev || 'Zastávka',
              coordinates: [stopLat, stopLon],
              distance: distance
            };
          }
        });
        
        return nearest;
      };
      
      // Použij Google Directions API pro veřejnou dopravu
      const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
      
      if (GOOGLE_API_KEY) {
        try {
          // Vytvoř waypoints string
          let waypointsParam = '';
          if (destinations && destinations.length > 0) {
            const waypoints = destinations.slice(0, -1).map((d: any) => {
              const [lon, lat] = d.coordinates;
              return `${lat},${lon}`;
            }).join('|');
            if (waypoints) {
              waypointsParam = `&waypoints=${waypoints}`;
            }
          }
          
          const [destLon, destLat] = destination;
          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin[0]},${origin[1]}&destination=${destLat},${destLon}${waypointsParam}&mode=transit&transit_mode=bus&departure_time=now&key=${GOOGLE_API_KEY}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.routes && data.routes[0]) {
            const route = data.routes[0];
            const leg = route.legs[0];
            
            // Extrahuj detaily o lince
            const transitDetails = leg.steps
              .filter((step: any) => step.travel_mode === 'TRANSIT')
              .map((step: any) => ({
                line: step.transit_details?.line?.short_name || step.transit_details?.line?.name,
                departure: step.transit_details?.departure_stop?.name,
                arrival: step.transit_details?.arrival_stop?.name,
                departureTime: step.transit_details?.departure_time?.text,
                arrivalTime: step.transit_details?.arrival_time?.text,
                numStops: step.transit_details?.num_stops,
                duration: step.duration?.text
              }));
            
            // Dekóduj polyline
            const points = decodePolyline(route.overview_polyline.points);
            
            return NextResponse.json({
              success: true,
              mode: 'transit',
              route: points,
              distance: leg.distance.value / 1000, // km
              duration: leg.duration.value / 60, // minuty
              transitDetails: transitDetails,
              summary: `${leg.distance.text}, ${leg.duration.text}`,
              instructions: leg.steps.map((step: any) => ({
                html: step.html_instructions,
                distance: step.distance?.text,
                duration: step.duration?.text
              }))
            });
          }
        } catch (error) {
          console.error('Google API error:', error);
        }
      }
      
      // Fallback: Najdi nejbližší zastávky a odhadni trasu
      const originStop = findNearestBusStop(origin[0], origin[1]);
      const destStop = findNearestBusStop(destination[1], destination[0]);
      
      // Vytvoř fallback trasu
      const fallbackRoute = [
        origin,
        originStop ? originStop.coordinates : origin,
        destStop ? destStop.coordinates : [destination[1], destination[0]],
        [destination[1], destination[0]]
      ];
      
      // Vypočítej vzdálenost
      let totalDistance = 0;
      for (let i = 0; i < fallbackRoute.length - 1; i++) {
        totalDistance += calculateDistance(
          fallbackRoute[i][0], fallbackRoute[i][1],
          fallbackRoute[i + 1][0], fallbackRoute[i + 1][1]
        );
      }
      
      // Odhadni čas (průměrná rychlost MHD 25 km/h + čekání)
      const estimatedDuration = (totalDistance / 25) * 60 + 10; // minuty
      
      return NextResponse.json({
        success: true,
        mode: 'transit',
        route: fallbackRoute,
        distance: totalDistance,
        duration: estimatedDuration,
        transitDetails: [{
          line: 'Autobusová linka',
          departure: originStop?.name || 'Výchozí bod',
          arrival: destStop?.name || 'Cíl',
          departureTime: 'Co nejdříve',
          numStops: busStops.length > 0 ? Math.floor(totalDistance / 2) : 0,
          note: 'Použijte Google Maps pro aktuální jízdní řády'
        }],
        busStops: {
          origin: originStop,
          destination: destStop
        },
        warning: 'Pro přesné časy spojů použijte Export do Google Maps'
      });
    }
    
    // Pro auto použij OSRM
    const coordinates = `${origin[1]},${origin[0]};${destination[0]},${destination[1]}`;
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`
    );
    
    if (!response.ok) {
      throw new Error('OSRM routing failed');
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const points = route.geometry.coordinates.map((coord: number[]) => 
        [coord[1], coord[0]]
      );
      
      return NextResponse.json({
        success: true,
        mode: 'driving',
        route: points,
        distance: route.distance / 1000,
        duration: route.duration / 60
      });
    }
    
    throw new Error('No route found');
    
  } catch (error) {
    console.error('Routing error:', error);
    return NextResponse.json(
      { error: 'Chyba při plánování trasy', details: String(error) },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
