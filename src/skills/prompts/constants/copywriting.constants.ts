export const BANNED_PHRASES = [
  "you've come to the right place",
  "peace of mind",
  "takes a beating",
  "we get it",
  "you're not alone",
  "dive deep",
  "in this guide",
  "in this article",
  "in this post",
  "here's the short version",
  "hardworking room",
  "hardworking kitchen",
  "hardworking bathroom",
  "cook, host, and gather",
];

export const BANNED_FEINTS = [
  "it's not about X, about Y",
  "this isn't just an X; it's a...",
  "don't just X, Y",
  "No X. No Y.",
];

export const BANNED_REFLEX_CTAS = [
  "ready to",
  "looking to",
  "imagine",
];

export const COPYWRITING_RULES = `
## AGENCY HOUSE STYLE — MANDATORY COPYWRITING FRAMEWORK

### BANNED CONTENT (NEVER USE)
- Banned phrases: ${BANNED_PHRASES.join(', ')}.
- Banned contrastive feints: ${BANNED_FEINTS.join(', ')}.
- Banned reflex CTAs: ${BANNED_REFLEX_CTAS.join(', ')}.
- NEVER use SaaS/tech buzzwords: "seamless", "robust", "cutting-edge", "game-changer", "disruptive", "leverage", "synergy", "scalable", "world-class", "best-in-class".
- NEVER start a headline with a gerund (e.g., "Building Better...", "Creating Your..."). Lead with outcomes.
- NEVER use passive voice in headlines or CTAs.

### FRAMEWORK 1 — PAS (Problem → Agitate → Solution)
Use PAS for Hero headlines, WhyUs sections, and any persuasion-heavy copy.
- PROBLEM: Name the specific pain the homeowner feels. Be precise, not generic (e.g., NOT "frustrated with your deck" → YES "watching your deck rot year after year while estimates keep climbing").
- AGITATE: Deepen the emotional consequence. What happens if they don't act? (e.g., "Every season you wait, water damage spreads further into the frame — costing thousands more in repairs.")
- SOLUTION: Position the business as the clear, specific fix. (e.g., "Our licensed team replaces and builds decks that last 20+ years. Fixed-price quotes. Done in days, not weeks.")

### FRAMEWORK 2 — BAB (Before → After → Bridge)
Use BAB for testimonial setups, About sections, and service page intros.
- BEFORE: Describe the reader's current situation honestly. (e.g., "You have a crumbling deck that's too dangerous to use.")
- AFTER: Paint a vivid picture of the desired outcome. (e.g., "You're hosting a summer barbecue on a sturdy, beautiful new deck.")
- BRIDGE: State exactly how this business gets them from Before to After. (e.g., "We handle permits, materials, and installation — start to finish, in one week.")

### FRAMEWORK 3 — 4U HEADLINES (Useful, Urgent, Unique, Ultra-specific)
Every primary headline MUST score on at least 3 of the 4U criteria:
- USEFUL: Does it promise a clear benefit? (e.g., "Stop Water Damage at the Source")
- URGENT: Does it imply cost of inaction or a time element? (e.g., "Before the Next Rain Season")
- UNIQUE: Does it set this business apart from competitors? (e.g., "The Only Deck Builder in [City] with a 10-Year Workmanship Warranty")
- ULTRA-SPECIFIC: Does it use numbers, proper nouns, or concrete details? (e.g., "320 Decks Built Across [County]")

### FRAMEWORK 4 — POWER WORDS (USE LIBERALLY)
Inject these types of words into CTAs, badges, and section titles:
- TRUST POWER WORDS: Licensed, Insured, Bonded, Certified, Vetted, Verified, Guaranteed, Warranted, Permitted.
- SPEED POWER WORDS: Same-day, 24-hour response, Fast-turnaround, On-time, No delays.
- VALUE POWER WORDS: Fixed-price, No hidden fees, Free estimate, Transparent, Upfront quote.
- SOCIAL PROOF POWER WORDS: 5-star rated, Award-winning, Recommended by neighbors, Trusted by [N]+ homeowners.
- OUTCOME POWER WORDS: Finished, Completed, Done right, Built to last, Worry-free, Stress-free results.

### FRAMEWORK 5 — TRUST SIGNAL HIERARCHY
When writing trust signals, badges, and USPs, use this priority order:
1. Specific numbers (years in business, projects completed, rating score, response time).
2. Third-party certifications (BBB, HomeAdvisor, Angi, manufacturer certifications).
3. Legal standing (Licensed & Insured, Permit-pulling capability).
4. Guarantees with specifics (e.g., "1-year labor warranty" NOT just "guaranteed work").
5. Social proof (reviews count, average rating, named location).

### PROVEN HEADLINE FORMULAS (use as inspiration, not templates)
- "[Specific Outcome] Without [Common Fear]" — e.g., "A New Roof Without the Contractor Horror Stories"
- "The [City] [Trade] That [Specific Differentiator]" — e.g., "The Dallas Deck Builder That Pulls Its Own Permits"
- "[Number] [Homeowners/Clients] Can't Be Wrong" — e.g., "320+ Austin Homeowners Trust Us With Their Biggest Investment"
- "Finally, a [Trade] Who [Customer Promise]" — e.g., "Finally, a Roofer Who Shows Up When They Say They Will"
- "Get [Specific Outcome] in [Specific Timeframe]" — e.g., "Get a New Composite Deck Installed in 5 Days"

### POSITIVE WRITING RULES
- Write plain, active, direct statements. Subject → Verb → Outcome.
- Use second-person "you/your" to address the homeowner directly.
- Keep sentences short (≤20 words for headlines, ≤30 words for body copy).
- Every paragraph should end with momentum — either a micro-proof or a forward motion statement.
- Vary sentence rhythm: short punch. Then a slightly longer explanatory beat. Then action.

### HEADLINE BALANCE RULE (Hook × SEO × Visual — MANDATORY)
Every primary hero or page headline MUST balance all three dimensions simultaneously:

**HOOK (Emotional):** The headline must lead with a customer-felt outcome or pain, NOT with the service name.
  - ❌ BAD: "Deck Building & Deck Repair in Omaha, Done the Bros Way" (starts with the service, generic, too long)
  - ✅ GOOD: "Omaha's Trusted Deck Builder — Custom Trex Decks in 5 Days"

**SEO (Discoverability):** Include the PRIMARY keyword (trade + city) naturally in the headline or the first 10 words of the subtitle. Do NOT force the keyword into an awkward position just to pack it in.
  - The city + trade keyword belongs in the SUBTITLE or EYEBROW if it makes the headline clumsy.
  - A clean hook headline + an SEO-rich subtitle beats a keyword-stuffed headline every time.

**VISUAL (Rendering):** Headlines MUST be short enough to render in 2 clean lines maximum at desktop width.
  - HARD LIMIT: Hero headlines MUST be ≤ 8 words. If the keyword makes it longer, split across headline + eyebrow.
  - NEVER end a line with a single orphaned word (e.g., a 3-line headline that ends with "Way" alone).
  - Use the em dash (—) to create a natural visual pause that helps the browser wrap cleanly.
  - If the headline + city name + brand name together exceed 8 words, move the city name to the subtitle.

**SPLIT FORMULA (preferred for SEO + clarity):**
  - EYEBROW: "Licensed Deck Contractor · Omaha, NE" (SEO)
  - HEADLINE: "Custom Decks Built to Last" (Hook, ≤5 words)
  - SUBTITLE: "Serving Omaha, Bellevue & Council Bluffs — fixed-price quotes, permitted builds, done in days." (SEO + detail)
`;

