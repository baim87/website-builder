import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InterviewService } from '../interview/interview.service';
import { BusinessContextService } from '../projects/business-context.service';
import { ONBOARDING_FLOW_CONFIG, getFieldKeys } from '../interview/constants/onboarding-flow.config';
import { GooglePlacesService } from '../projects/google-places.service';
import { BrandExtractionService } from '../assets/brand-extraction.service';
import { LogoGenerationService } from '../assets/logo-generation.service';
import { PortraitGenerationService } from '../assets/portrait-generation.service';
import { ServiceSuggestionService } from '../keywords/service-suggestion.service';
import { LocationMetricsService } from '../seo/location-metrics.service';
import { SecondaryKeywordWorker } from '../keywords/secondary-keyword.worker';
import { GenerationProducer } from '../queue/producers/generation.producer';
import { SkillExecutorService } from '../skills/skill-executor.service';
import { BrandKnowledgeService } from '../brand/brand-knowledge.service';
import { ASSET_PURPOSE } from '../assets/constants/asset-purpose.constant';
import { BrandStrategySkill } from '../skills/impl/brand-strategy.skill';
import { BrandPositioningSkill } from '../skills/impl/brand-positioning.skill';
import { BrandVoiceSkill } from '../skills/impl/brand-voice.skill';
import { BrandVisualSkill } from '../skills/impl/brand-visual.skill';
import { BrandMessagingSkill } from '../skills/impl/brand-messaging.skill';
import { BrandStorySkill } from '../skills/impl/brand-story.skill';
import { ChatService } from './chat.service';

@Injectable()
export class ChatFlowEngine {
  private readonly logger = new Logger(ChatFlowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly interviewService: InterviewService,
    private readonly businessContext: BusinessContextService,
    private readonly googlePlaces: GooglePlacesService,
    private readonly brandExtraction: BrandExtractionService,
    private readonly logoGeneration: LogoGenerationService,
    private readonly portraitGeneration: PortraitGenerationService,
    private readonly serviceSuggestionService: ServiceSuggestionService,
    private readonly locationMetricsService: LocationMetricsService,
    private readonly secondaryKeywordWorker: SecondaryKeywordWorker,
    private readonly generationProducer: GenerationProducer,
    private readonly executor: SkillExecutorService,
    private readonly brandKnowledge: BrandKnowledgeService,
    private readonly brandStrategy: BrandStrategySkill,
    private readonly brandPositioning: BrandPositioningSkill,
    private readonly brandVoice: BrandVoiceSkill,
    private readonly brandVisual: BrandVisualSkill,
    private readonly brandMessaging: BrandMessagingSkill,
    private readonly brandStory: BrandStorySkill,
  ) { }

  async *processMessage(projectId: string, content: string, displayText?: string): AsyncGenerator<any, void, unknown> {
    const context = await this.businessContext.findByProjectId(projectId);
    const meta: any = context.interviewMetadata || {};
    const stepIndex = meta.stepIndex || 0;

    // Add detailed logging
    const currentStepConfig = ONBOARDING_FLOW_CONFIG[stepIndex];
    if (currentStepConfig) {
      const totalQuestions = currentStepConfig.fields?.length || 0;
      const status = await this.interviewService.checkCompleteness(projectId, getFieldKeys(currentStepConfig)).catch(() => ({ complete: false, missingFields: [] }));
      const answeredCount = status.complete ? totalQuestions : totalQuestions - status.missingFields.length;

      this.logger.log(`\n======================================================\n` +
        `[User Input]: "${content}"\n` +
        `[Step]: ${currentStepConfig.id} (${stepIndex + 1}/${ONBOARDING_FLOW_CONFIG.length})\n` +
        `[Progress]: Question ${answeredCount}/${totalQuestions}\n` +
        `======================================================\n`);
    } else {
      this.logger.log(`[ChatFlowEngine] Processing message: "${content}"`);
    }

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

    const lastAskedField = meta[`${currentStep.id}_lastAskedField`];

    const stream = this.interviewService.processMessage(projectId, content, status.missingFields, currentStep, state === 'editing', lastAskedField);
    let latestMissingFields = status.missingFields;
    for await (const event of stream) {
      if (event.event === 'progress') {
        latestMissingFields = event.data.missingFields;
      }
      yield event;
    }

    await this.updateMeta(projectId, {
      [`${currentStep.id}_lastAskedField`]: latestMissingFields[0] ?? null,
    });

    const finalStatus = await this.interviewService.checkCompleteness(projectId, getFieldKeys(currentStep));
    // Intercept when the next missing field is 'services' to suggest options
    if (!finalStatus.complete && finalStatus.missingFields[0] === 'services') {
      const ctx = await this.businessContext.findByProjectId(projectId);
      if (ctx.trade && ctx.location) {
        yield { event: 'thinking-status', data: { message: 'Fetching Google Ads Keyword Data...' } };

        try {
          const suggestions = await this.serviceSuggestionService.getServiceSuggestions(projectId, ctx.trade, ctx.location);

          const uiMultiSelectData = {
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
          };

          yield {
            event: 'ui-multi-select',
            data: uiMultiSelectData
          };

          const latestMsg = await this.prisma.chatMessage.findFirst({
            where: { projectId, role: 'assistant' },
            orderBy: { createdAt: 'desc' }
          });

          if (latestMsg) {
            await this.prisma.chatMessage.update({
              where: { id: latestMsg.id },
              data: {
                metadata: {
                  ...(typeof latestMsg.metadata === 'object' && latestMsg.metadata ? (latestMsg.metadata as object) : {}),
                  uiMultiSelect: uiMultiSelectData
                }
              }
            });
          }
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

        // Trigger background keyword metrics fetch for all surrounding cities (Fire 2)
        // This is done here so it includes any custom services the user might have just typed.
        if (currentStep.id === 'business') {
          const ctx = await this.businessContext.findByProjectId(projectId);
          if (Array.isArray(ctx.serviceAreas) && ctx.serviceAreas.length > 0 && Array.isArray(ctx.services) && ctx.services.length > 0) {
            this.locationMetricsService.processProjectMetrics(
              projectId,
              ctx.serviceAreas as string[],
              ctx.services as string[]
            ).catch(e => this.logger.error(`Failed to process background location metrics for project ${projectId}`, e.stack));
          }
        }

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
        await this.updateMeta(projectId, { brandStrategySelection: 'has-logo', [`${step.id}_state`]: 'uploading-logo' });
        const text = "Awesome. Please upload your logo:";
        await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: ASSET_PURPOSE.LOGO });
        yield { event: 'token', data: { token: text } };
        yield { event: 'ui-upload', data: { type: 'image', purpose: ASSET_PURPOSE.LOGO } };
      } else if (content === 'no-logo') {
        await this.updateMeta(projectId, { brandStrategySelection: 'no-logo', brandBranch: 'B' });
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else if (content === 'scratch') {
        await this.updateMeta(projectId, { brandStrategySelection: 'scratch', brandBranch: 'C' });
        yield* this.advanceToNextStep(projectId, stepIndex);
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
          await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: ASSET_PURPOSE.FAVICON });
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-upload', data: { type: 'image', purpose: ASSET_PURPOSE.FAVICON } };
        } catch (e: any) {
          yield { event: 'token', data: { token: `Failed to extract logo: ${e.message}\n\n` } };
          await this.updateMeta(projectId, { brandBranch: 'A', [`${step.id}_state`]: 'uploading-favicon' });

          const text = "Please upload your favicon (the small icon that appears in the browser tab), or type 'skip':";
          await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: ASSET_PURPOSE.FAVICON });
          yield { event: 'token', data: { token: text } };
          yield { event: 'ui-upload', data: { type: 'image', purpose: ASSET_PURPOSE.FAVICON } };
        }
      } else {
        yield { event: 'token', data: { token: "Please provide a valid logo URL or upload a file." } };
      }
    } else if (state === 'uploading-favicon') {
      if (content.startsWith('http')) {
        yield { event: 'token', data: { token: "Favicon received!\n\n" } };
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else if (content.toLowerCase() === 'skip') {
        yield { event: 'token', data: { token: "Skipping favicon.\n\n" } };
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else {
        yield { event: 'token', data: { token: "Please provide a valid favicon URL, upload a file, or type 'skip'." } };
      }
    }
  }

  public async *handleBrandInterview(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const state = meta[`${step.id}_state`] || 'interviewing';

    if (state === 'selecting_portrait') {
      if (content === 'upload_new') {
        await this.updateMeta(projectId, { [`${step.id}_state`]: 'uploading_final_portrait' });
        const text = "Please upload your final portrait photo (I'll use it exactly as is, without any AI enhancement):";
        await this.saveAssistantMsg(projectId, text, undefined, { type: 'image', purpose: ASSET_PURPOSE.PORTRAIT });
        yield { event: 'token', data: { token: text } };
        yield { event: 'ui-upload', data: { type: 'image', purpose: ASSET_PURPOSE.PORTRAIT } };
      } else if (content.startsWith('http')) {
        await this.updateMeta(projectId, { portraitStatus: 'AI Generated', finalPortraitUrl: content, [`${step.id}_state`]: 'done' });
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else {
        yield { event: 'token', data: { token: "Please select one of the options or upload your own." } };
      }
      return;
    } else if (state === 'uploading_final_portrait') {
      if (content.startsWith('http')) {
        await this.updateMeta(projectId, { portraitStatus: 'Uploaded Direct', finalPortraitUrl: content, [`${step.id}_state`]: 'done' });
        yield* this.advanceToNextStep(projectId, stepIndex);
      } else {
        yield { event: 'token', data: { token: "Please upload an image." } };
      }
      return;
    }

    let qIndex = meta[`${step.id}_qIndex`] || 0;
    let answers = meta.brandAnswers || {};
    const questions = step.interviewQuestions || [];

    // Save answer if not the first display
    if (content && meta[`${step.id}_asked`]) {
      const currentQ = questions[qIndex];
      const lowerContent = String(content).toLowerCase().trim();
      const needsHelp = ["not sure", "i'm not sure", "i am not sure", "idk", "i don't know", "suggest", "help", "what do you think", "any ideas"].some(phrase => lowerContent.includes(phrase)) || lowerContent.length < 3;

      if (needsHelp && currentQ.type !== 'multi-select') {
        // Generate contextual suggestion and DO NOT increment qIndex
        yield { event: 'thinking-status', data: { message: 'Thinking of ideas...' } };
        const systemPrompt = `You are a helpful brand strategist for United States Local contractors. 
The user is filling out a branding questionnaire and was asked: "${currentQ.question}". 
They replied: "${content}". 
Please provide 3 short, friendly suggestions or examples they could use for their brand. 
Keep your response under 3 sentences. End by asking them what they think, or tell them they can just pick one of the ideas.`;

        const stream = this.chatService.sendMessage(projectId, content, systemPrompt);
        for await (const event of stream) {
          if (event.event === 'internal-done') {
            // Re-yield the UI options for the current question so they can still see them
            let options = undefined;
            if (currentQ.options) {
              options = currentQ.options;
              yield { event: 'ui-options', data: { options } };
            }
          } else {
            yield event;
          }
        }
        return; // Halt here so the user can answer the question again
      }

      let finalContent = content;

      // Enforce maxSelections on the backend and convert to array
      if (currentQ.type === 'multi-select') {
        const parts = String(finalContent).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (currentQ.maxSelections && parts.length > currentQ.maxSelections) {
          finalContent = parts.slice(0, currentQ.maxSelections) as any;
          this.logger.warn(`Truncated multi-select answer for ${currentQ.fieldKey} to ${currentQ.maxSelections} items.`);
        } else {
          finalContent = parts as any;
        }
      }

      answers[currentQ.fieldKey] = finalContent;
      await this.updateMeta(projectId, { brandAnswers: answers, [`${step.id}_qIndex`]: qIndex + 1 });
      qIndex++;
    }

    // Skip conditionals if needed
    while (qIndex < questions.length) {
      const q = questions[qIndex];
      if (q.conditionalOn) {
        const { field, value, negate } = q.conditionalOn;
        const depValue = meta[field] || answers[field];
        const match = depValue === value;
        if ((!negate && !match) || (negate && match)) {
          qIndex++; // skip this question
          await this.updateMeta(projectId, { [`${step.id}_qIndex`]: qIndex });
          continue;
        }
      }
      break; // found the next question to ask
    }

    if (qIndex < questions.length) {
      const q = questions[qIndex];

      const text = q.question;
      await this.updateMeta(projectId, { [`${step.id}_asked`]: true });

      let options = undefined;
      let multiSelect = undefined;

      if (q.type === 'multi-select' && q.options) {
        multiSelect = {
          options: q.options,
          allowCustom: q.allowCustomInput,
          customPlaceholder: q.placeholder,
        };
      } else if (q.options) {
        options = q.options;
      }

      await this.saveAssistantMsg(projectId, text, options, q.uploadConfig, multiSelect);

      yield { event: 'token', data: { token: text } };
      if (options) yield { event: 'ui-options', data: { options } };
      if (multiSelect) yield { event: 'ui-multi-select', data: multiSelect };
      if (q.uploadConfig) yield { event: 'ui-upload', data: q.uploadConfig };
    } else {
      await this.updateMeta(projectId, { [`${step.id}_asked`]: false });

      // All questions answered, generate brand knowledge files!
      yield { event: 'thinking', data: { message: "Synthesizing your brand strategy..." } };

      try {
        const businessContext = await this.businessContext.findByProjectId(projectId);
        // Include interview answers into business context for the skills
        const fullContext = { ...businessContext, brandIdentityInputs: answers };

        // 1. Run brand-strategy.skill FIRST (foundation)
        const strategyResult = await this.executor.executeSkill(this.brandStrategy, {
          projectId, context: { businessContext: fullContext }
        });
        await this.brandKnowledge.saveBrandFile(projectId, 'brand-strategy.md', strategyResult);

        yield { event: 'thinking', data: { message: "Developing brand positioning, messaging, and visual direction..." } };

        // 2. Run the other 5 skills IN PARALLEL (all read strategy)
        const [positioning, voice, visual, messaging, story] = await Promise.all([
          this.executor.executeSkill(this.brandPositioning, {
            projectId, context: { businessContext: fullContext, brandStrategy: strategyResult }
          }),
          this.executor.executeSkill(this.brandVoice, {
            projectId, context: { businessContext: fullContext, brandStrategy: strategyResult }
          }),
          this.executor.executeSkill(this.brandVisual, {
            projectId, context: { businessContext: fullContext, brandStrategy: strategyResult, extractedBrand: meta.extractedBrand }
          }),
          this.executor.executeSkill(this.brandMessaging, {
            projectId, context: { businessContext: fullContext, brandStrategy: strategyResult }
          }),
          this.executor.executeSkill(this.brandStory, {
            projectId, context: { businessContext: fullContext, brandStrategy: strategyResult }
          }),
        ]);

        // 3. Save all files to R2
        await Promise.all([
          this.brandKnowledge.saveBrandFile(projectId, 'brand-positioning.md', positioning),
          this.brandKnowledge.saveBrandFile(projectId, 'brand-voice.md', voice),
          this.brandKnowledge.saveBrandFile(projectId, 'brand-visual.md', visual.markdown),
          this.brandKnowledge.saveBrandFile(projectId, 'brand-messaging.md', messaging),
          this.brandKnowledge.saveBrandFile(projectId, 'brand-story.md', story),
        ]);

        // 4. Auto-select theme from brand-visual.skill output
        const recommendedTheme = visual.recommendedTheme || 'modern-minimalist';
        await this.businessContext.upsert(projectId, {
          brandIdentityInputs: { ...answers, themePreference: recommendedTheme }
        });

        // 5. Generate logo - MOVED to handleBrandRecap confirming state!

        // 6. Generate portrait variants (if user uploaded a photo OR selected scratch)
        const portraitImageUrl = answers['ownerPortrait'];
        const isScratch = meta.brandStrategySelection === 'scratch';
        
        if ((portraitImageUrl && portraitImageUrl !== 'skip') || isScratch) {
          yield { event: 'thinking', data: { message: "Generating 3 professional portrait options..." } };
          try {
            const referenceImage = (portraitImageUrl && portraitImageUrl !== 'skip') ? portraitImageUrl : undefined;
            const variants = await this.portraitGeneration.generatePortraitVariants(projectId, fullContext.trade || 'contractor', referenceImage, visual.markdown);

            await this.updateMeta(projectId, { [`${step.id}_state`]: 'selecting_portrait', generatedPortraits: variants });

            const text = referenceImage 
              ? `I've generated 3 professional portrait options based on your photo. Which one do you prefer?`
              : `I've generated 3 synthetic professional portraits for your brand. Which one do you prefer?`;
              
            const options: any[] = variants.map((url, i) => ({
              id: url,
              label: `Option ${i + 1}`,
              description: `![Option ${i + 1}](${url})`
            }));
            options.push({ id: 'upload_new', label: 'Upload my own photo instead', icon: 'upload' });

            await this.saveAssistantMsg(projectId, text, options);
            yield { event: 'token', data: { token: text } };
            yield { event: 'ui-options', data: { options } };
            return; // Pause interview flow to wait for selection
          } catch (e: any) {
            yield { event: 'token', data: { token: `Portrait generation failed: ${e.message}\n` } };
          }
        }

        await this.updateMeta(projectId, { [`${step.id}_state`]: 'done' });
        yield* this.advanceToNextStep(projectId, stepIndex);
      } catch (e: any) {
        yield { event: 'token', data: { token: `Error generating brand kit: ${e.message}\n` } };
      }
    }
  }

  public async *handleBrandRecap(projectId: string, content: string, meta: any, step: any, stepIndex: number): AsyncGenerator<any, void, unknown> {
    const state = meta[`${step.id}_state`] || 'initial';
    const ctx = await this.businessContext.findByProjectId(projectId);
    const self = this;

    const triggerLogoGen = async function* () {
      const hasExistingLogo = meta.brandStrategySelection === 'has-logo';
      if (!hasExistingLogo) {
        yield { event: 'token', data: { token: "Generating AI logo...\n" } };
        try {
          // Re-fetch visual.md data for logo hints since it was saved to R2
          const visualMd = await self.brandKnowledge.getBrandFile(projectId, 'brand-visual.md');
          await self.logoGeneration.generateLogoAndFavicon(projectId, ctx.businessName || 'business', ctx.trade || 'contractor', visualMd || '');
          yield { event: 'token', data: { token: "Logo generated successfully!\n\n" } };
        } catch (e: any) {
          yield { event: 'token', data: { token: `Logo generation failed: ${e.message}\n\n` } };
        }
      }
    };

    if (state === 'initial') {
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'confirming' });
      yield* this.renderBrandRecap(projectId, meta, ctx);
    } else if (state === 'confirming') {
      if (content === 'yes') {
        yield* triggerLogoGen();
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
      answers['user_revisions'] = (answers['user_revisions'] ? answers['user_revisions'] + '\n' : '') + content;
      await this.prisma.businessContext.update({ where: { projectId }, data: { brandIdentityInputs: answers } });
      await this.updateMeta(projectId, { [`${step.id}_state`]: 'confirming' });
      
      const text = "Got it, I've noted those changes down!\n\nDoes everything else look good?";
      const options = [
        { id: 'yes', label: 'Yes, proceed' },
        { id: 'edit', label: 'No, I need to change more' }
      ];
      await this.saveAssistantMsg(projectId, text, options);
      yield { event: 'token', data: { token: text } };
      yield { event: 'ui-options', data: { options } };
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
        let latestMissingFields = nextStatus.missingFields;
        for await (const event of stream) {
          if (event.event === 'progress') {
            latestMissingFields = (event.data as { missingFields: string[] }).missingFields;
          }
          yield event;
        }
        await this.updateMeta(projectId, { [`${nextStep.id}_lastAskedField`]: latestMissingFields[0] ?? null });
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

  private async saveAssistantMsg(projectId: string, content: string, uiOptions?: any, uiUpload?: any, uiMultiSelect?: any) {
    await this.prisma.chatMessage.create({
      data: { projectId, role: 'assistant', content, metadata: { uiOptions, uiUpload, uiMultiSelect } }
    });
  }

  private async *renderBrandRecap(projectId: string, meta: any, ctx: any): AsyncGenerator<any, void, unknown> {
    const getSwatch = (hex: string) => `<span style="display:inline-block;width:16px;height:16px;background-color:${hex};border-radius:50%;border:1px solid rgba(255,255,255,0.2);vertical-align:-3px;margin-right:6px;"></span>${hex}`;

    let summaryText = `**Awesome. Let's recap your brand before we generate the website:**\n\n`;

    // Quick attempt to load the actual generated brand files to prove it worked
    try {
      const visualMd = await this.brandKnowledge.getBrandFile(projectId, 'brand-visual.md');
      if (visualMd) {
        summaryText += `*We successfully built your strategic Brand Knowledge Base (Strategy, Positioning, Voice, Visuals, Messaging, and Story) from your interview answers!*\n\n`;
      }
    } catch (e) { }

    summaryText += `| Brand Element | Details |\n`;
    summaryText += `|---|---|\n`;

    const answers = meta.brandAnswers || {};
    const themePref = ctx.brandIdentityInputs?.themePreference || 'Not Set';
    // Iterate over brand-interview questions to render what they answered
    const brandInterviewStep = ONBOARDING_FLOW_CONFIG.find(s => s.id === 'brand-interview');
    if (brandInterviewStep && brandInterviewStep.interviewQuestions) {
      for (const q of brandInterviewStep.interviewQuestions) {
        if (q.fieldKey === 'ownerPortrait') continue; // Handled separately
        const rawAnswer = answers[q.fieldKey];
        if (rawAnswer) {
          const sanitizedVal = Array.isArray(rawAnswer) ? rawAnswer.join(', ') : String(rawAnswer).replace(/\n/g, '<br/>');
          let shortQ = q.question.split('?')[0] || q.question; // take just the first part for brevity
          if (shortQ.length > 50) shortQ = shortQ.substring(0, 47) + '...';
          summaryText += `| ${shortQ} | **${sanitizedVal}** |\n`;
        }
      }
    }

    summaryText += `| Recommended Theme | **${themePref}** |\n`;

    if (meta.extractedBrand) {
      summaryText += `| Primary Color | **${getSwatch(meta.extractedBrand.colors.primary)}** |\n`;
      summaryText += `| Secondary Color | **${getSwatch(meta.extractedBrand.colors.secondary)}** |\n`;
      summaryText += `| Fonts | **${meta.extractedBrand.typography.headingFont} & ${meta.extractedBrand.typography.bodyFont}** |\n`;
    }

    if (meta.finalPortraitUrl) {
      summaryText += `| Portrait | <img src="${meta.finalPortraitUrl}" width="80" style="border-radius:8px" /> |\n`;
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

