const fetch = require('node-fetch');
const query = "Dek bros";
const apiKey = process.env.GOOGLE_PLACES_API_KEY;

async function run() {
  const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
  const searchBody = {
    textQuery: query,
    regionCode: 'US'
  };

  const searchResponse = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(searchBody),
  });
  console.log(await searchResponse.json());
}
run();
