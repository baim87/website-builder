import * as fs from 'fs';

import 'dotenv/config';

async function testScreenshot() {
  const url = 'https://offcut-interiors-home-remodeling-0d.vercel.app/';
  const strategy = 'mobile';
  

  const apiKey = 'AIzaSyC19sKp9NFm1-qkwp_HdHgt6A_LLHtGO3o';

  console.log(`Fetching Lighthouse report for ${url}... This usually takes 15-30 seconds.`);
  
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
    + `?url=${encodeURIComponent(url)}`
    + `&strategy=${strategy}`
    + `&category=performance&category=accessibility&category=seo&category=best-practices`
    + `&key=${apiKey}`
    + `&category=performance&category=accessibility&category=seo&category=best-practices`;

  try {
    const response = await fetch(apiUrl);
    const result = await response.json() as any;
    
    if (result.error) {
      console.error('API Error:', result.error.message);
      return;
    }

    const categories = result.lighthouseResult.categories;
    console.log('--- SCORES ---');
    console.log(`Performance: ${Math.round(categories.performance.score * 100)}`);
    console.log(`Accessibility: ${Math.round(categories.accessibility.score * 100)}`);
    console.log(`SEO: ${Math.round(categories.seo.score * 100)}`);
    console.log(`Best Practices: ${Math.round(categories['best-practices'].score * 100)}`);

    const screenshotData = result.lighthouseResult.audits['final-screenshot']?.details?.data;
    
    if (screenshotData) {
      // It's a base64 data URL: data:image/jpeg;base64,....
      const base64Image = screenshotData.replace(/^data:image\/\w+;base64,/, '');
      const outPath = '/Users/baim/.gemini/antigravity-ide/brain/c4481252-b2df-4975-bea5-0aa7850cab12/scratch/lighthouse-screenshot.jpg';
      
      fs.writeFileSync(outPath, Buffer.from(base64Image, 'base64'));
      console.log(`\nScreenshot saved to: ${outPath}`);
    } else {
      console.log('\nNo screenshot data found in the report.');
    }

  } catch (error) {
    console.error('Failed to fetch:', error);
  }
}

testScreenshot();
