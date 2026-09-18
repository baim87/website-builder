import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const models = [
  'bytedance-seed/seedream-4.5',
  'recraft/recraft-v4.1-vector', // Recraft is great for vector logos
  'google/gemini-3-pro-image', // User requested, might not exist.
  'openai/dall-e-3' // fallback in case others fail
];

const prompt = "A modern, professional vector logo for a high-end interior remodeling contractor based in Peoria, AZ. The logo should be clean, minimal, using flat colors on a pure white background. It should convey trust, craftsmanship, and premium quality without being overly complex.";

async function runTest() {
  const results = [];
  console.log("Starting logo generation tests...\n");

  for (const model of models) {
    console.log(`Testing model: ${model}...`);
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Contractor Builder Test',
            'Content-Type': 'application/json'
          }
        }
      );

      const message = response.data.choices[0].message;
      let content = message.content || "";
      
      let cost = 0;
      if (response.data.usage && response.data.usage.cost !== undefined) {
          cost = response.data.usage.cost;
      } else if (response.data.usage && response.data.usage.total_cost !== undefined) {
          cost = response.data.usage.total_cost;
      }
      
      let imageUrl = '';
      if (message.images && message.images.length > 0) {
        imageUrl = message.images[0].image_url.url;
      } else {
        const urlMatch = content.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
        if (urlMatch && urlMatch[1]) {
          imageUrl = urlMatch[1];
        } else if (content.startsWith("http")) {
          imageUrl = content.trim();
        }
      }

      if (imageUrl) {
        console.log(`Success! Downloading image... Cost: $${cost}`);
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const ext = imageUrl.includes('.webp') ? 'webp' : 'png';
        const filename = `${model.replace(/[^a-zA-Z0-9]/g, '_')}_logo.${ext}`;
        const outPath = path.join(process.cwd(), filename);
        fs.writeFileSync(outPath, Buffer.from(imgRes.data));
        console.log(`Saved to ${filename}`);
        
        results.push({ model, cost, filename, content });
      } else {
        console.log(`Failed to extract image URL from response. Raw content:\n${content}`);
        results.push({ model, cost, error: "No image URL in response", content });
      }

    } catch (e: any) {
      console.error(`Failed to generate with ${model}: ${e.response?.data?.error?.message || e.message}`);
      results.push({ model, cost: 0, error: e.response?.data?.error?.message || e.message });
    }
    console.log("--------------------------------------------------\n");
  }

  // Generate markdown report
  let md = "# Logo Generation Test Results\n\n";
  for (const res of results) {
    md += `## Model: ${res.model}\n`;
    md += `- **Cost**: $${res.cost}\n`;
    if (res.filename) {
      md += `- **Result**: \n\n![${res.model} logo](file://${process.cwd()}/${res.filename})\n\n`;
    } else {
      md += `- **Error**: ${res.error}\n\n`;
      if (res.content) {
        md += `- **Raw Output**: \n\`\`\`\n${res.content}\n\`\`\`\n\n`;
      }
    }
  }

  const outPath = '/Users/baim/.gemini/antigravity-ide/brain/fb4d1d46-c8d2-47e8-9f35-862076599a86/logo_test_results.md';
  fs.writeFileSync(outPath, md);
  console.log(`Done! Check ${outPath}`);
}

runTest();
