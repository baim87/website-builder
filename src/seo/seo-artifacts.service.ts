import { Injectable } from '@nestjs/common';

@Injectable()
export class SeoArtifactsService {
  generateSitemap(domain: string, pages: any[]): string {
    const baseUrl = `https://${domain}`;
    const date = new Date().toISOString().split('T')[0];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    for (const page of pages) {
      const url = page.slug === 'home' ? baseUrl : `${baseUrl}/${page.slug}`;
      xml += `  <url>\n`;
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${date}</lastmod>\n`;
      xml += `  </url>\n`;
    }
    
    xml += `</urlset>`;
    return xml;
  }

  generateRobotsTxt(domain: string): string {
    return `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml`;
  }

  generateJsonLd(businessContext: any, domain: string): any {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": businessContext.businessName || businessContext.trade,
      "url": `https://${domain}`,
      "telephone": businessContext.phone || "",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": businessContext.businessAddress || "",
      },
      "openingHours": businessContext.hours ? Object.entries(businessContext.hours).map(([day, hours]) => `${day} ${hours}`) : [],
    };
  }

  generateInternalLinks(pages: any[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const slugs = pages.map(p => p.slug);
    
    for (const slug of slugs) {
      map[slug] = slugs.filter(s => s !== slug);
    }
    
    return map;
  }
}
