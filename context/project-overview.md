# Project Overview

## About the Project

**LOCAL EMPIRE — AI Contractor Website Builder** is an AI-powered website generation platform for home-service contractors (decking, remodeling, roofing, HVAC, plumbing, electrical, painting). It replaces expensive agency websites with AI-generated, SEO-optimized sites that a contractor can build in a single conversation — by text or voice.

A contractor signs in with Google, answers a conversational interview, and the platform generates a complete multi-page Next.js site: brand identity, design system, page structure, section-level copy, SEO metadata, sitemap, robots.txt, JSON-LD, and internal links. The site deploys to Vercel with Incremental Static Regeneration on a custom domain, with Google Analytics, Search Console, and Tag Manager auto-provisioned, and contact-form leads forwarded to the contractor's Gmail.

This repository is the **NestJS backend**. It owns the interview, the AI skill pipeline, persistence, queueing, third-party integrations, billing, and deployment orchestration. The React/Zustand frontend is a separate application that consumes this API.

---

## The Problem It Solves

A contractor who needs a website has three bad options: pay an agency thousands of dollars and wait weeks, use a DIY builder and produce something that never ranks, or do nothing. All three lose them local search traffic to competitors.

Generating that site naively with one large LLM call fails in predictable ways — malformed JSON, duplicate copy across pages, broken internal links, keyword stuffing, and no way to recover when a single section fails.

This service solves the hard version: **structured pipeline, AI-generated copy.** The page list, section types, link graph, and SEO artifacts are computed in code. The LLM is asked only to fill content into slots whose shape is already fixed. Every skill output is schema-validated, retried on failure, and falls back to a known-good static section rather than failing the whole page.

---

## What the Product Does

| Capability | Description |
| ---------- | ----------- |
| AI Interview Agent | Conversational interview collecting business data, services, service areas, and brand preferences. Pre-fills from Google Business Profile. |
| Skills System | Generates the site through specialized AI skills: Brand Identity, Brand Voice, Design System, Page Structure, Section Content, SEO Metadata. |
| SEO Keyword Engine | Google Ads API for high-volume keywords per trade and service area. Generates sitemap.xml, robots.txt, JSON-LD, Open Graph tags, internal linking. |
| Site Generation | Complete multi-page Next.js site deployed to Vercel with ISR. Mobile-first, Lighthouse ≥ 90 target. |
| Asset Pipeline | Logo and photo upload, auto-converted to WebP, stored in Cloudflare R2. Trade-matched stock fallback. |
| Chat-Driven Edits | Contractor requests changes in chat; the AI updates the site and regenerates. |
| Voice Mode | Build a site entirely by voice over WebRTC (OpenAI Realtime). **Sprint 4 — interface only, not implemented.** |
| Domain & Deployment | Search, purchase, and auto-configure a custom domain with DNS and SSL via Vercel. |
| Analytics & Tracking | Auto-provisions Google Search Console, GA4, and Google Tag Manager per launched site. |
| Lead Forwarding | Contact form submissions emailed to the contractor's Gmail over SMTP. |
| Stripe Billing | Free to interview and preview. Paid to launch and host. Production-only; dev bypasses payment entirely. |

---

## API Surface

36 routes across 15 controllers. No global prefix or versioning is configured — paths are exactly as written.

```
Auth
GET    /auth/google                                 → Start Google OAuth
GET    /auth/google/callback                        → OAuth callback, issues JWT cookies
GET    /auth/me                                     → Current user
POST   /auth/refresh                                → Rotate access token
POST   /auth/logout                                 → Clear session

Projects
POST   /projects                                    → Create project
GET    /projects                                    → List caller's projects
GET    /projects/:id                                → Project detail
DELETE /projects/:id                                → Delete project
GET    /projects/:id/business-context               → Read interview-collected context
PATCH  /projects/:id/business-context               → Update context
POST   /projects/:id/generate                       → Enqueue site-generation job

Chat / Interview
POST   /chat/:projectId/message                     → Send message, SSE stream back
GET    /chat/:projectId/history                     → Paginated chat history
GET    /gbp/lookup                                  → Google Business Profile lookup

Assets
POST   /projects/:projectId/assets                  → Upload asset
GET    /projects/:projectId/assets                  → List assets
GET    /projects/:projectId/assets/:assetId         → Asset detail
PATCH  /projects/:projectId/assets/:assetId         → Update metadata
DELETE /projects/:projectId/assets/:assetId         → Delete asset

Deployment / Domains
POST   /projects/:projectId/deployment/deploy       → Trigger Vercel deploy
POST   /projects/:projectId/deployment/revalidate   → Trigger ISR revalidation
GET    /projects/:projectId/deployment/status       → Deployment status
GET    /domains/search                              → Domain availability + price
POST   /projects/:projectId/domains/purchase        → Purchase and attach domain

Analytics / Leads
POST   /projects/:projectId/analytics/provision     → Provision GA4 + GTM + GSC
GET    /projects/:projectId/analytics/summary       → Provisioned IDs
POST   /api/projects/:projectId/leads               → Contact form intake → Gmail

Billing
POST   /billing/checkout                            → Stripe Checkout session
GET    /billing/subscription                        → Subscription state
POST   /billing/cancel                              → Cancel subscription
GET    /billing/payments                            → Payment history
POST   /billing/webhook                             → Stripe webhook (raw body)

Public / Health
GET    /public/site-content/:projectId              → Rendered site payload for the Next.js app
GET    /health                                      → Liveness
GET    /                                            → Root
```

---

## Core Flow

### 1. Sign in and create a project

Google OAuth via Passport. A `User` row is created or matched on `googleId`. JWT access and refresh tokens are set as cookies. Every subsequent request carries a user, and `TenantMiddleware` binds that `userId` into an `AsyncLocalStorage` context for the request's lifetime.

### 2. Interview

The contractor chats with the interview agent. `InterviewService.checkCompleteness()` compares the stored `BusinessContext` against `REQUIRED_FIELDS` — nine business fields (`businessName`, `contactPerson`, `businessAddress`, `phone`, `email`, `trade`, `services`, `serviceAreas`, `hours`) and four brand fields (`brandVoicePreference`, `primaryColor`, `secondaryColor`, `fontStyle`).

`InterviewPromptBuilder` builds a system prompt naming the still-missing fields. The reply streams back over SSE. `InterviewExtractorService` pulls structured values out of the exchange and persists them to `BusinessContext`. Google Business Profile lookup can pre-fill much of this before the first question.

### 3. Enqueue generation

`POST /projects/:id/generate` writes nothing but a queue message. `GenerationProducer` adds a job to the BullMQ `site-generation` queue and returns immediately. The API process never runs the pipeline.

### 4. Skill pipeline

`GenerationConsumer` picks the job up in the worker process and calls `GenerationService.generateProject()`, which sets `WebsiteData.generationStatus = 'generating'` and hands off to `OrchestratorService.generateWebsite()`. Three phases:

**Phase 1 — parallel.** `BrandIdentitySkill` and `BrandVoiceSkill` run concurrently under `Promise.allSettled`. Either rejecting fails the whole run.

**Phase 2 — sequential.** `DesignSystemSkill` consumes the brand identity result and produces design tokens.

**Phase 3 — SEO in parallel with pages.** `SeoMetadataSkill` is started but not awaited. Meanwhile the page list is computed deterministically in code:

```
home, about-us, services, service-areas, portfolio, contact
+ services/<slug>       for every service
+ service-areas/<slug>  for every service area
```

For each page, `PageStructureSkill` returns an ordered list of section types. Each section is then generated by `SectionContentSkill`, sequentially, with up to three attempts. A section that exhausts its retries is replaced by a static fallback from `getFallbackSection()` rather than failing the page. Completed pages are written to the `Page` table through an `onPageGenerated` callback as they finish, so partial progress survives a later failure.

### 5. SEO artifacts and assembly

`SeoArtifactsService` computes `sitemap.xml`, `robots.txt`, JSON-LD, and the internal link map from the finished page list — pure functions, no LLM. All of it plus design tokens and SEO metadata is upserted onto `WebsiteData`, status `deploying`.

### 6. Build and deploy

`NextjsBuilderService.buildAndDeploy()` assembles the Next.js project and pushes it through `VercelClient`. On success `WebsiteData.generationStatus` becomes `completed`; on any thrown error the catch sets `failed`.

### 7. Launch

Stripe Checkout gates launch in production; `BYPASS_BILLING=true` skips it in development. Domain purchase and DNS run through Vercel. Analytics provisioning and lead forwarding are separate queued jobs.

---

## Generated Site Structure

Six fixed pages plus one page per service and one per service area. Section types observed in the fallback table:

```
HeroSection            PageHeaderSection     BrandsSection
ServicesSection        AboutSection          WhyUsSection
BeforeAfterSection     TimelineSection       TestimonialsSection
LocationsSection       ServiceDetailsSection CallToActionSection
```

Pages are stored one row per page in `Page`, keyed `@@unique([projectId, slug])`, with `content` as a `jsonb` array of sections. The Next.js frontend fetches the whole payload from `GET /public/site-content/:projectId`.

---

## Features In Scope

- Google OAuth sign-in with Gmail SMTP scope
- Multi-tenant project isolation
- Conversational interview with GBP pre-fill
- Six-skill AI generation pipeline with retry and fallback
- Deterministic page list, SEO artifacts, and internal linking
- Asset upload to R2 with WebP conversion
- Chat-driven edits and regeneration
- Vercel ISR deployment, domain purchase, DNS
- GA4 / GTM / GSC provisioning
- Gmail lead forwarding
- Stripe subscription billing with dev bypass
- Guardrails: input sanitization and Zod output validation

## Features Out of Scope

- **Voice mode** — `voice-adapter.interface.ts` is an explicitly labelled Sprint 4 placeholder
- **Frontend** — separate repository; this service is JSON-only
- **Incremental single-page regeneration** — post-beta, currently full-site only
- **Team/RBAC, subscription tiers, multilingual, franchise support** — post-GA backlog
- **Inline visual editor** — post-GA backlog

---

## Target User

US home-service contractors — roofing, HVAC, plumbing, decking, remodeling, electrical, painting — who need a local-SEO site and have no design skills, no agency budget, and no patience for a page builder. The first cohort is 15–20 hand-picked Contracting Empire contractors in private beta.

---

## Success Criteria

| Metric | Target |
| ------ | ------ |
| Full site generation | < 60s |
| Incremental regeneration | < 30s |
| Lighthouse Performance / Accessibility / SEO | ≥ 90 each |
| Interview → launched site | one sitting, no design skills |
| Analytics provisioning | GA4, GTM, GSC all created per launched site |
| Billing reconciliation | 7-day clean run, Stripe ↔ DB |

---

## Related Documents

- [`architecture.md`](architecture.md) — stack, modules, schema, data flow, invariants
- [`code-standards.md`](code-standards.md) — conventions this codebase actually follows
- [`build-plan.md`](build-plan.md) — the phased roadmap and what each phase owns
- [`progress-tracker.md`](progress-tracker.md) — what is built as of 2026-09-01
- [`library-docs.md`](library-docs.md) — the installed libraries and how they are used
- [`integration-test.md`](integration-test.md) — end-to-end exercise via the API
- [`review-notes.md`](review-notes.md) — known gaps, risks, and decisions to revisit
