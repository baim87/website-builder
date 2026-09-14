import { ASSET_PURPOSE } from '../../assets/constants/asset-purpose.constant';

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
  /** New UI-driven strategic brand interview questions */
  interviewQuestions?: BrandInterviewQuestion[];
}

export interface BrandInterviewQuestion {
  id: string;
  question: string;
  type: 'multi-select' | 'single-select' | 'free-text' | 'upload';
  fieldKey: string;
  options?: UiOption[];
  allowCustomInput?: boolean;
  maxSelections?: number;
  optional?: boolean;
  placeholder?: string;
  uploadConfig?: { type: string; purpose: string };
  conditionalOn?: { field: string; value: any; negate?: boolean };
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
    id: 'brand-interview',
    frontendLabel: 'Brand Interview',
    phase: 'brand',
    fields: [],
    customHandler: 'handleBrandInterview',
    interviewQuestions: [
      {
        id: 'targetAudience',
        fieldKey: 'targetAudience',
        question: 'Who do you primarily serve?',
        type: 'multi-select',
        allowCustomInput: true,
        options: [
          { id: 'residential', label: 'Residential Homeowners' },
          { id: 'commercial', label: 'Commercial Businesses' },
          { id: 'property-managers', label: 'Property Managers' },
          { id: 'builders', label: 'General Contractors & Builders' },
        ],
      },
      {
        id: 'desiredSegments',
        fieldKey: 'desiredSegments',
        question: 'Who do you want more of?',
        type: 'multi-select',
        allowCustomInput: true,
        options: [
          { id: 'high-end', label: 'High-end / Luxury clients' },
          { id: 'budget', label: 'Budget-conscious clients' },
          { id: 'maintenance', label: 'Recurring maintenance clients' },
          { id: 'large-projects', label: 'Large remodeling/install projects' },
        ],
      },
      {
        id: 'customerFears',
        fieldKey: 'customerFears',
        question: 'What worries customers most when hiring someone like you?',
        type: 'multi-select',
        allowCustomInput: true,
        options: [
          { id: 'unreliable', label: 'Contractors not showing up or finishing late' },
          { id: 'messy', label: 'Leaving a mess in their home' },
          { id: 'hidden-fees', label: 'Hidden fees or going over budget' },
          { id: 'poor-quality', label: 'Poor quality work that won\'t last' },
          { id: 'unprofessional', label: 'Unprofessional behavior' },
        ],
      },
      {
        id: 'corePromise',
        fieldKey: 'corePromise',
        question: 'What do you want customers to trust you for most?',
        type: 'single-select',
        allowCustomInput: true,
        options: [
          { id: 'quality', label: 'Uncompromising Quality & Craftsmanship' },
          { id: 'speed', label: 'Speed & Efficiency' },
          { id: 'service', label: 'White-glove Customer Service' },
          { id: 'affordability', label: 'Fair & Transparent Pricing' },
        ],
      },
      {
        id: 'differentiators',
        fieldKey: 'differentiators',
        question: 'Why should customers choose you over others?',
        type: 'multi-select',
        allowCustomInput: true,
        options: [
          { id: 'family-owned', label: 'Family Owned & Operated' },
          { id: 'experience', label: 'Decades of Experience' },
          { id: 'warranty', label: 'Industry-leading Warranty' },
          { id: 'speed', label: 'Fastest Response Time' },
          { id: 'clean', label: 'Cleanest Job Sites' },
        ],
      },
      {
        id: 'proofPoints',
        fieldKey: 'proofPoints',
        question: 'What can you prove about your company?',
        type: 'multi-select',
        allowCustomInput: true,
        options: [
          { id: 'licensed', label: 'Fully Licensed & Insured' },
          { id: 'reviews', label: '100+ 5-Star Reviews' },
          { id: 'awards', label: 'Award-winning Service' },
          { id: 'guarantee', label: '100% Satisfaction Guarantee' },
        ],
      },
      {
        id: 'brandPersonality',
        fieldKey: 'brandPersonality',
        question: 'How should your company feel? (Pick up to 3)',
        type: 'multi-select',
        maxSelections: 3,
        allowCustomInput: true,
        options: [
          { id: 'professional', label: 'Professional & Corporate' },
          { id: 'friendly', label: 'Friendly & Approachable' },
          { id: 'rugged', label: 'Rugged & Tough' },
          { id: 'luxury', label: 'Premium & High-End' },
          { id: 'modern', label: 'Modern & Innovative' },
          { id: 'traditional', label: 'Traditional & Classic' },
        ],
      },
      {
        id: 'competitors',
        fieldKey: 'competitors',
        question: 'Who are customers comparing you with?',
        type: 'free-text',
        placeholder: 'e.g., ABC Plumbing, Joe\'s Roofing',
        optional: true,
      },
      {
        id: 'companyAmbition',
        fieldKey: 'companyAmbition',
        question: 'Where do you want the company to go?',
        type: 'single-select',
        options: [
          { id: 'local-leader', label: 'Be the undisputed #1 in my city' },
          { id: 'regional', label: 'Expand across multiple regions/states' },
          { id: 'boutique', label: 'Stay small and highly profitable' },
          { id: 'franchise', label: 'Franchise the model' },
        ],
      },
      {
        id: 'founderStory',
        fieldKey: 'founderStory',
        question: 'What makes your company story worth telling?',
        type: 'free-text',
        placeholder: 'e.g., Started by my grandfather in 1985...',
        optional: true,
      },
      {
        id: 'visualDirection',
        fieldKey: 'visualDirection',
        question: 'What should your brand look and feel like?',
        type: 'single-select',
        allowCustomInput: true,
        options: [
          { id: 'bold', label: 'Bold & High Contrast' },
          { id: 'clean', label: 'Clean & Minimalist' },
          { id: 'warm', label: 'Warm & Organic' },
          { id: 'classic', label: 'Classic & Heritage' },
          { id: 'technical', label: 'Technical & Engineered' },
        ],
      },
      {
        id: 'colorPreferences',
        fieldKey: 'colorPreferences',
        question: 'Any colors you want or don\'t want?',
        type: 'free-text',
        placeholder: 'e.g., I love navy blue, please no red.',
        optional: true,
      },
      {
        id: 'existingLogoFeedback',
        fieldKey: 'existingLogoFeedback',
        question: 'What do you want to keep or change about your current branding?',
        type: 'free-text',
        optional: true,
        conditionalOn: { field: 'brandStrategySelection', value: 'has-logo' },
      },
      {
        id: 'ownerPortrait',
        fieldKey: 'ownerPortrait',
        question: 'Got a photo of the owner or team? We\'ll create a professional portrait that matches your brand.',
        type: 'upload',
        optional: true,
        uploadConfig: { type: 'image', purpose: ASSET_PURPOSE.PORTRAIT },
      },
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

