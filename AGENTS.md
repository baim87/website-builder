# AGENTS.md

Orientation for any AI agent working in this repository. Read this file first, then the context document that covers your task. This file is a router and a warning list — it does not duplicate the detail in `context/`.

---

## What this is

**LOCAL EMPIRE — AI Contractor Website Builder.** A NestJS backend that turns a conversational interview with a home-service contractor (roofing, HVAC, plumbing, decking, remodeling, electrical, painting) into a complete, SEO-optimized, multi-page Next.js site deployed to Vercel on a custom domain.

This repo is **backend only**. It produces structured JSON and orchestrates third parties. It renders no HTML and ships no UI. The React/Zustand frontend is a separate repository.

The central product bet: **deterministic structure, AI-generated prose.** The page list, internal link graph, and SEO artifacts are computed in code. The LLM only writes copy into slots whose shape is already fixed.

---

## Read this before you touch anything

| Read | When |
| ---- | ---- |
| [`context/project-overview.md`](context/project-overview.md) | Always. What the product is, the 36-route API surface, the core flow. |
| [`context/architecture.md`](context/architecture.md) | Before any structural change. Stack, module map, schema, data flow, and the 11 invariants. |
| [`context/code-standards.md`](context/code-standards.md) | Before writing code. Conventions, naming, and the formatting rules. |
| [`context/review-notes.md`](context/review-notes.md) | Before trusting anything. 13 known defects and gaps, ranked. |
| [`context/progress-tracker.md`](context/progress-tracker.md) | To know what is actually built vs. planned. |
| [`context/build-plan.md`](context/build-plan.md) | To know which phase a feature belongs to. |
| [`context/library-docs.md`](context/library-docs.md) | Before using or upgrading a dependency. |
| [`context/integration-test.md`](context/integration-test.md) | To exercise the running service by hand. |
| `context/LOCAL EMPIRE - NEW VISION SIMPLIFIED.pdf` | The source product roadmap. **Not in the repo** — gitignored. The docs above are derived from it. |

> **The `.md` files above are tracked and present in every clone. The source PDF is not** — `.gitignore` carries `context/*.pdf`, so the roadmap document stays on the maintainer's machine. The context docs are derived from it and are the authoritative version for anything you need. If a claim in them looks wrong, say so rather than reconstructing the PDF from assumptions.

---

## Non-negotiables

Breaking one of these is a bug, not a style disagreement. Full list in `architecture.md` § Invariants.

1. **The API process never runs a skill.** Generation happens only inside a BullMQ consumer.
2. **The page list is computed in code, never asked of the LLM.** Six fixed routes plus one per service and one per service area.
3. **SEO artifacts are pure functions.** `SeoArtifactsService` takes the finished page list and returns sitemap, robots, JSON-LD, and links with no model call.
4. **Every LLM call goes through `AIGatewayService`.** Never import `@anthropic-ai/sdk` outside `src/ai-gateway/adapters/`.
5. **Every skill invocation writes a `SkillInvocation` row** via `SkillExecutorService`. Do not bypass the executor.
6. **A failed section degrades to a fallback; it never aborts the page.**
7. **`rawBody: true` stays on in `main.ts`.** Removing it silently breaks Stripe signature verification while every other route keeps working.
8. **Stripe webhooks are idempotent through the `StripeEvent` primary key.** Do not add a second mechanism.
9. **Never read `process.env` in a service.** Inject `ConfigService`. The only exceptions are `main.ts` and `queue.module.ts`, which branch on `APP_MODE` before the DI container exists.
10. **A new skill must be registered in `SkillsModule`.** An unregistered skill is dead code — `page-content.skill.ts` is the existing cautionary example.

---

## Landmines

Things that will waste your time or cause real damage if you do not know them. Detail and suggested fixes in `review-notes.md`.

**Tenant isolation is incomplete.** `prisma-tenant.middleware.ts` filters only `findMany`, `findFirst`, `updateMany`, `deleteMany`, `count`, `aggregate`, `groupBy`. `findUnique`, `create`, `update`, and `delete` pass through **unfiltered**. Writing `prisma.page.findUnique({ where: { id } })` is a cross-tenant leak that looks correct. Always pass `userId` explicitly:

```typescript
await this.prisma.project.findUnique({ where: { id: projectId, userId } });
```

**`BYPASS_BILLING=false` means true.** `z.coerce.boolean()` follows JS truthiness, so the string `"false"` is truthy. To enforce billing, leave the variable unset or empty.

**A "completed" generation may be missing pages.** `OrchestratorService` catches per-page failures, logs them, and continues. The run still reports `completed`. Nothing surfaces this — check the worker log for `Failed to generate page <slug>`.

**Fallback copy looks like real output.** A section whose three attempts fail is replaced by `getFallbackSection()` — generic strings like `"Welcome"` / `"We are professionals."` and a hardcoded Unsplash URL. Section `id`s beginning `fallback-` are the tell.

**`APP_MODE` unset means one process is both API and worker.** That is the default for `npm run start:dev` and is unlike production, where `docker-compose.yml` splits them.

**Prisma is pinned at 5.22 because of `$use()`.** That middleware API is removed in Prisma 6. Upgrading requires porting `prisma-tenant.middleware.ts` to Client Extensions first — which is also how you fix the isolation gap. Do them together.

**`VercelClient` mocks silently** when `VERCEL_API_TOKEN` is absent, returning `{ status: 'mocked' }`. A run completes and reports a live URL that does not exist.

**`QUEUE_NAMES.DEPLOYMENT` has no queue behind it.** Producing to it throws. Deployment currently runs inline inside `GenerationService`.

**The test suite does not type-check.** `npx tsc --noEmit` reports 10 errors, all in `test/`, none in `src/`. That is the current baseline — do not treat a clean typecheck as the starting point.

---

## Formatting and linting — read before changing config

Settled 2026-09-01. Reversing any of this will make every file look broken.

- **Prettier is the only formatter.** `.prettierrc`: `singleQuote`, `trailingComma: "all"`, default 80-column width.
- **Formatting is NOT linted.** `eslint.config.mjs` uses `eslint-config-prettier` (disables conflicting rules). It deliberately does **not** use `eslint-plugin-prettier`, which reported formatting as ESLint errors — roughly 79% of all red markers.
- **The codebase is not Prettier-formatted.** All 148 files in `src/` fail `prettier --check`. This is known and accepted. A repo-wide pass was attempted, produced a 124-file diff, and was reverted as too noisy to review alongside feature work.
- **Never run `prettier --write` across the repo** as part of another task. If it is ever done, it goes in its own isolated commit, added to `.git-blame-ignore-revs`.
- **Format on save is scoped to modified lines** via `editor.formatOnSaveMode: "modifications"` in `.vscode/settings.json`. Touch only the lines you actually edit.
- **`any` is permitted.** `@typescript-eslint/no-explicit-any` is `off`. Lint reports ~454 `no-unsafe-*` errors as a result; that is the known baseline, not something you introduced. Prefer `unknown` plus narrowing in new code.
- **`strict` is not enabled** in `tsconfig.json` — only `strictNullChecks`, `noImplicitAny`, `strictBindCallApply`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. Turning on full `strict` is a planned migration, not a drive-by change.

---

## Commands

This project is developed on **Windows with PowerShell**. `&&`, `mkdir -p`, and Bash control flow do not parse there — use `;` and PowerShell cmdlets, or run Bash explicitly.

```powershell
docker compose up -d          # postgres (5433), redis, minio
npx prisma migrate dev        # apply schema
npm run start:dev             # APP_MODE unset -> API + worker in one process

npm run typecheck             # tsc --noEmit
npm run lint                  # eslint --fix
npm run test:e2e              # jest, --runInBand (specs share a database)
npm run build                 # nest build
```

Split processes, as production runs them:

```powershell
$env:APP_MODE = 'api';    npm run start:dev
$env:APP_MODE = 'worker'; npm run start:dev
```

---

## Where things live

```
src/
├── main.ts              APP_MODE branch, CORS, cookie-parser, rawBody
├── app.module.ts        every module + TenantMiddleware on '*'
├── config/              Zod env schema — validation failure is a boot crash
├── prisma/              PrismaService + tenant middleware
├── common/              guards, pipes, filters, decorators, constants, redis
├── auth/                Google OAuth, JWT (Bearer header; cookie is refresh only)
├── projects/            Project, BusinessContext, WebsiteData, Page services
├── chat/ interview/     SSE chat, completeness check, field extraction
├── ai-gateway/          TextAdapter, ModelRegistry, Claude adapter
├── skills/              6 registered skills + orchestrator (3-phase pipeline)
├── generation/          GenerationService, NextjsBuilderService, public payload
├── seo/                 pure sitemap / robots / JSON-LD / link generation
├── queue/               5 producers, 5 consumers (consumers gated on APP_MODE)
├── billing/ stripe/     Checkout, webhooks, reconciliation, dev bypass
├── vercel/ deployment/ domain/   deploy, ISR revalidate, domain purchase
├── analytics/ leads/    GA4 / GTM / GSC provisioning, Gmail lead forwarding
├── assets/ storage/     upload, sharp WebP conversion, R2
└── keywords/            Google Ads keyword lookup + Redis cache (NOT yet wired
                         into the skill pipeline — see review-notes.md)
```

---

## How to work here

- **Read the relevant context doc before editing.** Verify; do not assume.
- **Scope is sacred.** Build what was asked. An unrequested refactor is a defect, and a large incidental diff is worse than no change at all.
- **Deterministic first.** If it can be computed in code, it is never delegated to the LLM.
- **Degrade, do not abort.** External calls are wrapped, logged, and classified. One failure never crashes the worker.
- **Keep diffs reviewable.** `git status` should show only files relevant to your change. If a tool reformats 100 files as a side effect, revert and try again.
- **Report honestly.** If tests fail, say so with output. If you skipped something, say that. Do not claim verification you did not perform.

---

## Definition of done

1. `npm run typecheck` introduces no new errors (baseline: 10, all in `test/`).
2. `npm run lint` introduces no new errors (baseline: ~454, all `no-unsafe-*`).
3. Lines you touched are Prettier-clean; lines you did not are byte-identical.
4. New endpoints have an E2E spec in `test/`.
5. New env vars are in `env.schema.ts`, `env.constants.ts`, **and** `.env.example`.
6. Schema changes ship with a migration; applied migrations are never edited.
7. New skills are registered in `SkillsModule` and wired into `OrchestratorService`.
8. `git status` shows only files relevant to the change.
9. `context/progress-tracker.md` is updated if you changed what is built.

---

## Open questions

Decisions that need a human, not an agent. Do not resolve these unilaterally.

1. **Tenant isolation** — port to Prisma Client Extensions, adopt Postgres RLS, or introduce a repository layer that makes `userId` mandatory? All three fix it; they differ a lot in cost.
2. **Lint posture** — accept `any` and downgrade the `no-unsafe-*` family to warnings, or tighten and type the skill boundary properly?
3. **Auth model** — the access token is currently delivered in a redirect query string while the refresh token is an httpOnly cookie. Settle on one model.
4. **Prettier normalization** — when does the repo-wide pass happen, and who reviews it?
5. **Deployment runs inline inside the generation job.** `QUEUE_NAMES.DEPLOYMENT` was reserved and never registered, so a Vercel failure fails the whole run after all the LLM work is already paid for. Move it to its own queue, or accept the coupling and delete the constant?
