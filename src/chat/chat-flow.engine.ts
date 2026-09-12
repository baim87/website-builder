import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GooglePlacesService } from '../projects/google-places.service';
import { InterviewService } from '../interview/interview.service';
import { BusinessContextService } from '../projects/business-context.service';
import { BrandKitGeneratorSkill } from '../skills/impl/brand-kit-generator.skill';
import { BrandExtractionService } from '../assets/brand-extraction.service';
import { LogoGenerationService } from '../assets/logo-generation.service';
import { PortraitGenerationService } from '../assets/portrait-generation.service';
import { BUSINESS_FIELDS } from '../interview/constants/interview-fields.constant';

@Injectable()
export class ChatFlowEngine {
  private readonly logger = new Logger(ChatFlowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlaces: GooglePlacesService,
    private readonly interviewService: InterviewService,
    private readonly businessContext: BusinessContextService,
    private readonly brandKitGenerator: BrandKitGeneratorSkill,
    private readonly brandExtraction: BrandExtractionService,
    private readonly logoGeneration: LogoGenerationService,
    private readonly portraitGeneration: PortraitGenerationService,
  ) {}

  async *processMessage(projectId: string, content: string): AsyncGenerator<any, void, unknown> {
    const context = await this.businessContext.findByProjectId(projectId);
    const meta: any = context.interviewMetadata || {};
    const flow = meta.flowState || 'gbp';
    
    // Save user message to chat history
    await this.prisma.chatMessage.create({
      data: { projectId, role: 'user', content }
    });

    try {
      if (flow === 'gbp') {
        yield* this.handleGbpFlow(projectId, content, meta);
      } else if (flow === 'business') {
        yield* this.handleBusinessFlow(projectId, content);
      } else if (flow === 'brand') {
        yield* this.handleBrandFlow(projectId, content, meta);
      } else if (flow === 'portrait') {
        yield* this.handlePortraitFlow(projectId, content, meta);
      } else {
        yield { event: 'flow-complete', data: {} };
      }
    } catch (e: any) {
      this.logger.error(`Flow error: ${e.message}`, e.stack);
      yield { event: 'token', data: { token: `\n\n[System Error: ${e.message}]` } };
    }
  }

  private async updateMeta(projectId: string, updates: any) {
    const ctx = await this.businessContext.findByProjectId(projectId);
    const currentMeta = ctx.interviewMetadata || {};
    const newMeta = { ...(typeof currentMeta === 'object' ? currentMeta : {}), ...updates };
    
    await this.prisma.businessContext.update({
      where: { projectId },
      data: { interviewMetadata: newMeta }
    });
    return newMeta;
  }

  private async saveAssistantMsg(projectId: string, content: string, uiOptions?: any, uiUpload?: any) {
    await this.prisma.chatMessage.create({
      data: { 
        projectId, 
        role: 'assistant', 
        content,
        metadata: { uiOptions, uiUpload }
      }
    });
  }

  // ==========================================
  // PHASE 1: GBP
  // ==========================================
  private async *handleGbpFlow(projectId: string, content: string, meta: any): AsyncGenerator<any, void, unknown> {
    const state = meta.gbpState || 'initial';

    if (state === 'initial') {
      if (content.toLowerCase() === 'no') {
        await this.updateMeta(projectId, { flowState: 'business' });
        // Forward "no" to business flow (which ignores it and asks the first question)
        yield* this.handleBusinessFlow(projectId, "Let's start the business details manually.");
        return;
      }

      yield { event: 'token', data: { token: "Searching Google Places..." } };
      const results = await this.googlePlaces.scrapeGoogleBusinessProfile(content);

      if (results && results.length > 0) {
        await this.updateMeta(projectId, { gbpState: 'selecting', gbpResults: results });
        
        const text = "I found these businesses. Which one is yours?";
        const options = results.map((r: any, idx: number) => ({
          id: String(idx),
          label: r.businessName,
          description: r.businessAddress
        }));
        options.push({ id: 'none', label: "None of these", description: "Enter details manually" });

        await this.saveAssistantMsg(projectId, text, options);
        yield { event: 'token', data: { token: "\n\n" + text } };
        yield { event: 'ui-options', data: { options } };
      } else {
        await this.updateMeta(projectId, { flowState: 'business' });
        const text = "No matches found. No worries, we'll do it manually.";
        yield { event: 'token', data: { token: "\n\n" + text } };
        yield* this.handleBusinessFlow(projectId, "Start manual entry.");
      }
    } 
    else if (state === 'selecting') {
      if (content === 'none') {
        await this.updateMeta(projectId, { flowState: 'business' });
        yield* this.handleBusinessFlow(projectId, "Start manual entry.");
      } else {
        const idx = parseInt(content, 10);
        const results = meta.gbpResults || [];
        if (!isNaN(idx) && results[idx]) {
          const chosen = results[idx];
          await this.businessContext.upsert(projectId, chosen);
          await this.updateMeta(projectId, { flowState: 'business' });
          
          yield { event: 'token', data: { token: "Got it! I've saved your Google Business Profile details.\n\n" } };
          // Jump into business flow to ask remaining questions
          yield* this.handleBusinessFlow(projectId, "I have the GBP details, what's next?");
        } else {
          yield { event: 'token', data: { token: "Invalid selection. Please try again." } };
          yield { event: 'ui-options', data: { 
            options: results.map((r: any, i: number) => ({ id: String(i), label: r.businessName, description: r.businessAddress })).concat([{ id: 'none', label: 'None' }])
          }};
        }
      }
    }
  }

  // ==========================================
  // PHASE 2: BUSINESS DETAILS
  // ==========================================
  private async *handleBusinessFlow(projectId: string, content: string): AsyncGenerator<any, void, unknown> {
    const status = await this.interviewService.checkCompleteness(projectId, BUSINESS_FIELDS);
    
    if (status.complete) {
      await this.updateMeta(projectId, { flowState: 'brand', brandState: 'initial' });
      yield* this.handleBrandFlow(projectId, "Start brand flow", {});
      return;
    }

    const stream = this.interviewService.processMessage(projectId, content, status.missingFields);
    for await (const event of stream) {
      yield event;
    }

    // Check again after stream
    const finalStatus = await this.interviewService.checkCompleteness(projectId, BUSINESS_FIELDS);
    if (finalStatus.complete) {
      await this.updateMeta(projectId, { flowState: 'brand', brandState: 'initial' });
      yield { event: 'token', data: { token: "\n\nGreat! We have all the business details.\n\n" } };
      yield* this.handleBrandFlow(projectId, "Start brand flow", { brandState: 'initial' });
    }
  }

  // ==========================================
  // PHASE 3: BRAND
  // ==========================================
  private async *handleBrandFlow(projectId: string, content: string, meta: any): AsyncGenerator<any, void, unknown> {
    const state = meta.brandState || 'initial';
    const ctx = await this.businessContext.findByProjectId(projectId);
    const bName = ctx.businessName || 'your business';

    if (state === 'initial') {
      await this.updateMeta(projectId, { brandState: 'choosing' });
      const text = `Do you already have a brand for ${bName}?`;
      const options = [
        { id: 'A', label: 'Yes, I have a brand & logo' },
        { id: 'B', label: 'Yes, I have a brand but no logo' },
        { id: 'C', label: 'No, create everything from scratch' },
      ];
      await this.saveAssistantMsg(projectId, text, options);
      yield { event: 'token', data: { token: text } };
      yield { event: 'ui-options', data: { options } };
    }
    else if (state === 'choosing') {
      if (['A', 'B', 'C'].includes(content)) {
        await this.updateMeta(projectId, { brandState: `flow_${content}` });
        if (content === 'A') {
          const text = "Awesome. Please upload your logo:";
          await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: 'logo' });
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-upload', data: { type: 'image', purpose: 'logo' } };
        } else if (content === 'B') {
          await this.updateMeta(projectId, { brandQuestionsStep: 0, brandAnswers: {} });
          yield* this.askBrandQuestion(projectId, 0, 'B');
        } else if (content === 'C') {
          const text = "No problem! Let's build a premium brand from scratch. What general visual style, color palette, or mood do you want? (e.g. 'dark & cinematic with gold accents', or 'clean minimal blues')";
          await this.saveAssistantMsg(projectId, text);
          yield { event: 'token', data: { token: text } };
        }
      } else {
        yield { event: 'token', data: { token: "Please select A, B, or C." } };
      }
    }
    else if (state === 'flow_A') {
      if (content.startsWith('http')) {
        yield { event: 'token', data: { token: "Logo received! Extracting brand colors and fonts...\n" } };
        try {
          const extractedBrand = await this.brandExtraction.extractBrandFromLogo(content);
          yield { event: 'token', data: { token: `Extracted Primary Color: ${extractedBrand.colors.primary}\n\n` } };
          await this.updateMeta(projectId, { extractedBrand, brandQuestionsStep: 0, brandAnswers: {} });
          yield* this.askBrandQuestion(projectId, 0, 'A');
        } catch (e: any) {
          yield { event: 'token', data: { token: `Failed to extract logo: ${e.message}\n\n` } };
          await this.updateMeta(projectId, { brandQuestionsStep: 0, brandAnswers: {} });
          yield* this.askBrandQuestion(projectId, 0, 'A');
        }
      } else {
        // If not a URL, they might be answering a brand question if we already extracted
        if (meta.brandQuestionsStep !== undefined) {
          yield* this.handleBrandQuestionAnswer(projectId, content, meta, 'A');
        } else {
           yield { event: 'token', data: { token: "Please provide a valid logo URL or upload a file." } };
        }
      }
    }
    else if (state === 'flow_B') {
      yield* this.handleBrandQuestionAnswer(projectId, content, meta, 'B');
    }
    else if (state === 'flow_C') {
      yield { event: 'token', data: { token: "Generating 13-point Brand Kit...\n" } };
      try {
        const brandKitResult = await this.brandKitGenerator.execute({
          projectId,
          context: { businessContext: ctx, stylePrompt: content },
          metadata: { phase: 'pre-generation' }
        });
        const kit = brandKitResult.data;
        yield { event: 'token', data: { token: `Brand Kit generated!\nColors: ${kit.colors.primary}, ${kit.colors.secondary}\nSlogan: ${kit.slogan}\n\n` } };
        
        yield { event: 'token', data: { token: "Generating AI logo from Brand Kit...\n" } };
        const trade = ctx.trade || 'contractor';
        await this.logoGeneration.generateLogoAndFavicon(projectId, kit.brandName || bName, trade, kit.logoDirection + " " + JSON.stringify(kit.colors));
        yield { event: 'token', data: { token: `Logo generated successfully!\n\n` } };
        
        await this.prisma.businessContext.update({
          where: { projectId },
          data: { brandIdentityInputs: kit }
        });
        await this.updateMeta(projectId, { brandState: 'theme' });
        yield* this.askTheme(projectId);
      } catch (e: any) {
         yield { event: 'token', data: { token: `Error generating brand kit: ${e.message}\n` } };
      }
    }
    else if (state === 'theme') {
      const themes = [
        'editorial-luxury', 'modern-minimalist', 'soft-organic', 
        'dark-bento', 'awesomic', 'mercury', 'hyer-aviation', 'superpower', '11x-editorial'
      ];
      if (themes.includes(content)) {
        await this.prisma.businessContext.update({
          where: { projectId },
          data: { brandVoicePreference: content } // Save theme
        });
        await this.updateMeta(projectId, { flowState: 'portrait', portraitState: 'initial' });
        yield { event: 'token', data: { token: "Theme saved!\n\n" } };
        yield* this.handlePortraitFlow(projectId, "", {});
      } else {
        yield { event: 'token', data: { token: "Invalid theme." } };
      }
    }
  }

  private async *askBrandQuestion(projectId: string, step: number, branch: string): AsyncGenerator<any, void, unknown> {
    const qA = [
      "Do you have a slogan, and how would you describe your brand's personality, positioning, and target audience? (Or type 'skip')",
      "How would you describe your services, materials used, and key benefits? (Or type 'skip')",
      "What is the visual mood of your brand — lighting style, textures, atmosphere? (Or type 'skip')"
    ];
    const qB = [
      "Do you have a slogan, and how would you describe your brand's personality and target audience?",
      "What are your brand's color palette and typography/font preferences? (Share hex codes if you have them)",
      "How would you describe your services, materials used, and key benefits?",
      "What is the visual mood of your brand — lighting style, textures, atmosphere?"
    ];
    const questions = branch === 'A' ? qA : qB;
    
    if (step < questions.length) {
      const text = `[${step + 1}/${questions.length}] ${questions[step]}`;
      await this.updateMeta(projectId, { brandQuestionsStep: step });
      await this.saveAssistantMsg(projectId, text);
      yield { event: 'token', data: { token: text } };
    } else {
      // Finished questions
      const ctx = await this.businessContext.findByProjectId(projectId);
      const meta = ctx.interviewMetadata as any;
      const answers = meta.brandAnswers || {};
      
      if (branch === 'A' && meta.extractedBrand) {
        answers['primaryColor'] = meta.extractedBrand.colors.primary;
        answers['secondaryColor'] = meta.extractedBrand.colors.secondary;
        answers['headingFont'] = meta.extractedBrand.typography.headingFont;
      }
      
      if (branch === 'B') {
        yield { event: 'token', data: { token: "Generating AI logo...\n" } };
        const trade = ctx.trade || 'contractor';
        try {
          await this.logoGeneration.generateLogoAndFavicon(projectId, ctx.businessName || 'business', trade, JSON.stringify(answers));
          yield { event: 'token', data: { token: "Logo generated successfully!\n\n" } };
        } catch(e: any) {
          yield { event: 'token', data: { token: `Logo generation failed: ${e.message}\n\n` } };
        }
      }
      
      await this.prisma.businessContext.update({
        where: { projectId },
        data: { brandIdentityInputs: answers }
      });
      
      await this.updateMeta(projectId, { brandState: 'theme' });
      yield* this.askTheme(projectId);
    }
  }

  private async *handleBrandQuestionAnswer(projectId: string, content: string, meta: any, branch: string): AsyncGenerator<any, void, unknown> {
    const step = meta.brandQuestionsStep || 0;
    const answers = meta.brandAnswers || {};
    answers[`q${step + 1}`] = content;
    await this.updateMeta(projectId, { brandAnswers: answers });
    yield* this.askBrandQuestion(projectId, step + 1, branch);
  }

  private async *askTheme(projectId: string): AsyncGenerator<any, void, unknown> {
    const text = "Finally, which design theme would you prefer for your website?";
    const options = [
      { id: 'editorial-luxury', label: 'Editorial Luxury', description: 'Earthy, Magazine-style' },
      { id: 'modern-minimalist', label: 'Modern Minimalist', description: 'Crisp, High Contrast' },
      { id: 'soft-organic', label: 'Soft & Organic', description: 'Rounded, Warm' },
      { id: 'dark-bento', label: 'Dark Bento', description: 'Dark Mode, Structured' },
      { id: 'awesomic', label: 'Awesomic', description: 'Technical Marketplace' },
      { id: 'mercury', label: 'Mercury', description: 'Alpine Banking' },
      { id: 'hyer-aviation', label: 'Hyer Aviation', description: 'Luxury Travel Editorial' },
      { id: 'superpower', label: 'Superpower', description: 'Cinematic Health Tech' },
      { id: '11x-editorial', label: '11x', description: 'Cinematic Editorial Serif' },
    ];
    await this.saveAssistantMsg(projectId, text, options);
    yield { event: 'token', data: { token: text } };
    yield { event: 'ui-options', data: { options } };
  }

  // ==========================================
  // PHASE 4: PORTRAIT
  // ==========================================
  private async *handlePortraitFlow(projectId: string, content: string, meta: any): AsyncGenerator<any, void, unknown> {
    const state = meta.portraitState || 'initial';
    const ctx = await this.businessContext.findByProjectId(projectId);

    if (state === 'initial') {
      await this.updateMeta(projectId, { portraitState: 'uploading' });
      const contact = ctx.contactPerson || 'the owner';
      const text = `Got a photo of ${contact} to generate a professional portrait for the About section?`;
      const options = [{ id: 'skip', label: 'Skip' }];
      await this.saveAssistantMsg(projectId, text, options, { type: 'image', purpose: 'portrait' });
      yield { event: 'token', data: { token: text } };
      yield { event: 'ui-upload', data: { type: 'image', purpose: 'portrait' } };
      yield { event: 'ui-options', data: { options } };
    } 
    else if (state === 'uploading') {
      if (content === 'skip') {
        yield* this.triggerGeneration(projectId);
      } else if (content.startsWith('http')) {
        yield { event: 'token', data: { token: "Generating professional portrait...\n" } };
        try {
          await this.portraitGeneration.generatePortrait(projectId, ctx.trade || 'contractor', content);
          yield { event: 'token', data: { token: "Portrait generated successfully!\n\n" } };
        } catch(e: any) {
          yield { event: 'token', data: { token: `Portrait generation failed: ${e.message}\n\n` } };
        }
        yield* this.triggerGeneration(projectId);
      }
    }
  }

  private async *triggerGeneration(projectId: string): AsyncGenerator<any, void, unknown> {
    await this.updateMeta(projectId, { flowState: 'complete' });
    const text = "All done! I am now generating your high-converting website in the background...";
    await this.saveAssistantMsg(projectId, text);
    yield { event: 'token', data: { token: text } };
    yield { event: 'flow-complete', data: {} };
  }
}
