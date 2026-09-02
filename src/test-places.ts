import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('No GOOGLE_PLACES_API_KEY');
    return;
  }

  const location = 'Peoria, Arizona';
  const radiusMiles = 10;
  const radiusMeters = Math.min(radiusMiles * 1609.34, 50000); // max 50km

  try {
    // 1. Get coordinates for the location
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.location',
      },
      body: JSON.stringify({ textQuery: location }),
    });
    
    const searchData = await searchRes.json();
    if (!searchData.places || searchData.places.length === 0) {
      console.log('Location not found');
      return;
    }
    
    const center = searchData.places[0].location;
    console.log('Center:', center);

    // 2. Search for nearby localities
    const nearbyRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({
        includedTypes: ['locality'],
        locationRestriction: {
          circle: {
            center,
            radius: radiusMeters
          }
        },
        maxResultCount: 20
      }),
    });

    const nearbyData = await nearbyRes.json();
    console.log('Nearby:', JSON.stringify(nearbyData, null, 2));

  } catch (e) {
    console.error(e);
  }
}

main();
