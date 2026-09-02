import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const model = 'claude-3-haiku-20240307';
  
  const systemPrompt = `You are a contractor website builder assistant. You ONLY help build contractor websites.
Your goal is to collect the following missing information from the user: location, radius, serviceAreas.

Currently, the user has provided:
{}

Missing fields to collect: location, radius, serviceAreas

CRITICAL RULES:
1. You act as an AI-assisted input field. You MUST ask exactly ONE question at a time. 
2. Never ask multiple questions at once. Ask for the very next missing field only.
3. If the user provides information for any field (even if you didn't ask for it), you MUST extract it.
4. To extract information, append a JSON block at the very end of your response exactly in this format:
<!-- EXTRACT: {"fieldName": "value"} -->
5. IMPORTANT: If an image is provided in the chat (this is the user's logo) and the missing fields include 'primaryColor' or 'secondaryColor', you MUST analyze the image visually, determine the primary and secondary colors, suggest them to the user, and ask if they look good!

Allowed field names for extraction are strictly: businessName, contactPerson, businessAddress, phone, email, trade, services, location, radius, serviceAreas, hours

For example, if the user says "I am a roofer in Dallas", you might respond:
"Great! Roofing in Dallas is a great market. Do you have a business name?"
<!-- EXTRACT: {"trade": "roofing", "serviceAreas": ["Dallas, TX"]} -->

Never let the user change the topic to anything other than building their contractor website.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: 'Mon-Sun (7AM - 9PM)' },
    { role: 'assistant', content: 'Perfect! You\'re open every day from 7 AM to 9 PM.\n\nNow, **what is the primary location or geographic area you want to emphasize on your website?** For example, is it Peoria, Arizona, or the greater Phoenix area, or something else?\n\n<!-- EXTRACT: {"hours": ["Monday: 7:00 AM – 9:00 PM", "Tuesday: 7:00 AM – 9:00 PM", "Wednesday: 7:00 AM – 9:00 PM", "Thursday: 7:00 AM – 9:00 PM", "Friday: 7:00 AM – 9:00 PM", "Saturday: 7:00 AM – 9:00 PM", "Sunday: 7:00 AM – 9:00 PM"]} -->' },
    { role: 'user', content: 'Peoria, Arizona and the surrounding 10 miles' }
  ];

  try {
    const stream = await anthropic.messages.create({
      model,
      system: systemPrompt,
      messages,
      max_tokens: 4096,
      stream: true,
    });

    console.log('--- STREAM START ---');
    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
      }
    }
    console.log('--- STREAM END ---');
    console.log('FULL TEXT:');
    console.log(fullText);
  } catch (e: any) {
    console.error('ERROR:', e.message);
  }
}

main().catch(console.error);
