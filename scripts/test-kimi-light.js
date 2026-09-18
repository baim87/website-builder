const fs = require('fs');

async function testKimi() {
  const baseUrl = 'https://ollama.com';
  // Read token from .env
  const envFile = fs.readFileSync('.env', 'utf-8');
  let apiKey = '';
  const match = envFile.match(/OLLAMA_CLOUD_API_KEY=["']?([^"'\n]+)/);
  if (match) {
    apiKey = match[1];
  } else {
    console.error('OLLAMA_CLOUD_API_KEY not found in .env');
    return;
  }

  const prompt = `
  You are an expert copywriter. Generate a JSON object for a HeroSection.
  The JSON must have the following schema:
  {
    "headline": "Main headline string",
    "subheadline": "Supporting subheadline string",
    "primaryCtaText": "Call to action text",
    "primaryCtaLink": "/contact"
  }
  `;

  console.log('Testing kimi-k2.6:cloud generation...');
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kimi-k2.6:cloud',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    console.log('\n--- SUCCESS ---');
    console.log(data.choices[0]?.message?.content);
    console.log('Usage:', data.usage);
  } catch (e) {
    console.error('\n--- ERROR ---');
    console.error(e.message);
  }
}

testKimi();
