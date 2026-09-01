"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const projectId = '34680b7f-b27f-40bc-8b1d-9c9328ddcfef';
    const pages = [
        {
            slug: 'services/kitchen-remodeling',
            sections: [
                {
                    id: 'hero-1',
                    type: 'PageHeaderSection',
                    content: { title: 'Kitchen Remodeling', backgroundImage: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d' }
                },
                {
                    id: 'details-1',
                    type: 'ServiceDetailsSection',
                    content: { overview: 'We provide expert kitchen remodeling services to transform your home.', whyChooseUs: ['Quality Craftsmanship', 'Timely Delivery'], process: ['Consultation', 'Design', 'Build'], cta: { heading: 'Ready for a new kitchen?', buttonText: 'Contact Us' } }
                }
            ]
        },
        {
            slug: 'locations/peoria-az',
            sections: [
                {
                    id: 'hero-2',
                    type: 'PageHeaderSection',
                    content: { title: 'Service Area: Peoria, AZ', backgroundImage: 'https://images.unsplash.com/photo-1449844908441-8829872d2607' }
                },
                {
                    id: 'locations-1',
                    type: 'ServiceDetailsSection',
                    content: { overview: 'Serving Peoria, Arizona and surrounding areas within 50 miles with top-notch remodeling services.', whyChooseUs: ['Local Experts', 'Licensed & Insured'], process: ['Consultation', 'Estimate', 'Remodel'], cta: { heading: 'Start your project in Peoria', buttonText: 'Contact Us' } }
                }
            ]
        }
    ];
    for (const p of pages) {
        console.log(`Injecting ${p.slug}...`);
        await prisma.page.upsert({
            where: { projectId_slug: { projectId, slug: p.slug } },
            create: { projectId, slug: p.slug, content: p.sections },
            update: { content: p.sections }
        });
    }
    console.log('Injected successfully.');
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=inject-missing.js.map