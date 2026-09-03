import { Client } from '@googlemaps/google-maps-services-js';
import 'dotenv/config';

async function testGoogleMaps() {
  const client = new Client({});
  const baseLocation = 'Peoria, AZ';
  
  try {
    const geoRes = await client.geocode({
      params: { address: baseLocation, key: process.env.GOOGLE_PLACES_API_KEY! }
    });
    const { lat, lng } = geoRes.data.results[0].geometry.location;
    const radiusMeters = 20 * 1609.34;

    const textRes = await client.textSearch({
      params: {
        query: `cities and towns near ${baseLocation}`,
        location: { lat, lng },
        radius: radiusMeters,
        key: process.env.GOOGLE_PLACES_API_KEY!,
      }
    });

    for (const place of textRes.data.results) {
      console.log(`Name: ${place.name}, Types: ${place.types}`);
    }
  } catch (e: any) {
    console.error(e.response ? e.response.data : e.message);
  }
}

testGoogleMaps();
