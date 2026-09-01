# Progress Tracker

Living record of what exists, what was decided, and what is outstanding. Update the status block and append to the decision log — do not rewrite history.

---

## Current Status — 2026-09-01

**Phase 2 (Core Generation Loop, Sprint 2), day 6 of 14.** Roadmap window Aug 27 – Sep 9.

The backend is further along than the roadmap requires. All of Phase 1 is in place, most of Phase 2 is built, and substantial parts of Phase 3 (billing, domains, analytics, leads) landed early. The generation pipeline runs end to end in code.

What is genuinely not done: the chat-driven edit flow, keyword data feeding the SEO and content skills, the adversarial prompt suite, CI, and every item in Phase 4 QA.

| Area | State |
| ---- | ----- |
| Auth + tenancy | Built; isolation has a known gap on single-record queries |
| Interview + chat | Built, SSE streaming, field extraction working |
| Skill pipeline | Built — 6 skills, 3 phases, retry + fallback |
| Persistence | 13 models, 3 migrations, cascade deletes |
| Queues | 5 of 6 named queues wired |
| SEO artifacts | Built, pure functions |
| Deployment | Built; `VercelClient` mocks when unconfigured |
| Billing | Built with idempotent webhooks and dev bypass |
| Analytics / leads | Built |
| Voice | Interface placeholder only |
| CI | Does not exist |
| Tests | E2E specs exist; 10 type errors in `test/` |

---

## Verification Actually Run — 2026-09-01

Stated precisely, because "it should work" is not a status.

| Check | Command | Result |
| ----- | ------- | ------ |
| Type check | `npx tsc --noEmit` | 10 errors, **all in `test/`**, none in `src/` |
| Lint (`src`) | `npx eslint "src/**/*.ts"` | 481 problems / 454 errors — all type-safety rules, **0 formatting** |
| Format | `npx prettier --check "src/**/*.ts"` | 148 of 148 files differ |
| Routes | static scan of `*.controller.ts` | 36 routes, 15 controllers |
| Dead code | `grep -rn PageContentSkill src test` | defined, referenced nowhere |

**Not run:** the E2E suite (`npm run test:e2e`) — it needs live Postgres and Redis. No claim is made here about whether it passes.

---

## Progress by Phase

### Phase 0 — Architecture & Design ✅ complete
Architecture, schema, adapter and skill contracts, keys, infrastructure. The one gap is a formal API contract document — routes exist but there is no OpenAPI spec.

### Phase 1 — Foundation ✅ complete except CI
Scaffold, schema, OAuth, AI gateway, BullMQ, R2, keywords + Redis cache, Stripe bypass, Docker Compose. **CI was never built** — there is no workflow file anywhere in the repo. Tenant isolation is built but incomplete.

### Phase 2 — Core Generation Loop 🔄 in progress
Done: chat SSE, interview scaffolding, orchestration framework, `SkillInvocation` logging, Brand Identity, Brand Voice, Design System, SEO Metadata, Page Structure, Section Content, generation job, SEO artifacts, internal linking, GBP pre-fill, asset upload + WebP, public site payload endpoint.

Outstanding: chat-driven edit flow (not started), keyword targeting inside the content and SEO skills, adversarial prompt suite, Walking Skeleton review, trade-matched stock photos beyond hardcoded Unsplash URLs.

### Phase 3 — Payments + Deployment ⏩ largely pre-built
Stripe Checkout, webhook with `StripeEvent` idempotency, subscription state, billing guard, reconciliation job, domain search/purchase, GSC/GA4/GTM clients, Gmail lead forwarding. `VercelClient` still returns mock responses when `VERCEL_API_TOKEN` is absent, so real deployment is unverified.

### Phases 4–8 ⬜ not started
No QA pass, no alpha, no beta.

---

## Decisions Made Before Build

1. **NestJS over Express.** Module boundaries and DI are worth the ceremony on a service with 25 feature areas.
2. **One codebase, two process modes.** `APP_MODE` branches API from worker rather than maintaining two entry points. Keeps DI wiring identical.
3. **Anthropic as the only text provider.** `AIGatewayService` exists so this can change without touching a skill.
4. **Deterministic structure, generated prose.** Page list, link graph, and SEO artifacts are code. This is the central product bet.
5. **Postgres `jsonb` for generated content** rather than a normalized section schema. Section shapes change often; migrations would dominate.
6. **BullMQ over a cron table.** Generation is long-running and must survive an API restart.

---

## Decisions Made During Build

**Pages split into their own table — migration `20260824032916_separate_pages`.**
Originally the whole site lived in `WebsiteData`. Splitting `Page` out with `@@unique([projectId, slug])` allows incremental persistence: `onPageGenerated` writes each page as it completes, so a run that dies on page 9 keeps pages 1–8.

**Content skill split into structure + section — supersedes `PageContentSkill`.**
One skill generating a whole page produced malformed output and gave no retry granularity. Now `PageStructureSkill` returns section types and `SectionContentSkill` fills one section at a time, with per-section retry and fallback. `page-content.skill.ts` was left on disk and never removed — it is dead code.

**Per-section fallbacks instead of failing the page.**
`getFallbackSection()` returns a hand-written minimal payload per section type. A section that exhausts three attempts degrades one block rather than losing the page. Accepted trade-off: a run can report success with generic copy in places.

**Page failures are caught and skipped, not propagated.**
The per-page `try/catch` in the orchestrator logs and continues. **A run can therefore complete with fewer pages than requested.** Nothing currently surfaces that to the caller — see `review-notes.md`.

**`StripeEvent` table added — migration `20260827043503_add_stripe_event`.**
Webhook idempotency by primary-key collision on the Stripe event id. Simplest correct mechanism.

**Tenant isolation scoped to list/bulk operations only.**
`prisma-tenant.middleware.ts` documents this in a comment: intercepting `findUnique`/`update`/`delete` safely without breaking or causing N+1 queries was judged not worth it in Prisma middleware. Single-record scoping is the caller's responsibility. **This is the largest known correctness risk in the codebase.**

**Deployment runs inline, not as a queued job.**
`QUEUE_NAMES.DEPLOYMENT` was reserved but never registered. `GenerationService` calls `NextjsBuilderService.buildAndDeploy()` directly at the end of the pipeline, so deploy time is inside generation time.

---

## Toolchain Decisions — 2026-09-01

**`.gitignore` reduced to four rules.** `node_modules`, `dist`, `.env`, `.DS_Store`. The previous `/generated/prisma` entry was dead — no such directory exists and the Prisma generator has no custom `output`, so the client lands in `node_modules`. `dist/` (478 files) and `.DS_Store` were untracked with `git rm --cached`; files remain on disk. `.env.example` and `.env.test` stay tracked — `.env.test` holds only dummy values.

**Formatting removed from ESLint.** `eslint.config.mjs` swapped `eslint-plugin-prettier/recommended` for `eslint-config-prettier`. The plugin reported every Prettier deviation as an ESLint error — 26 of 33 problems in a sample module, ~79% of all red markers. Formatting errors are now 0 across all 148 files in `src/`, with no source file modified.

**Format-on-save scoped to modified lines.** `.vscode/settings.json` sets `editor.formatOnSaveMode: "modifications"`. New code follows repo style; untouched lines stay byte-identical; commits stay free of drive-by reformatting.

**A repo-wide Prettier pass was attempted and reverted.** It produced a 124-file, ~2,100-line diff. Reverted to `HEAD` at the user's direction as too noisy to review alongside feature work. The codebase remains unformatted by design until someone does it as an isolated commit. Widening `printWidth` does not avoid this — at 120 columns, 76 of 148 files still differ.

---

## Outstanding Work — Ranked

1. **Close the tenant isolation gap.** Audit every `findUnique`, `update`, and `delete` on a tenant-scoped model and add explicit `userId` scoping. Phase 4 lists a security audit; this should not wait for it.
2. **Add CI.** Lint + typecheck + E2E. It was a Phase 1 deliverable and is still missing; every day without it widens the drift.
3. **Fix the 10 type errors in `test/`** so `tsc --noEmit` is a meaningful gate.
4. **Feed keyword data into the SEO and content skills.** `KeywordsService` works but nothing in the skill pipeline consumes it — the SEO engine is currently disconnected from generation.
5. **Delete `page-content.skill.ts`** or register it. Dead files mislead the next reader.
6. **Surface partial generation.** A run that skips pages should not look identical to a complete one.
7. **Build the chat-driven edit flow.** Last major Phase 2 feature.
8. **Verify Vercel deployment against a real token.** Everything downstream of `buildAndDeploy()` is currently unexercised.
9. **Adversarial prompt suite.** 20 prompts for Phase 2, expanding to 50 in Phase 4.
10. **Register or remove `QUEUE_NAMES.DEPLOYMENT`.**

---

## Notes

- `db-dump.json` at the repo root is a tracked local database export containing real project and user ids. It is intentionally kept in version control.
- `.vscode/` was briefly unreadable on 2026-09-01 after a failed `git stash` left the directory in Windows pending-delete state with an open VS Code handle. Reloading the window cleared it. If `git status` reports `could not open directory '.vscode/'`, that is the cause.
- The Dockerfile's `node dist/main.js` and the local `dist/src/main.js` layout are both correct. The builder stage copies only `src/`, which flattens TypeScript's inferred root. Do not "fix" either to match the other.
