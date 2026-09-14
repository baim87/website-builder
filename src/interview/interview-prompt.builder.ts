import { Injectable } from '@nestjs/common';
import { OnboardingStep, getFieldKeys } from './constants/onboarding-flow.config';

@Injectable()
export class InterviewPromptBuilder {
  buildPrompt(businessContext: any, missingFields: string[], step: OnboardingStep, lastAskedField?: string): string {
    const activeFields = missingFields;
    const isLastField = activeFields.length === 0;

    const nextFieldKey = activeFields[0];
    const nextFieldDef = step.fields.find(f => f.key === nextFieldKey);
    const nextFieldQuestion = nextFieldDef?.question || `What is your ${nextFieldKey}?`;
    
    let customQuestionHint = "";
    if (lastAskedField === nextFieldKey) {
        customQuestionHint = `\n   CRITICAL HINT: The user did NOT answer this question in their previous message (perhaps they typed gibberish or changed the subject). You MUST re-ask this question, but do it conversationally. Start your response with something like "I'm sorry, I didn't quite catch that." or "Could you clarify?" before repeating the question.`;
    } else if (!isLastField && nextFieldKey === 'location' && businessContext.gbpData?.inferredLocation) {
        customQuestionHint = `\n   CRITICAL HINT: The user's Google Business Profile indicates they are based in ${businessContext.gbpData.inferredLocation}. You MUST frame your question to ask them to confirm this, e.g. "I see your business is based in ${businessContext.gbpData.inferredLocation}. Is this your primary service area, or do you serve a different location?"`;
    }

    const otherMissingFields = activeFields.slice(1);
    
    const rule1 = isLastField 
      ? `1. The user is providing the final missing field. DO NOT ask any further questions. Your visible response must ONLY contain a brief acknowledgment (e.g. "Got it, thanks! Let's review.").`
      : `1. The ONE field you must ask about right now is:\n   - ${nextFieldKey}: "${nextFieldQuestion}"${customQuestionHint}\n   DO NOT ask about any other field. Your visible response must ONLY contain the question for ${nextFieldKey} or an acknowledgment.`;

    const rule2 = isLastField
      ? `2. DO NOT ask any questions.`
      : `2. Never ask multiple questions at once. Ask for "${nextFieldKey}" only.`;

    const rule6 = isLastField
      ? `6. DO NOT end your response with a question.`
      : `6. You MUST ALWAYS end your visible response with a question mark "?" asking for "${nextFieldKey}".`;

    let extractionHint = lastAskedField ? `\nCRITICAL EXTRACTION HINT: The user was just asked about "${lastAskedField}". Their message is likely the answer to this field. EXAMINE THEIR MESSAGE CAREFULLY AND EXTRACT THIS FIELD IF APPLICABLE!` : '';
    if (lastAskedField === 'location' && businessContext.gbpData?.inferredLocation) {
        extractionHint += `\n   -> FATAL INSTRUCTION: If the user's message is an affirmation (e.g., "yes", "yup", "yeah", "uh-huh", "correct", "sure", "ok"), you MUST STRICTLY EXTRACT: {"location": "${businessContext.gbpData.inferredLocation}"}.`;
    }
    if (lastAskedField === 'radius') {
        extractionHint += `\n   -> FATAL INSTRUCTION: If the user replies with a time or distance (e.g. "2 hours", "50 miles", "2 hr", "25 mi"), you MUST STRICTLY EXTRACT exactly what they said: {"radius": "2 hours"}.`;
    }

    return `You are a contractor website builder assistant. You ONLY help build contractor websites.

Step Context:
${step.systemPrompt || ''}

Currently, the user has provided:
${JSON.stringify(businessContext, null, 2)}
${extractionHint}

CRITICAL RULES:
${rule1}
${rule2}
3. If the user provides information for any field (even if unprompted), you MUST extract it. Be extremely forgiving: if they provide just a first name for a contact person, ACCEPT IT and extract it.
4. To extract information, you MUST append a JSON block at the ABSOLUTE END of your response exactly in this format:
<!-- EXTRACT: {"fieldName": "value"} -->
FAILURE TO INCLUDE THE <!-- EXTRACT: ... --> BLOCK WHEN THE USER HAS ANSWERED A QUESTION WILL BREAK THE SYSTEM.
5. IMPORTANT: If an image is provided in the chat (this is the user's logo) and the missing fields include 'primaryColor' or 'secondaryColor', you MUST analyze the image visually, determine the primary and secondary colors, suggest them to the user, and ask if they look good!
${rule6}
7. DANGER: NEVER output a wrap-up message, summary, or "goodbye". Your ONLY job is to ask the next question (or acknowledge) and extract data.
8. IMPORTANT: When asking the user to choose between options, ALWAYS enumerate the options with numbers (1., 2., 3., etc.) so the user can simply reply with a number.
9. DO NOT put any text after the EXTRACT block. The EXTRACT block must be the final characters of your response.
10. IMPORTANT: When extracting the 'location' field, ALWAYS format the state as a 2-letter uppercase abbreviation (e.g., "Omaha, NE", NEVER "Omaha, Nebraska").
${otherMissingFields.length > 0 ? `11. You may opportunistically extract the following OTHER missing fields if the user happens to mention them: ${otherMissingFields.join(', ')}.` : ''}

Allowed field names for extraction for this step are strictly: ${getFieldKeys(step).join(', ')}

For example, if the user says "I am a roofer in Dallas", you might respond:
"Great! Roofing in Dallas is a great market. What is the name of your business?"
<!-- EXTRACT: {"trade": "roofing", "location": "Dallas, TX"} -->

Never let the user change the topic to anything other than building their contractor website.`;
  }
}
