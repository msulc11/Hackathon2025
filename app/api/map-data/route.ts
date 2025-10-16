import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'dataSEC');
    const allFiles = fs.readdirSync(dataPath);
    
    // Najdi konkrétní soubory
    const busStopsFile = allFiles.find(f => f.startsWith('Autobusové_zastávky_IREDO_'));
    const theatersFile = allFiles.find(f => f.startsWith('Divadla_a_filharmonie_'));
    
    const allFeatures: any[] = [];
    let transportCount = 0;
    let placesCount = 0;
    
    // Načti autobusové zastávky (doprava)
    if (busStopsFile) {
      const content = fs.readFileSync(path.join(dataPath, busStopsFile), 'utf-8');
      const data = JSON.parse(content);
      
      if (data.features) {
        data.features.forEach((feature: any) => {
          allFeatures.push({ 
            ...feature, 
            category: 'Autobusové zastávky',
            featureType: 'transport'
          });
          transportCount++;
        });
      }
    }
    
    // Načti divadla (místa)
    if (theatersFile) {
      const content = fs.readFileSync(path.join(dataPath, theatersFile), 'utf-8');
      const data = JSON.parse(content);
      
      if (data.features) {
        data.features.forEach((feature: any) => {
          allFeatures.push({ 
            ...feature, 
            category: 'Divadla a filharmonie',
            featureType: 'place'
          });
          placesCount++;
        });
      }
    }
    
    return NextResponse.json({
      features: allFeatures,
      stats: { transport: transportCount, places: placesCount, total: allFeatures.length }
    });
  } catch (error) {
    console.error('Chyba při načítání dat:', error);
    return NextResponse.json({ error: 'Chyba při načítání dat' }, { status: 500 });
  }
}
