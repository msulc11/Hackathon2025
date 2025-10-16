import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'dataSEC');
    const allFiles = fs.readdirSync(dataPath);
    
    // Najdi soubory s hrady a botanickými zahradami
    const castlesFile = allFiles.find(f => f.startsWith('Hrady_'));
    const gardensFile = allFiles.find(f => f.startsWith('Botanické_zahrady_a_arboreta_'));
    
    const allPlaces: any[] = [];
    
    // Načti hrady
    if (castlesFile) {
      const content = fs.readFileSync(path.join(dataPath, castlesFile), 'utf-8');
      const data = JSON.parse(content);
      
      if (data.features) {
        data.features.forEach((feature: any) => {
          // Použij lokální obrázek podle ID
          const imageId = feature.id;
          const imageExt = imageId === 18 ? 'jpeg' : 'jpg'; // ID 18 má .jpeg
          const imagePath = `/hrady/${imageId}.${imageExt}`;
          
          allPlaces.push({
            id: `castle-${feature.id}`,
            name: feature.properties.nazev,
            description: feature.properties.popis || 'Historický hrad v Královéhradeckém kraji',
            category: '🏰 Hrad',
            location: feature.properties.nazev_obce || feature.properties.nazev_okresu,
            coordinates: feature.geometry.coordinates,
            website: feature.properties.www,
            phone: feature.properties.telefon,
            image: imagePath,
          });
        });
      }
    }
    
    // Načti botanické zahrady
    if (gardensFile) {
      const content = fs.readFileSync(path.join(dataPath, gardensFile), 'utf-8');
      const data = JSON.parse(content);
      
      if (data.features) {
        data.features.forEach((feature: any) => {
          // Použij lokální obrázek podle ID
          const imageId = feature.id;
          const imagePath = `/zahrady/${imageId}.jpg`;
          
          allPlaces.push({
            id: `garden-${feature.id}`,
            name: feature.properties.nazev,
            description: feature.properties.popis || 'Krásná botanická zahrada v Královéhradeckém kraji',
            category: '🌳 Botanická zahrada',
            location: feature.properties.nazev_obce || feature.properties.nazev_okresu,
            coordinates: feature.geometry.coordinates,
            website: feature.properties.www,
            phone: feature.properties.telefon || feature.properties.telefon_1,
            image: imagePath,
          });
        });
      }
    }
    
    // Zamíchej pole pro náhodné pořadí
    const shuffled = allPlaces.sort(() => Math.random() - 0.5);
    
    // Debug: vypiš první 3 místa
    console.log('API: Odesílám data, první 3 místa:');
    shuffled.slice(0, 3).forEach(place => {
      console.log(`- ${place.name}: ${place.image}`);
    });
    
    return NextResponse.json({
      places: shuffled,
      total: shuffled.length
    });
  } catch (error) {
    console.error('Chyba při načítání dat:', error);
    return NextResponse.json({ error: 'Chyba při načítání dat' }, { status: 500 });
  }
}
