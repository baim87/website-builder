import { config } from 'dotenv';
config();

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GBP_API_KEY;

async function getTrade(businessName: string) {
  if (!API_KEY) {
    console.error('Missing Google Places API Key');
    return;
  }

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.primaryType,places.types,places.formattedAddress'
      },
      body: JSON.stringify({
        textQuery: businessName
      })
    });

    const data = await response.json();
    
    if (data.places && data.places.length > 0) {
      console.log(`Results for "${businessName}":`);
      data.places.forEach((place: any, i: number) => {
        console.log(`\n--- Match ${i + 1} ---`);
        console.log(`Name: ${place.displayName?.text}`);
        console.log(`Address: ${place.formattedAddress}`);
        console.log(`Primary Trade (Category): ${place.primaryType || 'N/A'}`);
        console.log(`All Categories: ${place.types?.join(', ') || 'N/A'}`);
      });
    } else {
      console.log(`No Google Business Profile found for "${businessName}".`);
      console.log('Response:', data);
    }
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

const query = process.argv[2] || 'Easy Green Landscaping';
getTrade(query);
