# Architecture

## Stack

Versions are the ranges declared in `package.json`, reconciled against the working tree on 2026-09-01.

| Layer | Tool | Purpose |
| ----- | ---- | ------- |
| Framework | NestJS 11 | HTTP API and worker application framework |
| Language | TypeScript 5.7, `target: ES2023`, `module: nodenext` | Note: `strict` is **not** enabled — see below |
| Runtime | Node 22 (`node:22-alpine`) | Pinned by the Dockerfile |
| Database | PostgreSQL 18 | Users, projects, business context, pages, website data, billing |
| ORM | Prisma 5.22 | Schema, migrations, typed queries, `jsonb` |
| Queue | BullMQ 6.2 via `@nestjs/bullmq` 11 | Async generation, asset conversion, provisioning, reconciliation |
| Queue store | Redis (`ioredis` 6) | BullMQ transport and keyword cache |
| Validation | Zod 4.4 | Env schema, request DTOs, LLM output validation |
| LLM | Anthropic SDK 0.120 — `claude-fable-5`, `claude-haiku-4-5-20251001` | Only text provider wired |
| Object storage | Cloudflare R2 via `@aws-sdk/client-s3` | Logos, photos, converted WebP |
| Media | `sharp` 0.35, `fluent-ffmpeg` | WebP conversion, video processing |
| Payments | `stripe` 22.6 | Checkout, webhooks, subscription state |
| Google APIs | `googleapis` 176, `google-ads-api` 24, `@google-analytics/admin` 10 | OAuth, GBP, Ads keywords, GA4, GTM, GSC |
| Email | `nodemailer` 9 | Gmail SMTP lead forwarding |
| Hosting | Sliplane (Docker) + Vercel (generated sites) | Platform vs. customer sites |
| Testing | Jest 30 + Supertest 7 | E2E specs only — no unit suite |

**Declared in `.env.example` / `env.schema.ts` but not wired to any adapter:** `OPENAI_API_KEY` / `OPENAI_REALTIME_MODEL` and `GEMINI_API_KEY` / `GEMINI_LIVE_MODEL` (voice, Sprint 4), `BRIGHT_DATA_API_KEY`, `SERPAPI_API_KEY`, `GOOGLE_PAGESPEED_API_KEY`, `THROTTLE_TTL` / `THROTTLE_LIMIT` (no `@nestjs/throttler` installed).

---

## Two Processes, One Codebase

The single most important architectural fact about this service.

```
APP_MODE unset / "api"   → HTTP server. Accepts requests, writes Postgres, enqueues jobs.
APP_MODE = "worker"      → No HTTP listener. Consumes BullMQ queues.
```

`src/main.ts` branches on `APP_MODE`. In worker mode it calls `app.init()` and never `app.listen()`. `src/queue/queue.module.ts` branches the other way:

```typescript
const consumers = process.env.APP_MODE !== 'api'
  ? [GenerationConsumer, AssetConversionConsumer, /* ... */]
  : [];
```

Producers are always registered; consumers are registered unless `APP_MODE === 'api'`. Both processes load the identical `AppModule`. This split exists because a BullMQ worker needs a long-running process with a persistent Redis connection.

Consequence worth internalizing: **with `APP_MODE` unset, one process is both API and worker.** That is the default for `npm run start:dev` and is why local runs process their own jobs. `docker-compose.yml` runs them as separate `api` and `worker` services.

---

## Module Map

25 feature modules, all imported flat into `AppModule`.

```
src/
├── main.ts                  APP_MODE branch, CORS, cookie-parser, rawBody for Stripe
├── app.module.ts            imports every module, applies TenantMiddleware to '*'
│
├── config/                  Zod-validated env (ConfigModule.forRoot validate:)
├── prisma/                  PrismaService + tenant middleware ($use)
├── common/                  cross-cutting only — no feature logic
│   ├── constants/           queue-names, project-status, trades
│   ├── decorators/          @CurrentUser, @Public
│   ├── filters/             GlobalExceptionFilter
│   ├── guards/              JwtAuthGuard, BillingGuard
│   ├── interceptors/        TransformInterceptor
│   ├── middleware/          TenantMiddleware (AsyncLocalStorage binding)
│   ├── pipes/               ZodValidationPipe
│   ├── redis/               RedisService (shared ioredis client)
│   └── utils/               error.util (getErrorMessage)
│
├── auth/                    Google OAuth, JWT access + refresh, Passport strategies
├── projects/                Project, BusinessContext, WebsiteData, Page services
├── chat/                    SSE streaming chat, message persistence
├── interview/               completeness check, prompt builder, field extractor
├── gbp/                     Google Business Profile lookup
│
├── ai-gateway/              provider abstraction
│   ├── adapters/            claude-fable.adapter.ts (only implemented adapter)
│   ├── config/              ModelRegistry — model id → adapter
│   └── interfaces/          TextAdapter, VoiceAdapter (Sprint 4 placeholder)
│
├── skills/                  the generation pipeline
│   ├── impl/                6 registered skills + 1 orphan (page-content)
│   ├── schemas/             Zod output schemas
│   ├── orchestrator.service.ts    3-phase pipeline
│   ├── skill-executor.service.ts  invoke + validate + log
│   └── skill-logger.service.ts    SkillInvocation rows
│
├── guardrails/              input sanitizer + Zod output validator
├── generation/              GenerationService, NextjsBuilderService, public site controller
├── seo/                     SeoArtifactsService — sitemap, robots, JSON-LD, links (pure)
├── keywords/                Google Ads client + Redis-cached keyword lookup
├── assets/                  upload, image processor (sharp), video processor
├── storage/                 R2 / S3 client
│
├── queue/
│   ├── producers/           5 producers, always registered
│   └── consumers/           5 consumers, registered unless APP_MODE=api
│
├── billing/                 Stripe checkout, webhook, reconciliation, dev bypass
├── stripe/                  Stripe SDK client wrapper
├── vercel/                  VercelClient — deploy, domains, DNS
├── deployment/              deploy / revalidate / status endpoints
├── domain/                  domain search + purchase
├── analytics/               GA4, GTM, GSC clients + provisioning
├── leads/                   contact form → Gmail SMTP
└── health/                  liveness
```

---

## Data Flow

```
Browser
  │  Google OAuth
  ▼
AuthController ──► JWT cookies ──► TenantMiddleware
                                     │ binds { userId } into AsyncLocalStorage
                                     ▼
                            every Prisma query in this request
                                     │
  POST /chat/:projectId/message      │
  ────────────────────────────►  ChatService (SSE)
                                  │  AIGatewayService.generateStream()
                                  │  InterviewExtractorService → BusinessContext
                                  ▼
  POST /projects/:id/generate ──► GenerationProducer ──► BullMQ 'site-generation'
                                                              │
══════════════ process boundary (API ▲ / worker ▼) ═══════════╪══════════════
                                                              ▼
                                                    GenerationConsumer
                                                              │
                                                    GenerationService
                                                              │
      ┌───────────────────────────────────────────────────────┤
      │ status = 'generating'                                 │
      ▼                                                       ▼
  OrchestratorService.generateWebsite()              BusinessContextService
      │
      ├─ Phase 1  BrandIdentity ∥ BrandVoice     (Promise.allSettled)
      ├─ Phase 2  DesignSystem                   (needs brand identity)
      └─ Phase 3  SeoMetadata (not awaited yet)
                  for each page:
                     PageStructureSkill  → ordered section types
                     for each section:
                        SectionContentSkill (≤3 attempts)
                        └─ on exhaustion → getFallbackSection()
                     onPageGenerated() ──► PageService.upsertPage()
      │
      ▼
  SeoArtifactsService  (pure: sitemap, robots, JSON-LD, internal links)
      │
      ▼
  WebsiteDataService.upsert()  status = 'deploying'
      │
      ▼
  NextjsBuilderService.buildAndDeploy() ──► VercelClient ──► live URL
      │
      ▼
  status = 'completed'          (any throw ──► status = 'failed')
```

Every skill call passes through `SkillExecutorService`, which records a `SkillInvocation` row with `skillType`, `inputHash`, `model`, `tokens`, `latencyMs`, `outputHash`, and `status`. That table is the audit trail for a generation run.

---

## Database Schema

13 models, 3 migrations (`20260824031552_init`, `20260824032916_separate_pages`, `20260827043503_add_stripe_event`).

```
User ──1:N──► Project ──1:1──► BusinessContext
 │              │      ──1:1──► WebsiteData
 │              │      ──1:1──► SiteAnalytics
 │              │      ──1:1──► Domain
 │              │      ──1:N──► Page          @@unique([projectId, slug])
 │              │      ──1:N──► Asset
 │              │      ──1:N──► ChatMessage
 │              └──────1:N──► SkillInvocation
 ├──1:1──► Subscription
 └──1:N──► Payment

StripeEvent   (standalone — webhook idempotency ledger, id = Stripe event id)
```

Every `Project`-owned relation is `onDelete: Cascade`, so deleting a project removes its context, pages, assets, chat, and audit rows in one statement.

**Key columns**

| Model | Notable fields |
| ----- | -------------- |
| `Project` | `status` string, default `"draft"` |
| `BusinessContext` | Everything nullable. `hours`, `gbpData`, `services`, `competitors`, `serviceAreas`, `brandIdentityInputs`, `usps`, `interviewMetadata` are `Json?` |
| `WebsiteData` | `designTokens`, `seoMetadata`, `jsonLdSchemas`, `ogTags`, `internalLinkMap` as `Json?`; `sitemapXml` / `robotsTxt` as `String?`; `generationStatus` default `"pending"` |
| `Page` | `content Json` — the section array for one route |
| `SkillInvocation` | `inputHash` / `outputHash` for determinism checks; `tokens`, `latencyMs` for cost and performance |
| `Subscription` | One per user (`userId @unique`), `currentPeriodEnd` drives the billing gate |
| `StripeEvent` | `id` is the Stripe event id — insert fails on replay, which is the idempotency mechanism |

`generationStatus` observed values: `pending` → `generating` → `deploying` → `completed`, or `failed`. These are plain strings, not a Prisma enum — nothing constrains them at the database level.

---

## Multi-Tenancy

Two layers, and the second is weaker than it looks.

**Layer 1 — request binding.** `TenantMiddleware` is applied to `'*'` in `AppModule`. If `req.user?.id` is present it runs the rest of the request inside `tenantContext.run({ userId }, next)`, an `AsyncLocalStorage`.

**Layer 2 — Prisma middleware.** `prisma-tenant.middleware.ts` reads that store and injects a tenant filter:

```typescript
const TENANT_SCOPED_MODELS = ['Project','BusinessContext','WebsiteData','SiteAnalytics',
                              'Asset','ChatMessage','SkillInvocation','Domain','Page'];
```

For `Project` it sets `where.userId`. For the rest it sets `where.project.userId`. `Subscription` and `Payment` are filtered on `userId` directly.

**The gap, stated plainly in the source:** the filter is applied **only** to `findMany`, `findFirst`, `updateMany`, `deleteMany`, `count`, `aggregate`, and `groupBy`. `findUnique`, `create`, `update`, and `delete` pass through unfiltered. The code comments say so. This means single-record access by id is **not** protected by the middleware — controllers and services must scope those themselves (`ProjectsService` and `DomainService` do, by passing `userId` into the `where`). Any new `findUnique`/`update`/`delete` on a tenant-scoped model must do the same explicitly.

See [`review-notes.md`](review-notes.md) for the risk assessment.

---

## AI Gateway

A thin provider abstraction so skills never import a vendor SDK.

```
SkillExecutorService
   └─► AIGatewayService.generateText(model, params)
          └─► ModelRegistry.getAdapter(model)   ← throws on unknown model id
                 └─► ClaudeFableAdapter
```

`ModelRegistry` is the single source of truth for model → adapter mapping:

```typescript
this.registry.set('claude-fable-5', this.claudeAdapter);
this.registry.set('claude-haiku-4-5-20251001', this.claudeAdapter);
```

`AIGatewayService` wraps every call in timing and delegates to `AIGatewayLogger` for success (`model`, `latency`, `usage`) and failure. `generateStream()` is an async generator for SSE chat; its token accounting is stubbed to zeros with a comment acknowledging it.

`TextAdapter` is the implemented contract. `VoiceAdapter` exists as an interface only, commented `// Placeholder for Sprint 4 WebRTC / Audio streaming integration`.

`ChatService` defaults to `claude-haiku-4-5-20251001` for interview turns; skills select their own model.

---

## Skills Contract

```typescript
export interface SkillInput  { projectId: string; context: any; }
export interface SkillOutput { data: any; hash: string; model: string; }
export interface Skill       { readonly name: string; execute(i: SkillInput): Promise<SkillOutput>; }
```

Six skills are registered in `SkillsModule`: `BrandIdentitySkill`, `BrandVoiceSkill`, `DesignSystemSkill`, `SeoMetadataSkill`, `PageStructureSkill`, `SectionContentSkill`.

`PageContentSkill` exists at `src/skills/impl/page-content.skill.ts` but is **not** in the providers array and is imported nowhere. It is dead code superseded by the structure + section split.

**Retry model.** `OrchestratorService.executeWithRetries(skill, input, retries = 3)` loops on any throw and rethrows on the final attempt. Section generation adds a second loop on top and passes `retries = 1` to avoid multiplying the two — the comment in the source explains this. A section that fails all attempts is replaced by `getFallbackSection(sectionType)`, a hand-written minimal valid payload per section type, so a failed section degrades one block rather than the page.

Page-level failures are caught and logged; the loop continues to the next page. **A generation run can therefore complete with fewer pages than requested and still report success.**

---

## Queues

| Queue name | Producer | Consumer | Registered |
| ---------- | -------- | -------- | ---------- |
| `site-generation` | `GenerationProducer` | `GenerationConsumer` | yes |
| `asset-conversion` | `AssetConversionProducer` | `AssetConversionConsumer` | yes |
| `analytics-provisioning` | `AnalyticsProvisioningProducer` | `AnalyticsProvisioningConsumer` | yes |
| `billing-reconciliation` | `BillingReconciliationProducer` | `BillingReconciliationConsumer` | yes |
| `test-job` | `TestJobProducer` | `TestJobConsumer` | yes |
| `deployment` | — | — | **named in `QUEUE_NAMES`, never registered** |

`BaseConsumer<T>` extends `WorkerHost`, logs start/complete/fail, and rethrows so BullMQ applies its own retry policy. Subclasses implement `handleJob(job)` only.

`QUEUE_NAMES.DEPLOYMENT` is declared but no `BullModule.registerQueue` call uses it — deployment currently runs inline inside `GenerationService`, not as its own job.

---

## Deployment Topology

```
                       ┌──────────────────────────────┐
                       │  Sliplane (Docker)           │
   Browser ──HTTPS──►  │  api      : APP_MODE=api     │ ──► PostgreSQL
                       │  worker   : APP_MODE=worker  │ ──► Redis
                       └──────────────────────────────┘
                                    │
                                    │ Vercel API
                                    ▼
                       ┌──────────────────────────────┐
   Contractor's        │  Vercel                      │
   visitors ──────────►│  generated Next.js site, ISR │
                       │  custom domain, DNS, SSL     │
                       └──────────────────────────────┘
```

The Dockerfile is a three-stage build: `deps` (`npm ci --omit=dev` + `prisma generate`), `builder` (full install, copies only `src` + tsconfigs, `npm run build`), `runner` (non-root `nestjs` user, `dumb-init` as PID 1, `npx prisma migrate deploy && node dist/main.js`).

Because the builder stage copies **only** `src/`, TypeScript's inferred root is `src` and the output is `dist/main.js`. Locally the root also includes `scripts/` and root-level `.ts` files, so the local layout is `dist/src/main.js`. Both are correct in context; do not "fix" one to match the other.

`docker-compose.yml` provides `postgres`, `redis`, `minio` (R2 stand-in), a one-shot `migrate`, and split `api` / `worker` services.

---

## Environment Variables

Validated by `src/config/env.schema.ts` through `ConfigModule.forRoot({ validate })`. **The process refuses to boot if validation fails** — a missing required var is a startup crash, not a runtime surprise.

| Group | Vars |
| ----- | ---- |
| App | `NODE_ENV`, `PORT`, `APP_URL`, `FRONTEND_URL` |
| Data | `DATABASE_URL`, `REDIS_URL` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| Google service account | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` |
| Google APIs | `GBP_API_KEY`, `GOOGLE_ADS_*` (6 vars), `GOOGLE_MAPS_API_KEY`, `GOOGLE_PAGESPEED_API_KEY` |
| LLM | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `OPENAI_*`, `GEMINI_*` |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL` |
| Billing | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`, `BYPASS_BILLING` |
| Deploy | `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID` |
| Email | `SMTP_EMAIL`, `SMTP_PASSWORD` |
| Session | `JWT_SECRET`, `JWT_EXPIRY`, `REFRESH_TOKEN_EXPIRY` |
| Unused | `THROTTLE_TTL`, `THROTTLE_LIMIT`, `BRIGHT_DATA_API_KEY`, `SERPAPI_API_KEY` |

`.env.example` is committed and is the canonical list. `.env.test` is also committed and holds only dummy values.

---

## Invariants

Rules that must hold. Breaking one is a bug, not a style choice.

1. **The API process never runs a skill.** Generation happens only in a BullMQ consumer.
2. **The page list is computed in code, never asked of the LLM.** Six fixed routes plus one per service and per service area.
3. **SEO artifacts are pure functions.** `SeoArtifactsService` takes the finished page list and returns sitemap, robots, JSON-LD, and links with no model call.
4. **Every LLM call goes through `AIGatewayService`.** No skill imports `@anthropic-ai/sdk` directly.
5. **Every skill invocation writes a `SkillInvocation` row**, success or failure.
6. **A failed section degrades to a fallback; it never aborts the page.**
7. **`ModelRegistry` throws on an unknown model id.** Adding a model means registering it there.
8. **Stripe webhooks are idempotent through `StripeEvent`.** The primary key is the Stripe event id.
9. **`rawBody: true` must stay on in `main.ts`** or Stripe signature verification breaks.
10. **Env validation runs at boot.** Never read `process.env` directly in a service — inject `ConfigService`. (`main.ts` and `queue.module.ts` read `APP_MODE` before the DI container exists; those are the only sanctioned exceptions.)
11. **Tenant-scoped `findUnique` / `update` / `delete` must pass `userId` explicitly.** The Prisma middleware does not cover them.
