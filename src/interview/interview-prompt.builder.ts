import { Injectable } from '@nestjs/common';
import { OnboardingStep, getFieldKeys } from './constants/onboarding-flow.config';

@Injectable()
export class InterviewPromptBuilder {
  buildPrompt(businessContext: any, missingFields: string[], step: OnboardingStep, lastAskedField?: string, graceAlreadyUsedFor?: string): string {
    // Only grant the "assume current message answers this" pass ONCE per field.
    // If we already gave this exact field a pass last turn and it's STILL missing,
    // stop hiding it — ask it plainly instead of skipping it again.
    const shouldFilter = lastAskedField && lastAskedField !== graceAlreadyUsedFor;
    
    const fieldsToAsk = shouldFilter 
      ? missingFields.filter(f => f !== lastAskedField) 
      : missingFields;
      
    // Fallback to original missingFields if filtering emptied the array (edge case)
    const activeFields = fieldsToAsk.length > 0 ? fieldsToAsk : missingFields;

    const nextFieldKey = activeFields[0];
    const nextFieldDef = step.fields.find(f => f.key === nextFieldKey);
    const nextFieldQuestion = nextFieldDef?.question || `What is your ${nextFieldKey}?`;
    
    let customQuestionHint = "";
    if (nextFieldKey === 'location' && businessContext.gbpData?.inferredLocation) {
        customQuestionHint = `\n   CRITICAL HINT: The user's Google Business Profile indicates they are based in ${businessContext.gbpData.inferredLocation}. You MUST frame your question to ask them to confirm this, e.g. "I see your business is based in ${businessContext.gbpData.inferredLocation}. Is this your primary service area, or do you serve a different location?"`;
    }

    const otherMissingFields = activeFields.slice(1);

    return `You are a contractor website builder assistant. You ONLY help build contractor websites.

Step Context:
${step.systemPrompt || ''}

Currently, the user has provided:
${JSON.stringify(businessContext, null, 2)}
${lastAskedField ? `\nCRITICAL EXTRACTION HINT: The user was just asked about "${lastAskedField}". Their message is likely the answer to this field. EXAMINE THEIR MESSAGE CAREFULLY AND EXTRACT THIS FIELD IF APPLICABLE!` : ''}

CRITICAL RULES:
1. The ONE field you must ask about right now is:
   - ${nextFieldKey}: "${nextFieldQuestion}"${customQuestionHint}
   DO NOT ask about any other field. Your visible response must ONLY contain the question for ${nextFieldKey} or an acknowledgment.
2. Never ask multiple questions at once. Ask for "${nextFieldKey}" only.
3. If the user provides information for any field (even if unprompted), you MUST extract it. Be extremely forgiving: if they provide just a first name for a contact person, ACCEPT IT and extract it.
4. To extract information, you MUST append a JSON block at the ABSOLUTE END of your response exactly in this format:
<!-- EXTRACT: {"fieldName": "value"} -->
FAILURE TO INCLUDE THE <!-- EXTRACT: ... --> BLOCK WHEN THE USER HAS ANSWERED A QUESTION WILL BREAK THE SYSTEM.
5. IMPORTANT: If an image is provided in the chat (this is the user's logo) and the missing fields include 'primaryColor' or 'secondaryColor', you MUST analyze the image visually, determine the primary and secondary colors, suggest them to the user, and ask if they look good!
6. You MUST ALWAYS end your visible response with a question mark "?" asking for "${nextFieldKey}".
7. DANGER: NEVER output a wrap-up message, summary, or "goodbye". Your ONLY job is to ask the next question and extract data.
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
