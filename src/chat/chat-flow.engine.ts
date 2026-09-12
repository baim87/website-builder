import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterviewService } from '../interview/interview.service';
import { BusinessContextService } from '../projects/business-context.service';
import { ONBOARDING_FLOW_CONFIG, getFieldKeys } from '../interview/constants/onboarding-flow.config';
import { GooglePlacesService } from '../projects/google-places.service';
import { BrandKitGeneratorSkill } from '../skills/impl/brand-kit-generator.skill';
import { BrandExtractionService } from '../assets/brand-extraction.service';
import { LogoGenerationService } from '../assets/logo-generation.service';
import { PortraitGenerationService } from '../assets/portrait-generation.service';
import { ServiceSuggestionService } from '../keywords/service-suggestion.service';
import { SecondaryKeywordWorker } from '../keywords/secondary-keyword.worker';
import { GenerationProducer } from '../queue/producers/generation.producer';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AIModel } from '../common/constants/ai-models.constant';

@Injectable()
export class ChatFlowEngine {
  private readonly logger = new Logger(ChatFlowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interviewService: InterviewService,
    private readonly businessContext: BusinessContextService,
    private readonly googlePlaces: GooglePlacesService,
    private readonly brandKitGenerator: BrandKitGeneratorSkill,
    private readonly brandExtraction: BrandExtractionService,
    private readonly logoGeneration: LogoGenerationService,
    private readonly portraitGeneration: PortraitGenerationService,
    private readonly serviceSuggestionService: ServiceSuggestionService,
    private readonly secondaryKeywordWorker: SecondaryKeywordWorker,
    private readonly generationProducer: GenerationProducer,
    private readonly aiGateway: AIGatewayService,
  ) {}

  async *processMessage(projectId: string, content: string, displayText?: string): AsyncGenerator<any, void, unknown> {
    this.logger.log(`[ChatFlowEngine] Processing message for project ${projectId} (Length: ${content.length})`);
    const context = await this.businessContext.findByProjectId(projectId);
    const meta: any = context.interviewMetadata || {};
    const stepIndex = meta.stepIndex || 0;
    
    if (content.trim()) {
      await this.prisma.chatMessage.create({
        data: { projectId, role: 'user', content: displayText || content }
      });
    }

    try {
      if (stepIndex >= ONBOARDING_FLOW_CONFIG.length) {
        yield* this.triggerGeneration(projectId);
        return;
      }

      const currentStep = ONBOARDING_FLOW_CONFIG[stepIndex];
      yield { event: 'flow-state', data: { state: currentStep.id } };

      if (currentStep.customHandler) {
        // Delegate to custom handler
        const handlerName = currentStep.customHandler as keyof this;
        const handler = this[handlerName] as any;
        if (typeof handler === 'function') {
          yield* handler.bind(this)(projectId, content, meta, currentStep, stepIndex);
        } else {
          this.logger.error(`Handler ${currentStep.customHandler} not found!`);
        }
      } else {
        // Generic AI Loop
        yield* this.handleGenericFlow(projectId, content, currentStep, stepIndex);
      }
    } catch (e: any) {
      this.logger.error(`Flow error: ${e.message}`, e.stack);
      yield { event: 'token', data: { token: `\n\n[System Error: ${e.message}]` } };
    }
  }

  private async *handleGenericFlow(projectId: string, content: string, currentStep: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const context = await this.businessContext.findByProjectId(projectId);
    const meta = (context.interviewMetadata || {}) as any;
    const state = meta[`${currentStep.id}_state`] || 'initial';

    if (state === 'confirming') {
      if (content === 'yes') {
        await this.updateMeta(projectId, { [`${currentStep.id}_state`]: 'confirmed' });
        yield* this.advanceToNextStep(projectId, stepIndex);
        return;
      } else if (content === 'edit') {
        await this.updateMeta(projectId, { [`${currentStep.id}_state`]: 'editing' });
        const text = "No problem! What would you like to change or fix?";
        await this.saveAssistantMsg(projectId, text);
        yield { event: 'token', data: { token: text } };
        return;
      } else {
        yield { event: 'token', data: { token: "Please select 'Yes' or 'No'." } };
        return;
      }
    }

    const status = await this.interviewService.checkCompleteness(projectId, getFieldKeys(currentStep));
    
    if (status.complete && state !== 'editing') {
      if (state !== 'confirmed') {
        yield* this.showConfirmationSummary(projectId, currentStep);
      } else {
        yield* this.advanceToNextStep(projectId, stepIndex);
      }
      return;
    }

    const stream = this.interviewService.processMessage(projectId, content, status.missingFields, currentStep);
    for await (const event of stream) {
      yield event;
    }

    const finalStatus = await this.interviewService.checkCompleteness(projectId, getFieldKeys(currentStep));
    
    // Intercept when the next missing field is 'services' to suggest options
    if (!finalStatus.complete && finalStatus.missingFields[0] === 'services') {
      const ctx = await this.businessContext.findByProjectId(projectId);
      if (ctx.trade && ctx.location) {
        yield { event: 'thinking-status', data: { message: 'Fetching Google Ads Keyword Data...' } };
        
        try {
          const suggestions = await this.serviceSuggestionService.getServiceSuggestions(projectId, ctx.trade, ctx.location);
          
          yield {
            event: 'ui-multi-select',
            data: {
              options: suggestions.map(s => ({
                id: s.service,
                label: s.service,
                description: s.searchVolume > 0
                  ? `${s.searchVolume.toLocaleString()} monthly searches`
                  : `< 10 monthly searches`,
              })),
              confirmLabel: 'Confirm Services',
              allowCustom: true,
              customPlaceholder: 'Add more services (comma separated)',
            }
          };
        } catch (e: any) {
          this.logger.error(`Failed to generate service suggestions: ${e.message}`);
        }
      }
    }

    if (finalStatus.complete) {
      if (state === 'confirmed') {
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else {
        // We just completed everything, show summary
        yield* this.showConfirmationSummary(projectId, currentStep);
      }
    } else if (state === 'editing') {
      // If we were editing, and it's still not complete (or it is complete), reset back to confirming to show the new summary
      if (finalStatus.complete) {
        yield* this.showConfirmationSummary(projectId, currentStep);
      }
    }
  }

  private async *showConfirmationSummary(projectId: string, currentStep: any): AsyncGenerator<any, void, unknown> {
    await this.updateMeta(projectId, { [`${currentStep.id}_state`]: 'confirming' });
    const ctx = await this.businessContext.findByProjectId(projectId) as any;
    
    let summaryText = `**Let's confirm your details before we move on:**\n\n`;
    summaryText += `| Question | Your Answer |\n`;
    summaryText += `|---|---|\n`;
    for (const field of currentStep.fields) {
      const val = ctx[field.key];
      let displayVal = val;
      if (Array.isArray(val)) {
        displayVal = val.join(', ');
      }
      // sanitize newlines in displayVal since markdown tables cannot have newlines in rows
      const sanitizedVal = typeof displayVal === 'string' ? displayVal.replace(/\n/g, '<br/>') : (displayVal || 'Not provided');
      summaryText += `| ${field.question} | **${sanitizedVal}** |\n`;
    }
    
    if (currentStep.id === 'business' && ctx.serviceAreas && Array.isArray(ctx.serviceAreas) && ctx.serviceAreas.length > 0) {
      summaryText += `| Service Areas / Cities | **${ctx.serviceAreas.join(', ')}** |\n`;
    }

    summaryText += `\nIs everything correct?`;

    const options = [
      { id: 'yes', label: 'Yes, looks good' },
      { id: 'edit', label: 'No, I need to change something' }
    ];

    await this.saveAssistantMsg(projectId, summaryText, options);
    yield { event: 'token', data: { token: `\n\n${summaryText}` } };
    yield { event: 'ui-options', data: { options } };
  }

  // ==========================================
  // Custom Handlers
  // ==========================================

  public async *handleGbpFlow(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const state = meta[`${step.id}_state`] || 'initial';

    if (state === 'initial') {
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'choosing_has_gbp' });
      await this.saveAssistantMsg(projectId, step.initialMessage, step.uiOptions);
      yield { event: 'token', data: { token: step.initialMessage } };
      yield { event: 'ui-options', data: { options: step.uiOptions } };
    } else if (state === 'choosing_has_gbp') {
      if (content === 'no' || content === 'skip') {
        yield* this.advanceToNextStep(projectId, stepIndex, "[SYSTEM: Proceed directly to ask the first missing field without preamble.]");
        return;
      } else if (content === 'yes') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'searching' });
        const text = "Great! What is the name of your business?";
        await this.saveAssistantMsg(projectId, text);
        yield { event: 'token', data: { token: text } };
      } else {
        // Direct search if user just typed the business name
        yield* this.doGbpSearch(projectId, content, meta, step, stepIndex);
      }
    } else if (state === 'searching') {
      if (content === 'skip') {
        yield* this.advanceToNextStep(projectId, stepIndex, "[SYSTEM: Proceed directly to ask the first missing field without preamble.]");
        return;
      }
      yield* this.doGbpSearch(projectId, content, meta, step, stepIndex);
    } else if (state === 'selecting') {
      if (content === 'none') {
        yield* this.advanceToNextStep(projectId, stepIndex, "[SYSTEM: Proceed directly to ask the first missing field without preamble.]");
      } else {
        const idx = parseInt(content, 10);
        const results = meta.gbpResults || [];
        if (!isNaN(idx) && results[idx]) {
          const chosen = results[idx];
          await this.businessContext.upsert(projectId, chosen);
          
          if (chosen.trade) {
            await this.updateMeta(projectId, { [`${step.id}_state`]: 'confirming_trade', chosenTrade: chosen.trade });
            const text = `Based on your Google Business Profile, your primary trade is **${chosen.trade}**. Is this correct?`;
            const options = [
              { id: 'yes', label: 'Yes, that is correct' },
              { id: 'no', label: 'No, I need to change it' }
            ];
            await this.saveAssistantMsg(projectId, text, options);
            yield { event: 'token', data: { token: text } };
            yield { event: 'ui-options', data: { options } };
          } else {
            yield* this.advanceToNextStep(projectId, stepIndex, "[SYSTEM: GBP details imported successfully. Proceed directly to ask the next missing field without preamble.]");
          }
        } else {
          yield { event: 'token', data: { token: "Invalid selection. Please try again." } };
          const options = results.map((r: any, i: number) => ({ id: String(i), label: r.businessName, description: r.businessAddress })).concat([{ id: 'none', label: 'None' }]);
          yield { event: 'ui-options', data: { options } };
        }
      }
    } else if (state === 'confirming_trade') {
      if (content === 'yes') {
        yield* this.advanceToNextStep(projectId, stepIndex, "[SYSTEM: Trade confirmed. Proceed directly to ask the next missing field without preamble.]");
      } else if (content === 'no') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'editing_trade' });
        const text = "What is your actual primary trade? (e.g. Decking, Roofing, Remodeling)";
        await this.saveAssistantMsg(projectId, text);
        yield { event: 'token', data: { token: text } };
      } else {
        yield { event: 'token', data: { token: "Please select Yes or No." } };
      }
    } else if (state === 'editing_trade') {
      await this.businessContext.upsert(projectId, { trade: content });
      yield* this.advanceToNextStep(projectId, stepIndex, `[SYSTEM: User updated their trade to ${content}. Proceed directly to ask the next missing field without preamble.]`);
    }
  }

  private async *doGbpSearch(projectId: string, content: string, _meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    yield { event: 'token', data: { token: "Searching Google Places..." } };
    const results = await this.googlePlaces.scrapeGoogleBusinessProfile(content);

    if (results && results.length > 0) {
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'selecting', gbpResults: results });
      const text = "I found these businesses. Which one is yours?";
      const options = results.map((r: any, idx: number) => ({
        id: String(idx), label: r.businessName, description: r.businessAddress
      }));
      options.push({ id: 'none', label: "None of these", description: "Enter details manually" });
      await this.saveAssistantMsg(projectId, text, options);
      yield { event: 'token', data: { token: "\n\n" + text } };
      yield { event: 'ui-options', data: { options } };
    } else {
      const text = "No matches found. No worries, we'll do it manually.";
      yield { event: 'token', data: { token: "\n\n" + text } };
      yield* this.advanceToNextStep(projectId, stepIndex, "Start manual entry.");
    }
  }

  public async *handleBrandStrategy(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const state = meta[`${step.id}_state`] || 'initial';

    if (state === 'initial') {
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'choosing' });
      await this.saveAssistantMsg(projectId, step.initialMessage, step.uiOptions);
      yield { event: 'token', data: { token: step.initialMessage } };
      yield { event: 'ui-options', data: { options: step.uiOptions } };
    } else if (state === 'choosing') {
      if (content === 'has-logo') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'uploading-logo' });
        const text = "Awesome. Please upload your logo:";
        await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: 'logo' });
        yield { event: 'token', data: { token: text } };
        yield { event: 'ui-upload', data: { type: 'image', purpose: 'logo' } };
      } else if (content === 'no-logo') {
        await this.updateMeta(projectId, { brandBranch: 'B' });
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else if (content === 'scratch') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'prompting-scratch' });
        const text = "No problem! Let's build a premium brand from scratch. What general visual style, color palette, or mood do you want? (e.g. 'dark & cinematic with gold accents', or 'clean minimal blues')";
        await this.saveAssistantMsg(projectId, text);
        yield { event: 'token', data: { token: text } };
      } else {
        yield { event: 'token', data: { token: "Please select a valid option." } };
      }
    } else if (state === 'uploading-logo') {
      if (content.startsWith('http')) {
        yield { event: 'token', data: { token: "Logo received! Extracting brand colors and fonts...\n" } };
        try {
          const extractedBrand = await this.brandExtraction.extractBrandFromLogo(content);
          
          const getSwatch = (hex: string) => `<span style="display:inline-block;width:16px;height:16px;background-color:${hex};border-radius:50%;border:1px solid rgba(255,255,255,0.2);vertical-align:-3px;margin-right:6px;"></span>${hex}`;
          
          yield { event: 'token', data: { token: `Extracted Details:\n- **Primary Color:** ${getSwatch(extractedBrand.colors.primary)}\n- **Secondary Color:** ${getSwatch(extractedBrand.colors.secondary)}\n- **Fonts:** ${extractedBrand.typography.headingFont} & ${extractedBrand.typography.bodyFont}\n\n` } };
          await this.updateMeta(projectId, { extractedBrand, brandBranch: 'A', [`${step.id}_state`]: 'uploading-favicon' });
          
          const text = "Great! Please upload your favicon (the small icon that appears in the browser tab), or type 'skip':";
          await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: 'favicon' });
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-upload', data: { type: 'image', purpose: 'favicon' } };
        } catch (e: any) {
          yield { event: 'token', data: { token: `Failed to extract logo: ${e.message}\n\n` } };
          await this.updateMeta(projectId, { brandBranch: 'A', [`${step.id}_state`]: 'uploading-favicon' });
          
          const text = "Please upload your favicon (the small icon that appears in the browser tab), or type 'skip':";
          await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: 'favicon' });
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-upload', data: { type: 'image', purpose: 'favicon' } };
        }
      } else {
        yield { event: 'token', data: { token: "Please provide a valid logo URL or upload a file." } };
      }
    } else if (state === 'uploading-favicon') {
      if (content.startsWith('http')) {
        yield { event: 'token', data: { token: "Favicon received!\n\n" } };
        // Save it or just let the asset system handle it, then advance
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else if (content.toLowerCase() === 'skip') {
        yield { event: 'token', data: { token: "Skipping favicon.\n\n" } };
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else {
        yield { event: 'token', data: { token: "Please provide a valid favicon URL, upload a file, or type 'skip'." } };
      }
    } else if (state === 'prompting-scratch') {
      yield { event: 'thinking', data: { message: "Generating 13-point Brand Kit..." } };
      try {
        const ctx = await this.businessContext.findByProjectId(projectId);
        const brandKitResult = await this.brandKitGenerator.execute({ projectId, context: { businessContext: ctx, stylePrompt: content }, metadata: { phase: 'pre-generation' } });
        const kit = brandKitResult.data;
        
        yield { event: 'thinking', data: { message: "Generating AI logo from Brand Kit..." } };
        await this.logoGeneration.generateLogoAndFavicon(projectId, kit.brandName || ctx.businessName || 'business', ctx.trade || 'contractor', kit.logoDirection + " " + JSON.stringify(kit.colors));
        
        await this.prisma.businessContext.update({ where: { projectId }, data: { brandIdentityInputs: kit } });
        
        // Skip brand-identity questions entirely, jump to theme
        yield* this.advanceToNextStep(projectId, stepIndex + 1);
      } catch (e: any) {
        yield { event: 'token', data: { token: `Error generating brand kit: ${e.message}\n` } };
      }
    }
  }

  public async *handleBrandIdentity(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    let qIndex = meta[`${step.id}_qIndex`] || 0;
    let answers = meta.brandAnswers || {};
    const branch = meta.brandBranch || 'A';
    const questions = branch === 'A' ? step.branchAQuestions : step.branchBQuestions;
    const isConfirmingSuggestion = meta[`${step.id}_confirming_suggestion`];
    const suggestionText = meta[`${step.id}_suggestion_text`];

    if (content && meta[`${step.id}_asked`]) {
      if (isConfirmingSuggestion) {
         if (content === 'yes') {
            answers[`q${qIndex + 1}`] = suggestionText;
            await this.updateMeta(projectId, { 
               brandAnswers: answers, 
               [`${step.id}_qIndex`]: qIndex + 1,
               [`${step.id}_confirming_suggestion`]: false
            });
            qIndex = qIndex + 1;
         } else if (content === 'no') {
            await this.updateMeta(projectId, { [`${step.id}_confirming_suggestion`]: false });
            // Will re-ask the current question below
         } else {
            yield { event: 'token', data: { token: "Please select Yes or No." } };
            return;
         }
      } else {
         const needsSuggestion = /(suggest|don'?t know|no idea|not sure|you choose|decide for me|whatever)/i.test(content);
         
         if (needsSuggestion) {
            yield { event: 'thinking', data: { message: "Drafting a suggestion..." } };
            
            const ctx = await this.businessContext.findByProjectId(projectId);
            const prompt = `You are an expert brand strategist. 
Business: ${ctx.businessName || 'Unknown'}, Trade: ${ctx.trade || 'General Contractor'}, Location: ${ctx.location || 'Unknown'}
Target Question: "${questions[qIndex]}"

The user doesn't know the answer and asked for a suggestion.
Provide a concise, professional, and highly specific suggestion (1-2 sentences) that perfectly fits their business context. Do not include introductory or concluding filler. Just the suggestion itself. DO NOT use any markdown formatting (no headers, no bold text). Output plain text only.`;

            const aiResult = await this.aiGateway.generateText(AIModel.CLAUDE_HAIKU_4_5, {
              messages: [{ role: 'user', content: prompt }]
            });
            
            // Clean up any rogue markdown just in case
            const suggestion = aiResult.text.replace(/^#.*?\n/gm, '').replace(/\*\*/g, '').trim();
            
            await this.updateMeta(projectId, { 
               [`${step.id}_confirming_suggestion`]: true,
               [`${step.id}_suggestion_text`]: suggestion 
            });
            
            const text = `How about this?\n\n> ${suggestion}\n\nDoes this sound good to you?`;
            const options = [
              { id: 'yes', label: 'Yes, use this' },
              { id: 'no', label: 'No, let me answer manually' }
            ];
            
            await this.saveAssistantMsg(projectId, text, options);
            yield { event: 'token', data: { token: text } };
            yield { event: 'ui-options', data: { options } };
            return;
         } else {
            answers[`q${qIndex + 1}`] = content;
            await this.updateMeta(projectId, { brandAnswers: answers, [`${step.id}_qIndex`]: qIndex + 1 });
            qIndex = qIndex + 1;
         }
      }
    }

    if (qIndex < questions.length) {
      let q = questions[qIndex];
      // Dropping the [1/3] prefix as requested
      const text = q;
      await this.updateMeta(projectId, { [`${step.id}_asked`]: true });
      await this.saveAssistantMsg(projectId, text);
      yield { event: 'token', data: { token: text } };
    } else {
      await this.updateMeta(projectId, { [`${step.id}_asked`]: false });
      yield* this.advanceToNextStep(projectId, stepIndex);
    }
  }

  public async *handleThemeSelection(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const state = meta[`${step.id}_state`] || 'initial';
    if (state === 'initial') {
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'choosing' });
      await this.saveAssistantMsg(projectId, step.initialMessage, step.uiOptions);
      yield { event: 'token', data: { token: step.initialMessage } };
      yield { event: 'ui-options', data: { options: step.uiOptions } };
    } else if (state === 'choosing') {
      const valid = step.uiOptions.some((o: any) => o.id === content);
      if (valid) {
        await this.prisma.businessContext.update({ where: { projectId }, data: { brandVoicePreference: content } });
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else {
        yield { event: 'token', data: { token: "Invalid theme." } };
      }
    }
  }

  public async *handleBrandRecap(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const state = meta[`${step.id}_state`] || 'initial';
    const ctx = await this.businessContext.findByProjectId(projectId);

    if (state === 'initial') {
      const contact = ctx.contactPerson || 'the owner';
      const initialMsg = `Got a photo of ${contact} to generate a professional portrait for the About section?`;
      
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'uploading_portrait' });
      
      const uiOptions = [{ id: 'skip', label: 'Skip this step' }];
      const uiUpload = { type: 'image', purpose: 'portrait' };
      
      await this.saveAssistantMsg(projectId, initialMsg, uiOptions, uiUpload);
      yield { event: 'token', data: { token: initialMsg } };
      yield { event: 'ui-upload', data: uiUpload };
      yield { event: 'ui-options', data: { options: uiOptions } };
    } else if (state === 'uploading_portrait') {
      if (content === 'skip') {
        await this.updateMeta(projectId, { portraitStatus: 'Skipped', [`${step.id}_state`]: 'confirming' });
        yield* this.renderBrandRecap(projectId, meta, ctx, 'Skipped');
      } else if (content.startsWith('http')) {
        yield { event: 'thinking', data: { message: "Generating professional portrait..." } };
        try {
          const generatedUrl = await this.portraitGeneration.generatePortrait(projectId, ctx.trade || 'contractor', content);
          await this.updateMeta(projectId, { 
            portraitStatus: 'Generated', 
            originalPortraitInput: content,
            generatedPortraits: [generatedUrl],
            portraitRetries: 0,
            [`${step.id}_state`]: 'evaluating_portrait' 
          });
          
          const text = `![Generated Portrait](${generatedUrl})\n\nDo you like this portrait?`;
          const options = [
            { id: 'yes', label: 'Yes, use this one' },
            { id: 'no', label: 'No, try again' }
          ];
          await this.saveAssistantMsg(projectId, text, options);
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-options', data: { options } };
        } catch(e: any) {
          yield { event: 'token', data: { token: `Portrait generation failed: ${e.message}\n\n` } };
          await this.updateMeta(projectId, { portraitStatus: 'Failed', [`${step.id}_state`]: 'confirming' });
          yield* this.renderBrandRecap(projectId, meta, ctx, 'Failed');
        }
      } else {
        yield { event: 'token', data: { token: "Please upload an image or click skip." } };
      }
    } else if (state === 'evaluating_portrait') {
      if (content === 'yes') {
        const finalUrl = meta.generatedPortraits?.[meta.generatedPortraits.length - 1];
        await this.updateMeta(projectId, { portraitStatus: 'Uploaded & Generated', finalPortraitUrl: finalUrl, [`${step.id}_state`]: 'confirming' });
        yield* this.renderBrandRecap(projectId, meta, ctx, 'Uploaded & Generated');
      } else if (content === 'no') {
        const retries = meta.portraitRetries || 0;
        if (retries < 2) {
          yield { event: 'thinking', data: { message: "Generating another variation..." } };
          try {
            const generatedUrl = await this.portraitGeneration.generatePortrait(projectId, ctx.trade || 'contractor', meta.originalPortraitInput);
            const generatedPortraits = [...(meta.generatedPortraits || []), generatedUrl];
            await this.updateMeta(projectId, { 
              generatedPortraits,
              portraitRetries: retries + 1,
            });
            
            const text = `![Generated Portrait](${generatedUrl})\n\nHow about this one?`;
            const options = [
              { id: 'yes', label: 'Yes, use this one' },
              { id: 'no', label: 'No, try again' }
            ];
            await this.saveAssistantMsg(projectId, text, options);
            yield { event: 'token', data: { token: text } };
            yield { event: 'ui-options', data: { options } };
          } catch(e: any) {
            yield { event: 'token', data: { token: `Generation failed: ${e.message}\n\n` } };
          }
        } else {
          await this.updateMeta(projectId, { [`${step.id}_state`]: 'selecting_portrait' });
          const generatedPortraits = meta.generatedPortraits || [];
          const text = `I've generated a few options based on your photo. Which one do you prefer?`;
          
          const options: any[] = generatedPortraits.map((url: string, i: number) => ({
            id: url,
            label: `Option ${i + 1}`,
            description: `![Option ${i + 1}](${url})`
          }));
          options.push({ id: 'upload_new', label: 'Upload my own photo instead', icon: 'upload' });
          
          await this.saveAssistantMsg(projectId, text, options);
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-options', data: { options } };
        }
      } else {
        yield { event: 'token', data: { token: "Please select Yes or No using the buttons." } };
      }
    } else if (state === 'selecting_portrait') {
      if (content === 'upload_new') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'uploading_final_portrait' });
        const text = "Please upload your final portrait photo (I'll use it exactly as is, without any AI enhancement):";
        await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: 'portrait' });
        yield { event: 'token', data: { token: text } };
        yield { event: 'ui-upload', data: { type: 'image', purpose: 'portrait' } };
      } else if (content.startsWith('http')) {
        await this.updateMeta(projectId, { portraitStatus: 'Uploaded & Generated', finalPortraitUrl: content, [`${step.id}_state`]: 'confirming' });
        yield* this.renderBrandRecap(projectId, meta, ctx, 'Uploaded & Generated');
      } else {
        yield { event: 'token', data: { token: "Please select one of the options." } };
      }
    } else if (state === 'uploading_final_portrait') {
      if (content.startsWith('http')) {
        await this.updateMeta(projectId, { portraitStatus: 'Uploaded Direct', finalPortraitUrl: content, [`${step.id}_state`]: 'confirming' });
        yield* this.renderBrandRecap(projectId, meta, ctx, 'Uploaded Direct');
      } else {
        yield { event: 'token', data: { token: "Please upload an image." } };
      }
    } else if (state === 'confirming') {
      if (content === 'yes') {
        const branch = meta.brandBranch || 'A';
        const answers = meta.brandAnswers || {};
        if (branch === 'A' && meta.extractedBrand) {
          answers['primaryColor'] = meta.extractedBrand.colors.primary;
          answers['secondaryColor'] = meta.extractedBrand.colors.secondary;
          answers['headingFont'] = meta.extractedBrand.typography.headingFont;
        }
        if (branch === 'B') {
          yield { event: 'token', data: { token: "Generating AI logo...\n" } };
          try {
            await this.logoGeneration.generateLogoAndFavicon(projectId, ctx.businessName || 'business', ctx.trade || 'contractor', JSON.stringify(answers));
            yield { event: 'token', data: { token: "Logo generated successfully!\n\n" } };
          } catch(e: any) {
            yield { event: 'token', data: { token: `Logo generation failed: ${e.message}\n\n` } };
          }
        }
        await this.prisma.businessContext.update({ where: { projectId }, data: { brandIdentityInputs: answers } });
        
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else if (content === 'edit') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'editing' });
        const text = "No problem! What would you like to change? (I will save it as a note for the website generation)";
        await this.saveAssistantMsg(projectId, text);
        yield { event: 'token', data: { token: text } };
      } else {
        yield { event: 'token', data: { token: "Please select 'Yes' or 'No'." } };
      }
    } else if (state === 'editing') {
      const answers = meta.brandAnswers || {};
      answers['user_revisions'] = content;
      await this.prisma.businessContext.update({ where: { projectId }, data: { brandIdentityInputs: answers } });
      yield { event: 'token', data: { token: "Got it, I've noted those changes down!\n\n" } };
      yield* this.advanceToNextStep(projectId, stepIndex);
    }
  }

  public async *handleGeneration(projectId: string, _content: string, _meta: any, _step: any): AsyncGenerator<any, void, unknown> {
    yield* this.triggerGeneration(projectId);
  }

  // ==========================================
  // Core Engine Utilities
  // ==========================================

  private async *advanceToNextStep(projectId: string, currentIndex: number, injectedContent?: string): AsyncGenerator<any, void, unknown> {
    const currentStep = ONBOARDING_FLOW_CONFIG[currentIndex];
    const nextIndex = currentIndex + 1;
    await this.updateMeta(projectId, { stepIndex: nextIndex });

    if (nextIndex < ONBOARDING_FLOW_CONFIG.length) {
      const nextStep = ONBOARDING_FLOW_CONFIG[nextIndex];
      yield { event: 'flow-state', data: { state: nextStep.id } };
      
      const transitionText = currentStep.transitionMessage ? `\n\n${currentStep.transitionMessage}\n\n` : `\n\nGreat! We have all the details for ${currentStep.frontendLabel}.\n\nLet's move on to ${nextStep.frontendLabel}.\n\n`;
      yield { event: 'token', data: { token: transitionText } };
      await this.saveAssistantMsg(projectId, transitionText.trim());

      // Trigger the next step automatically
      if (nextStep.customHandler) {
        const handlerName = nextStep.customHandler as keyof this;
        const handler = this[handlerName] as any;
        if (typeof handler === 'function') {
          const meta = await this.updateMeta(projectId, {}); // get fresh meta
          yield* handler.bind(this)(projectId, injectedContent || "", meta, nextStep, nextIndex);
        }
      } else {
        const nextStatus = await this.interviewService.checkCompleteness(projectId, getFieldKeys(nextStep));
        const stream = this.interviewService.processMessage(projectId, injectedContent || "Let's continue.", nextStatus.missingFields, nextStep);
        for await (const event of stream) { yield event; }
      }
    } else {
      yield* this.triggerGeneration(projectId);
    }
  }

  private async updateMeta(projectId: string, updates: any) {
    const ctx = await this.businessContext.findByProjectId(projectId);
    const currentMeta = ctx.interviewMetadata || {};
    const newMeta = { ...(typeof currentMeta === 'object' ? currentMeta : {}), ...updates };
    await this.prisma.businessContext.update({ where: { projectId }, data: { interviewMetadata: newMeta } });
    return newMeta;
  }

  private async saveAssistantMsg(projectId: string, content: string, uiOptions?: any, uiUpload?: any) {
    await this.prisma.chatMessage.create({
      data: { projectId, role: 'assistant', content, metadata: { uiOptions, uiUpload } }
    });
  }

  private async *renderBrandRecap(projectId: string, meta: any, ctx: any, portraitStatus: string): AsyncGenerator<any, void, unknown> {
    const getSwatch = (hex: string) => `<span style="display:inline-block;width:16px;height:16px;background-color:${hex};border-radius:50%;border:1px solid rgba(255,255,255,0.2);vertical-align:-3px;margin-right:6px;"></span>${hex}`;
    
    let summaryText = `**Awesome. Let's recap your brand before we generate the website:**\n\n`;
    summaryText += `| Brand Element | Details |\n`;
    summaryText += `|---|---|\n`;
    
    // Colors
    if (meta.extractedBrand) {
      summaryText += `| Primary Color | **${getSwatch(meta.extractedBrand.colors.primary)}** |\n`;
      summaryText += `| Secondary Color | **${getSwatch(meta.extractedBrand.colors.secondary)}** |\n`;
      summaryText += `| Fonts | **${meta.extractedBrand.typography.headingFont} & ${meta.extractedBrand.typography.bodyFont}** |\n`;
    } else {
       // for branch B
       const ans = meta.brandAnswers || {};
       summaryText += `| Colors & Fonts | **${(ans.q2 || 'N/A').replace(/\n/g, '<br/>')}** |\n`;
    }

    // Q&A
    const branch = meta.brandBranch || 'A';
    const brandIdentityStep = ONBOARDING_FLOW_CONFIG.find(s => s.id === 'brand-identity');
    const questions = branch === 'A' ? brandIdentityStep?.branchAQuestions : brandIdentityStep?.branchBQuestions;
    const answers = meta.brandAnswers || {};
    
    if (questions) {
       for (let i = 0; i < questions.length; i++) {
         if (branch === 'B' && i === 1) continue;
         const rawAnswer = answers[`q${i + 1}`] || 'N/A';
         const sanitizedVal = typeof rawAnswer === 'string' ? rawAnswer.replace(/\n/g, '<br/>') : rawAnswer;
         let shortQ = "Answer";
         if (questions[i].includes('slogan')) shortQ = "Personality & Positioning";
         if (questions[i].includes('services')) shortQ = "Services & Benefits";
         if (questions[i].includes('visual mood')) shortQ = "Visual Mood";
         
         summaryText += `| ${shortQ} | **${sanitizedVal}** |\n`;
       }
    }
    
    summaryText += `| Theme | **${ctx.brandVoicePreference || 'None'}** |\n`;
    
    if (portraitStatus === 'Uploaded & Generated' && meta.finalPortraitUrl) {
      summaryText += `| Portrait | <img src="${meta.finalPortraitUrl}" width="80" style="border-radius:8px" /> |\n`;
    } else {
      summaryText += `| Portrait | **${portraitStatus}** |\n`;
    }
    
    summaryText += `\nIs everything correct?`;

    const options = [
      { id: 'yes', label: 'Yes, looks good' },
      { id: 'edit', label: 'No, let me change something' }
    ];

    await this.saveAssistantMsg(projectId, summaryText, options);
    yield { event: 'token', data: { token: summaryText } };
    yield { event: 'ui-options', data: { options } };
  }

  private async *triggerGeneration(projectId: string): AsyncGenerator<any, void, unknown> {
    this.logger.log(`[ChatFlowEngine] Triggering generation for project ${projectId}`);
    yield { event: 'flow-state', data: { state: 'generation' } };
    await this.updateMeta(projectId, { stepIndex: 999 });
    
    // Kick off background keyword enrichment for secondary cities
    this.secondaryKeywordWorker.enrichSecondaryKeywords(projectId).catch(e => {
      this.logger.error(`[ChatFlowEngine] Secondary keyword worker failed: ${e.message}`, e.stack);
    });

    // Trigger the real website generation!
    let jobId = '';
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      const job = await this.generationProducer.generateSite(projectId, project.userId).catch((e: any) => {
        this.logger.error(`[ChatFlowEngine] Failed to queue generation: ${e.message}`, e.stack);
      });
      if (job && job.id) jobId = job.id;
    }

    const text = "All done! I am now generating your high-converting website in the background...";
    await this.prisma.chatMessage.create({ data: { projectId, role: 'assistant', content: text, metadata: { uiGeneration: { jobId } } } });
    yield { event: 'ui-generation', data: { jobId } };

    yield { event: 'token', data: { token: "\n\n" + text } };
    yield { event: 'flow-complete', data: {} };
  }
}

