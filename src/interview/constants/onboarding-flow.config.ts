// ─── Types ──────────────────────────────────────────────────────────────

export interface OnboardingField {
  /** The exact column name on BusinessContext (e.g. 'businessName') */
  key: string;
  /** Human-readable question the AI (or fallback) must ask */
  question: string;
}

export interface UiOption {
  id: string;
  label: string;
  description?: string;
}

export interface OnboardingStep {
  id: string;
  /** Label shown in the frontend CinematicStepper */
  frontendLabel: string;
  /** Phase grouping for the stepper (maps to the 3 top-level tabs) */
  phase: 'identity' | 'brand' | 'generation';
  /** Fields to collect via AI conversational interview (empty = custom handler only) */
  fields: OnboardingField[];
  /** System prompt injected into the LLM for AI-driven steps */
  systemPrompt?: string;
  /** If set, the engine delegates to this named method instead of the generic LLM loop */
  customHandler?: string;
  /** Initial assistant message when entering this step */
  initialMessage?: string;
  /** Custom transition message used when advancing TO the next step from this one */
  transitionMessage?: string;
  /** Clickable option buttons rendered by the frontend */
  uiOptions?: UiOption[];
  /** File upload prompt rendered by the frontend */
  uiUpload?: { type: string; purpose: string };
  /** Hard-coded sequential questions (for steps like brand-identity where the AI is not trusted to remember) */
  sequentialQuestions?: string[];
  branchAQuestions?: string[];
  branchBQuestions?: string[];
}

// ─── Flow Configuration ─────────────────────────────────────────────────

export const ONBOARDING_FLOW_CONFIG: OnboardingStep[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1 — BUSINESS IDENTITY
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: 'gbp',
    frontendLabel: 'Business Search',
    phase: 'identity',
    fields: [],
    customHandler: 'handleGbpFlow',
    initialMessage: 'Do you have a Google Business Profile? If so, I can auto-fill your details.',
    transitionMessage: 'Got it! I\'ve saved your Google Business Profile details.',
    uiOptions: [
      { id: 'yes', label: 'Yes, search for it' },
      { id: 'no', label: 'No, enter manually' },
    ],
  },

  {
    id: 'business',
    frontendLabel: 'Business Details',
    phase: 'identity',
    fields: [
      { key: 'businessName', question: 'What is the name of your business?' },
      { key: 'contactPerson', question: 'Who is the primary contact person or owner?' },
      { key: 'trade', question: 'What trade or industry are you in? (e.g. roofing, plumbing, HVAC, landscaping)' },
      { key: 'location', question: 'What city or area is your primary service location?' },
      { key: 'radius', question: 'How far do you travel for jobs? (e.g. 25 miles, 50 km)' },
      { key: 'services', question: 'What specific services do you offer? List as many as you can.' },
      { key: 'businessAddress', question: 'What is your business address?' },
      { key: 'phone', question: 'What is the best phone number for customers to reach you?' },
      { key: 'email', question: 'What is your business email address?' },
      { key: 'hours', question: 'What are your business hours? (e.g. Mon-Fri 8am-5pm)' },
    ],
    systemPrompt: `You are an expert AI onboarding assistant for United States local contractors.
Your job is to collect the MISSING business details listed below, one at a time.
Rules:
1. Ask about ONE missing field per response.
2. Be extremely concise and direct. Do NOT use conversational padding, filler words, or long preambles (e.g. avoid "Got it!", "Perfect!", "Now let's..."). Just acknowledge the data simply if needed, or ask the next question directly.
3. If the user gives multiple answers in one message, extract all of them.
4. NEVER fabricate data. Only record what the user explicitly tells you.
5. You MUST end EVERY response with a "?" question about the next missing field.
6. If ALL fields are filled, say "Great, we have all your business details!" and end with "?"`,
    transitionMessage: 'Great! We have all the business details.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 2 — BRAND
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: 'brand-strategy',
    frontendLabel: 'Brand Strategy',
    phase: 'brand',
    fields: [],
    customHandler: 'handleBrandStrategy',
    initialMessage: 'Do you already have a brand for your business?',
    uiOptions: [
      { id: 'has-logo', label: 'Yes, I have a brand & logo' },
      { id: 'no-logo', label: 'Yes, I have a brand but no logo' },
      { id: 'scratch', label: 'No, create everything from scratch' },
    ],
  },

  {
    id: 'brand-identity',
    frontendLabel: 'Brand Identity',
    phase: 'brand',
    fields: [],
    customHandler: 'handleBrandIdentity',
    branchAQuestions: [
      'Do you have a slogan, and how would you describe your brand\'s personality, positioning, and target audience? (Or type \'skip\')',
      'How would you describe your services, materials used, and key benefits? (Or type \'skip\')',
      'What is the visual mood of your brand — lighting style, textures, atmosphere? (Or type \'skip\')',
    ],
    branchBQuestions: [
      'Do you have a slogan, and how would you describe your brand\'s personality and target audience?',
      'What are your brand\'s color palette and typography/font preferences? (Share hex codes if you have them)',
      'How would you describe your services, materials used, and key benefits?',
      'What is the visual mood of your brand — lighting style, textures, atmosphere?'
    ],
  },

  {
    id: 'theme',
    frontendLabel: 'Theme Selection',
    phase: 'brand',
    fields: [],
    customHandler: 'handleThemeSelection',
    initialMessage: 'Which design theme would you prefer for your website?',
    uiOptions: [
      { id: 'editorial-luxury', label: 'Editorial Luxury', description: 'Earthy, Magazine-style' },
      { id: 'modern-minimalist', label: 'Modern Minimalist', description: 'Crisp, High Contrast' },
      { id: 'soft-organic', label: 'Soft & Organic', description: 'Rounded, Warm' },
      { id: 'dark-bento', label: 'Dark Bento', description: 'Dark Mode, Structured' },
      { id: 'awesomic', label: 'Awesomic', description: 'Technical Marketplace' },
      { id: 'mercury', label: 'Mercury', description: 'Alpine Banking' },
      { id: 'hyer-aviation', label: 'Hyer Aviation', description: 'Luxury Travel Editorial' },
      { id: 'superpower', label: 'Superpower', description: 'Cinematic Health Tech' },
      { id: '11x-editorial', label: '11x', description: 'Cinematic Editorial Serif' },
    ],
  },

  {
    id: 'brand-recap',
    frontendLabel: 'Brand Confirmation',
    phase: 'brand',
    fields: [],
    customHandler: 'handleBrandRecap',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3 — WEBSITE GENERATION
  // ═══════════════════════════════════════════════════════════════════════



  {
    id: 'generation',
    frontendLabel: 'Generate Website',
    phase: 'generation',
    fields: [],
    customHandler: 'handleGeneration',
    initialMessage: 'All done! I am now generating your high-converting website in the background...',
  },
];

// ─── Helpers (DRY access) ───────────────────────────────────────────────

/** Get all field keys for a given step (convenience for checkCompleteness) */
export function getFieldKeys(step: OnboardingStep): string[] {
  return step.fields.map(f => f.key);
}

/** Get the question text for a specific field key within a step */
export function getFieldQuestion(step: OnboardingStep, fieldKey: string): string | undefined {
  return step.fields.find(f => f.key === fieldKey)?.question;
}

/** Find a step by its id */
export function findStepById(id: string): OnboardingStep | undefined {
  return ONBOARDING_FLOW_CONFIG.find(s => s.id === id);
}

/** Get all steps belonging to a phase */
export function getStepsByPhase(phase: OnboardingStep['phase']): OnboardingStep[] {
  return ONBOARDING_FLOW_CONFIG.filter(s => s.phase === phase);
}

