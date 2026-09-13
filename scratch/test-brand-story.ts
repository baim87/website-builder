import Anthropic from '@anthropic-ai/sdk';

async function bootstrap() {
  const anthropic = new Anthropic();
  
  const ctx = {
    businessContext: {
      businessName: 'Apex Contracting',
      trade: 'General Contractor',
      brandIdentityInputs: {
        founderStory: 'skip',
        corePromise: 'Uncompromising Quality'
      }
    },
    brandStrategy: 'Mock brand strategy content'
  };

  const schema = {
    type: 'object',
    properties: {
      brandStory: { type: 'string', description: 'The main brand story.' },
      founderBio: { type: 'string', description: 'The founder bio.' },
      tagline: { type: 'string', description: 'A catchy tagline.' }
    },
    required: ['brandStory', 'tagline']
  };

  const prompt = `Develop a Brand Story Document for a contractor business.

BUSINESS CONTEXT:
${JSON.stringify(ctx.businessContext, null, 2)}

BRAND STRATEGY:
${ctx.brandStrategy}

CRITICAL RULES:
- If the user explicitly provided 'skip' or an empty string for their founder story, omit the Founder Bio section completely. Do NOT fabricate a founder story.`;

  console.log('Sending prompt to Anthropic (claude-3-5-sonnet-20241022)...');
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    system: "You are an expert brand copywriter.",
    messages: [
      { role: 'user', content: prompt }
    ],
    tools: [{
      name: 'save_brand_story',
      description: 'Saves the brand story.',
      input_schema: schema as any
    }],
    tool_choice: { type: 'tool', name: 'save_brand_story' }
  });

  const toolCall = response.content.find(c => c.type === 'tool_use');
  if (toolCall) {
    console.log('\n--- LLM JSON OUTPUT ---');
    console.log(JSON.stringify(toolCall, null, 2));
    console.log('-----------------------\n');
  }
}
bootstrap();
