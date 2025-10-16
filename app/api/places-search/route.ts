import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query')?.toLowerCase() || '';
    const category = searchParams.get('category')?.toLowerCase() || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    const CATEGORIES: Record<string, { name: string; type: string; emoji: string }> = {
      'Architektonické_památky': { name: 'Architektonické památky', type: 'pamatky', emoji: '🏛️' },
      'Církevní_památky': { name: 'Církevní památky', type: 'pamatky', emoji: '⛪' },
      'Hrady': { name: 'Hrady', type: 'hrady', emoji: '🏰' },
      'Zámky': { name: 'Zámky', type: 'hrady', emoji: '🏰' },
      'Botanické_zahrady': { name: 'Botanické zahrady a arboreta', type: 'zahrady', emoji: '🌳' },
      'Muzea_a_galerie': { name: 'Muzea a galerie', type: 'muzea', emoji: '🎨' },
      'Divadla_a_filharmonie': { name: 'Divadla a filharmonie', type: 'divadla', emoji: '🎭' },
      'Pivovary': { name: 'Pivovary', type: 'pivovary', emoji: '🍺' },
      'Rozhledny_a_vyhlídky': { name: 'Rozhledny a vyhlídky', type: 'rozhledny', emoji: '🗼' },
      'Letní_koupání': { name: 'Letní koupání', type: 'koupani', emoji: '🏊' },
      'Přírodní_zajímavosti': { name: 'Přírodní zajímavosti', type: 'priroda', emoji: '🌲' },
      'Hudební_kluby': { name: 'Hudební kluby a festival parky', type: 'hudba', emoji: '🎵' },
      'Kina': { name: 'Kina', type: 'kina', emoji: '🎬' },
      'Kulturní_domy': { name: 'Kulturní domy', type: 'kultura', emoji: '🏢' },
      'Židovské_památky': { name: 'Židovské památky', type: 'pamatky', emoji: '✡️' },
      'Památkové_rezervace': { name: 'Památkové rezervace', type: 'pamatky', emoji: '🏛️' },
      'Pevnosti_a_opevnění': { name: 'Pevnosti a opevnění', type: 'pamatky', emoji: '🏯' },
      'Ostatní_historické_památky': { name: 'Ostatní historické památky', type: 'pamatky', emoji: '📜' },
      'Regionální_potraviny': { name: 'Regionální potraviny', type: 'jidlo', emoji: '🧀' },
      'Solné_jeskyně': { name: 'Solné jeskyně', type: 'wellness', emoji: '💎' },
      'Knihovny': { name: 'Knihovny', type: 'knihovny', emoji: '📚' },
      'Infocentra': { name: 'Infocentra', type: 'info', emoji: 'ℹ️' },
      'Základní_umělecké_školy': { name: 'Základní umělecké školy', type: 'vzdelavani', emoji: '🎨' },
      'Domovy_dětí_a_mládeže': { name: 'Domovy dětí a mládeže', type: 'deti', emoji: '👶' },
    };

    const dataDir = path.join(process.cwd(), 'dataSEC');
    const allPlaces: any[] = [];

    for (const [filePrefix, categoryInfo] of Object.entries(CATEGORIES)) {
      // Skip if category filter is specified and doesn't match
      if (category && !categoryInfo.type.includes(category) && !categoryInfo.name.toLowerCase().includes(category)) {
        continue;
      }

      const files = fs.readdirSync(dataDir).filter(f => f.startsWith(filePrefix) && f.endsWith('.geojson'));
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (data.features) {
          for (const feature of data.features) {
            if (!feature.geometry || !feature.geometry.coordinates) continue;

            const properties = feature.properties || {};
            const name = properties.nazev || properties.name || properties.NAZEV || '';
            const description = properties.popis || properties.description || '';
            const address = properties.adresa || properties.address || properties.ADRESA || '';
            const web = properties.web || properties.website || '';
            const phone = properties.telefon || properties.phone || '';

            // Search in name, description, and address
            const searchText = `${name} ${description} ${address}`.toLowerCase();
            
            if (!query || searchText.includes(query)) {
              allPlaces.push({
                name,
                description,
                address,
                web,
                phone,
                category: categoryInfo.name,
                emoji: categoryInfo.emoji,
                coordinates: feature.geometry.coordinates,
                type: feature.geometry.type
              });
            }
          }
        }
      }
    }

    // Limit results
    const limitedPlaces = allPlaces.slice(0, limit);

    return NextResponse.json({
      places: limitedPlaces,
      total: allPlaces.length,
      returned: limitedPlaces.length
    });

  } catch (error: any) {
    console.error('Error searching places:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při hledání míst' },
      { status: 500 }
    );
  }
}
