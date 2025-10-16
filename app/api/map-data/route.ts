import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Mapa kategorií s emoji a typem
const CATEGORIES = {
  'Autobusové_zastávky_IREDO_': { name: '🚌 Autobusové zastávky', type: 'transport', emoji: '🚌' },
  'Hrady_': { name: '🏰 Hrady', type: 'place', emoji: '🏰' },
  'Botanické_zahrady_a_arboreta_': { name: '🌳 Botanické zahrady', type: 'place', emoji: '🌳' },
  'Architektonické_památky_': { name: '🏛️ Architektonické památky', type: 'place', emoji: '🏛️' },
  'Církevní_památky_': { name: '⛪ Církevní památky', type: 'place', emoji: '⛪' },
  'Divadla_a_filharmonie_': { name: '🎭 Divadla a filharmonie', type: 'place', emoji: '🎭' },
  'Domovy_dětí_a_mládeže_a_střediska_volného_času': { name: '👶 Střediska volného času', type: 'place', emoji: '👶' },
  'Hudební_kluby_a_festival_parky_': { name: '🎵 Hudební kluby', type: 'place', emoji: '🎵' },
  'Infocentra_': { name: 'ℹ️ Infocentra', type: 'place', emoji: 'ℹ️' },
  'Kina_': { name: '🎬 Kina', type: 'place', emoji: '🎬' },
  'Knihovny_': { name: '📚 Knihovny', type: 'place', emoji: '📚' },
  'Kulturní_domy_': { name: '🏢 Kulturní domy', type: 'place', emoji: '🏢' },
  'Letní_koupání_': { name: '🏊 Letní koupání', type: 'place', emoji: '🏊' },
  'Muzea_a_galerie_': { name: '🖼️ Muzea a galerie', type: 'place', emoji: '🖼️' },
  'Ostatní_historické_památky_': { name: '🏺 Historické památky', type: 'place', emoji: '🏺' },
  'Památkové_rezervace_': { name: '🏛️ Památkové rezervace', type: 'place', emoji: '🏛️' },
  'Pevnosti_a_opevnění_': { name: '⚔️ Pevnosti', type: 'place', emoji: '⚔️' },
  'Pivovary_': { name: '🍺 Pivovary', type: 'place', emoji: '🍺' },
  'Přírodní_zajímavosti_': { name: '🌲 Přírodní zajímavosti', type: 'place', emoji: '🌲' },
  'Regionální_potraviny_': { name: '🥖 Regionální potraviny', type: 'place', emoji: '🥖' },
  'Rozhledny_a_vyhlídky_': { name: '🗼 Rozhledny a vyhlídky', type: 'place', emoji: '🗼' },
  'Solné_jeskyně_': { name: '🧂 Solné jeskyně', type: 'place', emoji: '🧂' },
  'Základní_umělecké_školy_': { name: '🎨 Umělecké školy', type: 'place', emoji: '🎨' },
  'Židovské_památky_': { name: '✡️ Židovské památky', type: 'place', emoji: '✡️' },
};

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'dataSEC');
    const allFiles = fs.readdirSync(dataPath);
    
    const allFeatures: any[] = [];
    const categoryCounts: Record<string, number> = {};
    let transportCount = 0;
    let placesCount = 0;
    
    // Načti všechny soubory podle kategorií
    for (const [prefix, categoryInfo] of Object.entries(CATEGORIES)) {
      const file = allFiles.find(f => f.startsWith(prefix));
      
      if (file) {
        try {
          const content = fs.readFileSync(path.join(dataPath, file), 'utf-8');
          const data = JSON.parse(content);
          
          if (data.features) {
            let count = 0;
            data.features.forEach((feature: any) => {
              // Kontrola validity geometrie
              if (!feature.geometry || !feature.geometry.coordinates) {
                console.warn(`Přeskakuji feature bez geometrie v ${categoryInfo.name}`);
                return;
              }
              
              allFeatures.push({ 
                ...feature, 
                category: categoryInfo.name,
                featureType: categoryInfo.type,
                emoji: categoryInfo.emoji
              });
              count++;
              
              if (categoryInfo.type === 'transport') {
                transportCount++;
              } else {
                placesCount++;
              }
            });
            
            categoryCounts[categoryInfo.name] = count;
            console.log(`Načteno ${count} položek z ${categoryInfo.name}`);
          }
        } catch (err) {
          console.error(`Chyba při načítání ${file}:`, err);
        }
      }
    }
    
    console.log(`Celkem načteno: ${allFeatures.length} položek`);
    console.log(`Doprava: ${transportCount}, Místa: ${placesCount}`);
    
    return NextResponse.json({
      features: allFeatures,
      stats: { 
        transport: transportCount, 
        places: placesCount, 
        total: allFeatures.length,
        categories: categoryCounts
      }
    });
  } catch (error) {
    console.error('Chyba při načítání dat:', error);
    return NextResponse.json({ error: 'Chyba při načítání dat' }, { status: 500 });
  }
}
