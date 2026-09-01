"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeoArtifactsService = void 0;
const common_1 = require("@nestjs/common");
let SeoArtifactsService = class SeoArtifactsService {
    generateSitemap(domain, pages) {
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
    generateRobotsTxt(domain) {
        return `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml`;
    }
    generateJsonLd(businessContext, domain) {
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
    generateInternalLinks(pages) {
        const map = {};
        const slugs = pages.map(p => p.slug);
        for (const slug of slugs) {
            map[slug] = slugs.filter(s => s !== slug);
        }
        return map;
    }
};
exports.SeoArtifactsService = SeoArtifactsService;
exports.SeoArtifactsService = SeoArtifactsService = __decorate([
    (0, common_1.Injectable)()
], SeoArtifactsService);
//# sourceMappingURL=seo-artifacts.service.js.map