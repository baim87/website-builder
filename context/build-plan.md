# Build Plan

Source: **LOCAL EMPIRE — Product Roadmap & Development Plan** (`context/LOCAL EMPIRE - NEW VISION SIMPLIFIED.pdf`, 13 pages). Dates are from that document. The **Status** column reconciles each item against the working tree on 2026-09-01 and is this file's own addition.

Status legend: **Done** — implemented and wired. **Partial** — code exists but is incomplete, unregistered, or unverified. **Not started** — no code. **N/A** — not a backend concern.

---

## Core Principle

Each phase ends with something demonstrable. The order is deliberate: infrastructure before generation, generation before payment, payment before scale. Nothing in a later phase is started to avoid finishing something in an earlier one.

---

## Phase 0 — Architecture & Design
**Aug 18 – Aug 20, 2026**

Produce specs detailed enough that AI coding agents can execute development sprints autonomously.

| Item | Due | Status |
| ---- | --- | ------ |
| System architecture document (service diagram, infra topology) | Aug 18 | Done — see `architecture.md` |
| API contract specification (endpoints, schemas, auth) | Aug 18 | Partial — routes exist, no OpenAPI/Swagger |
| Prisma schema finalization + clean migration | Aug 18 | Done — 13 models, 3 migrations |
| Frontend component tree + Zustand store design | Aug 19 | N/A — separate repo |
| Per-sprint agent execution specs (Sprint 1, 2, 3) | Aug 19 | Partial — this context folder |
| AIGateway adapter interface contract | Aug 19 | Done — `TextAdapter`, `ModelRegistry` |
| Skills System interface contract | Aug 20 | Done — `Skill`, `SkillInput`, `SkillOutput` |
| All third-party API keys provisioned | Aug 20 | Done — `.env.example` is the canonical list |
| Cloud infrastructure provisioned (Sliplane, Postgres, Redis, R2) | Aug 20 | Done — `DEPLOY.md`, `docker-compose.yml` |

---

## Phase 1 — Foundation (Sprint 1)
**Aug 21 – Aug 26, 2026**

Build the infrastructure layer that everything else depends on.

| Item | Due | Status |
| ---- | --- | ------ |
| NestJS application scaffold | Aug 21 | Done |
| Prisma schema + migration (10 models) | Aug 21 | Done — 13 models incl. `Page`, `StripeEvent` |
| Google OAuth sign-in (with Gmail SMTP scope) | Aug 21 | Done — `auth/`, Passport strategies |
| Multi-tenant isolation middleware | Aug 21 | **Partial** — covers list/bulk ops only; see `review-notes.md` |
| AIGateway abstraction (Claude Fable adapter) | Aug 24 | Done |
| BullMQ infrastructure (queues, base job class, retry patterns) | Aug 24 | Done — `BaseConsumer`, `BaseProducer` |
| Cloudflare R2 client (upload/download/delete) | Aug 24 | Done — `storage/` |
| Google Ads keyword service + Redis cache (7-day TTL) | Aug 24 | Done — `keywords/` |
| Stripe dev bypass middleware (`BYPASS_BILLING=true`) | Aug 24 | Done — middleware + `BillingGuard` |
| Docker Compose dev env (Postgres, Redis, MinIO) | Aug 26 | Done |
| CI pipeline (lint + type-check + tests) | Aug 26 | **Not started** — no workflow file in repo |
| Integration tests (auth, tenancy, AIGateway, BullMQ, R2, keywords) | Aug 26 | Partial — specs exist, several do not type-check |

---

## Phase 2 — Core Generation Loop (Sprint 2)
**Aug 27 – Sep 9, 2026** ← *current phase as of 2026-09-01*

Build the core product: interview → generate → preview → edit. This is where the product's value is proven.

### Walking Skeleton

| Item | Due | Status |
| ---- | --- | ------ |
| Chat backend (NestJS SSE endpoint, message persistence) | Aug 27–28 | Done — `ChatService`, `ChatStreamService` |
| Chat UI (React + Zustand + SSE streaming) | Aug 27–28 | N/A — separate repo |
| Interview agent scaffolding + system prompt v1 | Aug 28 | Done — `InterviewPromptBuilder` |
| Skill orchestration framework + `SkillInvocation` logging | Aug 31 | Done |
| Brand Identity skill | Aug 31 | Done |
| Brand Voice skill | Aug 31 | Done |
| SEO skill + keyword data integration | Sep 1 | Partial — `SeoMetadataSkill` done; keyword data not yet fed into it |
| Content Generation skill + keyword targeting | Sep 1 | Partial — split into `PageStructureSkill` + `SectionContentSkill`; keyword targeting absent |
| Website Design skill | Sep 1 | Done — `DesignSystemSkill` |
| Site generation BullMQ job (Next.js ISR output) | Sep 2 | Done — `GenerationConsumer` → `NextjsBuilderService` |
| SEO artifact generation (sitemap, robots, JSON-LD, OG) | Sep 2 | Done — `SeoArtifactsService` |
| Internal link building | Sep 2 | Done — `generateInternalLinks()` |
| Preview rendering (new tab) | Sep 3 | Partial — `GET /public/site-content/:projectId` serves the payload |
| Walking Skeleton review | Sep 3 | Pending |

### Full Generation Loop + Beta Prep

| Item | Due | Status |
| ---- | --- | ------ |
| GBP data lookup + BusinessContext pre-fill | Sep 4 | Done — `gbp/` |
| Asset upload endpoint + R2 storage + WebP conversion job | Sep 4 | Done — `assets/`, `asset-conversion` queue |
| Asset gallery UI component | Sep 4 | N/A — separate repo |
| Stock photo fallback (trade-matched) | Sep 4 | Partial — Unsplash URLs hardcoded in `getFallbackSection()` |
| Chat-driven edit flow (intent → update → regen → refresh) | Sep 7 | **Not started** |
| Project list UI + chat history persistence | Sep 7 | Backend done (`GET /chat/:projectId/history`) |
| Guardrails v1 (scope lock, sanitization, intent refusal) | Sep 8 | Partial — sanitizer + output validator exist |
| Adversarial prompt test suite (20 prompts) | Sep 8 | **Not started** |
| Bug fixes + polish from Walking Skeleton review | Sep 9 | Pending |

---

## Phase 3 — Payments + Deployment (Sprint 3)
**Sep 10 – Sep 15, 2026**

Close the revenue loop.

| Item | Due | Status |
| ---- | --- | ------ |
| Stripe Checkout integration + webhook handler | Sep 10 | Done — `StripeEvent` gives idempotency |
| Subscription state machine + payment gate UI | Sep 10 | Backend done — `BillingGuard` |
| Vercel ISR deployment service (API-driven) | Sep 10 | Partial — `VercelClient` returns mock when unconfigured |
| Domain search + purchase (Vercel domain API) | Sep 10 | Done — `domain/` |
| DNS auto-configuration | Sep 10 | Partial — inside `VercelClient` |
| Google Search Console verification + sitemap submission | Sep 11 | Done — `gsc.client.ts` |
| GA4 property creation + code injection | Sep 11 | Done — `ga4.client.ts` |
| GTM container creation + conversion tags | Sep 11 | Done — `gtm.client.ts` |
| Gmail SMTP lead forwarding | Sep 14 | Done — `leads/`, in-app not serverless |
| Billing reconciliation BullMQ job (daily Stripe ↔ DB) | Sep 14 | Done — `reconcileAllSubscriptions()` |
| Subscription management UI | Sep 14 | Backend done — cancel/list endpoints |
| Edge case fixes + error handling polish | Sep 15 | Pending |

Much of Phase 3 landed early — the backend for billing, domains, analytics, and leads already exists ahead of its dates.

---

## Phase 4 — Internal QA
**Sep 16 – Sep 18, 2026**

Systematic testing before any external user touches the product.

| Item | Due | Status |
| ---- | --- | ------ |
| Full E2E flow testing (roofing, HVAC, plumbing) | Sep 16 | Not started |
| Multi-tenant security audit (cross-tenant access on all endpoints) | Sep 16 | **Not started — highest-priority item**, given the middleware gap |
| Prompt injection adversarial suite (50 prompts) | Sep 16 | Not started |
| Stripe payment edge cases | Sep 17 | Not started |
| Performance benchmarks (generation p50/p95, chat first token, ISR build) | Sep 17 | Not started |
| SEO artifact validation | Sep 17 | Not started |
| ISR revalidation verification | Sep 17 | Not started |
| Analytics provisioning E2E | Sep 17 | Not started |
| Lead email delivery test | Sep 17 | Not started |
| Lighthouse audit (Perf / A11y / SEO ≥ 90) | Sep 18 | Not started |
| Dev bypass verification (Stripe skipped in dev, enforced in prod) | Sep 18 | Not started |
| Regression run | Sep 18 | Not started |

---

## Phase 5 — Internal Alpha
**Sep 18 – Sep 24, 2026**

Dogfood the full product daily, generating real contractor sites.

| Item | Due |
| ---- | --- |
| Generate roofing contractor site end-to-end, note friction | Sep 18 |
| Generate HVAC site, rapid-fire interview style | Sep 21 |
| Generate plumbing site with asset uploads + stock fallback | Sep 22 |
| Payment flow E2E (subscribe → deploy → domain → verify live) | Sep 23 |
| Resume flow (close browser → return) and fresh account | Sep 24 |
| Verify GA4/GTM/GSC on 2 launched sites | Sep 24 |
| Verify lead emails arriving from contact form | Sep 24 |
| Prepare beta invite email, onboarding guide, feedback form | Sep 24 |

---

## Phase 6 — Private Beta (Contracting Empire)
**Sep 25 – Oct 23, 2026**

First external users. 10–20 hand-picked Contracting Empire contractors.

| Item | Due |
| ---- | --- |
| Send invites to 15–20 contractors | Sep 25 |
| Live onboarding calls for first 5 | Sep 25 |
| Monitor first-wave usage in real time | Sep 28–30 |
| Collect feedback batch + completion rates | Oct 1–2 |
| Push prompt fixes from feedback | Oct 5–6 |
| Contact drop-off contractors | Oct 5–6 |
| Convert beta contractors to paid | Oct 6–7 |
| 7-day billing reconciliation clean run | Oct 7–8 |
| Compile beta metrics | Oct 8 |

### Parallel: Voice Mode (Sprint 4)

| Item | Due | Status |
| ---- | --- | ------ |
| AIGateway voice adapter (OpenAI Realtime) | Oct 8–9 | Interface placeholder only |
| WebRTC connection manager | Oct 12 | Not started |
| Voice-first UI component | Oct 13 | N/A |
| AIGateway voice adapter (Gemini Live) | Oct 13–14 | Not started |
| Voice transcript persistence + voice ↔ text context | Oct 15 | Partial — `ChatMessage.voiceTranscript` column exists |
| Incremental regeneration (single page, not full site) | Oct 16–19 | Not started |
| Visual diff on preview | Oct 19–20 | Not started |
| Performance optimization (< 60s generation, < 30s incremental) | Oct 21–22 | Not started |
| Voice latency testing | Oct 22–23 | Not started |

---

## Phase 7 — Public Beta
**Oct 26 – Nov 20, 2026**

Open registration. "Beta" badge remains.

| Item | Due |
| ---- | --- |
| Open registration + post to CE channels | Oct 26 |
| Monitor organic signups and usage | Oct 26–28 |
| Address new trade/persona issues | Oct 28–30 |
| Monitor infrastructure load + unit economics | Nov 2–3 |
| 3-day stability soak (critical fixes only) | Nov 3–5 |
| Prepare GA launch materials | Nov 6 |

### Parallel: Growth Features (Sprint 5) — Nov 9–20

Team invite + RBAC (Nov 9–11) · Subscription tier infrastructure (Nov 12) · Advanced SEO skill: blog, FAQ, schema.org (Nov 13–16) · Abuse monitoring dashboard + guardrail alerting (Nov 16–17) · Onboarding quick mode: name + trade + address → generate (Nov 18) · In-product analytics dashboard (Nov 18–19) · Polish (Nov 20)

---

## Phase 8 — General Availability
**November 23, 2026**

Remove the beta badge. Public launch.

- Remove "beta" badge from UI
- Publish marketing landing page
- Contracting Empire launch announcement (email, YouTube, community)
- Stripe in live mode
- Monitoring dashboards active (infra, billing, guardrails, usage)
- Incident response process defined
- Support email/chat channel live

---

## Ongoing — Stable / Continuous Release
**From November 23, 2026**

- **Weekly:** bug fixes, prompt refinements, UX polish
- **Bi-weekly:** feature releases (new skills, UI improvements)
- **Monthly:** metrics review (churn, NPS, unit economics)

**Post-GA backlog:** additional trade templates · domain renewal management · video upload + site embedding · competitor differentiation skill · inline visual editor (click-to-edit) · multi-location / franchise support · multilingual site generation · export / migration tools

---

## Priority Under Time Pressure

If the schedule slips, this is the order things survive in:

1. **The generation loop.** Interview → skills → pages → SEO artifacts. Without this there is no product.
2. **Tenant isolation.** A cross-tenant leak in beta is unrecoverable reputationally.
3. **Billing correctness.** Charging wrongly is worse than not charging.
4. **Deployment.** A generated site nobody can visit is not a deliverable.
5. **Analytics provisioning.** Valuable, but a site works without it.
6. **Voice mode.** Explicitly parallel and explicitly last.
