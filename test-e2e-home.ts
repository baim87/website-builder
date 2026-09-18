import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { GenerationOrchestratorService } from './src/generation/generation-orchestrator.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  console.log("Bootstrapping NestJS Context for Full E2E Test...");
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const orchestrator = app.get(GenerationOrchestratorService);
  const prisma = app.get(PrismaService);

  const mockUser = await prisma.user.upsert({
    where: { email: 'e2e-test@example.com' },
    update: {},
    create: {
      email: 'e2e-test@example.com',
    }
  });

  const mockProject = await prisma.project.create({
    data: {
      userId: mockUser.id,
      name: 'E2E Contractor Demo',
      status: 'PENDING'
    }
  });

  // This perfectly mimics the data sent from the Next.js frontend onboarding
  const mockOnboardingBusinessContext = {
    businessName: "Elite Deck Builders",
    trade: "Deck Building",
    location: "Seattle",
    state: "WA",
    county: "King County",
    services: ["Custom Decks", "Deck Repair"],
    serviceAreas: ["Seattle", "Bellevue", "Redmond"],
    brandIdentityInputs: {
      themePreference: "modern-minimalist"
    },
    // Required base fields
    address: "123 Main St, Seattle, WA",
    phone: "555-0100",
    email: "contact@elitedecks.example"
  };

  console.log(`Starting GenerationOrchestratorService for Project: ${mockProject.id}`);
  console.log("Targeting ONLY the 'home' page for speed...");
  
  try {
    const result = await orchestrator.generateWebsite(
      mockProject.id, 
      mockOnboardingBusinessContext,
      async (page) => {
        console.log(`\n✅ Callback Fired: Page [${page.slug}] generated successfully!`);
      },
      undefined, 
      ['home'] // <--- We only target home to make this test finish quickly
    );

    console.log("\n================ E2E GENERATION RESULT ================\n");
    console.log(`Generated ${result.pages.length} pages.`);
    if (result.pages.length > 0) {
      console.log("Sections included on Home Page:");
      result.pages[0].sections.forEach((s: any, idx: number) => {
        console.log(`${idx + 1}. ${s.type} (Block IDs mapped: ${s.ast?.props?.data?._blockIds ? 'YES' : 'NO'})`);
      });
      console.log("\nSample code from first generated custom component:");
      if (result.pages[0].componentCode) {
        const firstCompName = Object.keys(result.pages[0].componentCode)[0];
        console.log(`Component Name: ${firstCompName}`);
        console.log("--- Snippet ---");
        console.log(result.pages[0].componentCode[firstCompName].substring(0, 500) + '...');
      }
    }
    console.log("\n=======================================================\n");

  } catch (error) {
    console.error("E2E Test Failed:", error);
  } finally {
    // Cleanup
    await prisma.project.delete({ where: { id: mockProject.id } });
    await app.close();
    process.exit(0);
  }
}

bootstrap();
