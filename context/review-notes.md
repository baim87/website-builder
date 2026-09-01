# Review Notes — 2026-09-01

Findings from reading the working tree against the roadmap PDF. Ordered by consequence, not by effort. Every item names the file so it can be verified rather than taken on trust.

Nothing in this file has been changed in the code. These are observations awaiting a decision.

---

## 1. Multi-tenant isolation does not cover single-record queries

**`src/prisma/prisma-tenant.middleware.ts`** — highest-severity item in the repository.

The Prisma middleware injects a tenant filter only for these operations:

```typescript
const safeWhereOperations = ['findMany','findFirst','updateMany',
                             'deleteMany','count','aggregate','groupBy'];
```

`findUnique`, `create`, `update`, and `delete` fall through unfiltered. The source says so explicitly:

```typescript
// For create/findUnique/update/delete, we pass through.
// In a real RLS setup, these would be blocked at the DB level, but Prisma middleware cannot
// easily safely intercept these without crashing or causing N+1 queries.
```

The reasoning is sound — Prisma middleware genuinely cannot rewrite a `findUnique` `where` clause into a non-unique filter. But the consequence is that **tenant safety is a per-callsite convention, not a system guarantee.** Every `findUnique`/`update`/`delete` on a tenant-scoped model is a potential cross-tenant read or write if the author forgets `userId`.

Where it is currently done right: `ProjectsService.findOne(id, userId)`, `DomainService.purchaseDomain` (`where: { id: projectId, userId }`).

**The risk is that this is invisible.** A new endpoint written in the obvious way — `prisma.page.findUnique({ where: { id } })` — is a cross-tenant leak that passes review because the middleware appears to handle isolation.

**Options, in order of preference:**

1. **Port to Prisma Client Extensions (`$extends`).** They can intercept every operation including `findUnique`. This is required for Prisma 6 anyway (see item 2), so the work is not wasted.
2. **PostgreSQL Row-Level Security.** Strongest guarantee, biggest change; the session variable must be set per connection, which interacts with pooling.
3. **A repository layer** that takes `userId` as a mandatory first argument, making omission a type error.

At minimum, before beta: audit every `findUnique`/`update`/`delete` on the nine tenant-scoped models and add explicit scoping. Phase 4 schedules a "multi-tenant security audit" for Sep 16 — that is after external users are contemplated in Phase 5.

---

## 2. `$use()` blocks the Prisma 6 upgrade

**`src/prisma/prisma.service.ts:9`** — `this.$use(tenantMiddleware())`.

`$use()` is deprecated in Prisma 5 and **removed in Prisma 6**. The project is on `^5.22.0`, the last 5.x line. Any attempt to upgrade Prisma majors will fail at this call.

This makes item 1 and this item the same piece of work. Porting the tenant filter to Client Extensions unblocks the upgrade *and* lets the filter cover `findUnique`/`update`/`delete`. Doing them together is strictly better than doing either alone.

---

## 3. Partial generation is indistinguishable from complete generation

**`src/skills/orchestrator.service.ts`**

The per-page loop catches everything:

```typescript
} catch (error) {
  this.logger.error(`Failed to generate page ${pageSlug}: ${error.message}`);
}
```

The loop continues. `GenerationService` then marks the run `completed`. A site that should have 12 pages can ship with 7, and the only evidence is a line in the worker log.

The same applies one level down: a section that exhausts its retries is replaced by `getFallbackSection()`, which returns hard-coded copy — `"Welcome"`, `"Professional services."`, `"We are professionals."` — plus a hardcoded Unsplash image URL. That is a reasonable degradation strategy, but nothing records that it happened.

**Suggested minimum:** count attempted vs. succeeded pages and sections, persist the counts on `WebsiteData`, and expose them. A contractor should not launch a site whose About page says "We are professionals." without anyone knowing.

The `SkillInvocation` table already has the raw data — every failure writes a row with `status` and `error`. Nothing aggregates or surfaces it.

---

## 4. The keyword engine is not connected to generation

`KeywordsService`, `GoogleAdsClient`, and the Redis cache are all built and working. **Nothing in the skill pipeline calls them.**

`OrchestratorService` passes `businessContext`, brand results, and design tokens into `SeoMetadataSkill` and `SectionContentSkill`. No keyword data is fetched, allocated, or injected.

The roadmap lists "SEO skill (code + prompt + keyword data integration)" and "Content Generation skill (code + prompt + keyword targeting)" as Sep 1 deliverables. The code and prompts exist; the keyword integration does not.

This matters more than a normal missing feature: **"SEO Keyword Engine" is one of the product's headline capabilities** in the vision document, and local search ranking is the entire value proposition for a contractor. Right now the generated copy is not keyword-targeted at all.

---

## 5. Access token is delivered in a URL query string

**`src/auth/auth.controller.ts:40`**

```typescript
return res.redirect(`${frontendUrl}/dashboard?token=${accessToken}`);
```

Query strings leak: browser history, `Referer` headers on any outbound request from that page, server access logs, and analytics. The refresh token is handled correctly (httpOnly cookie, `sameSite: 'lax'`, `secure` in production) — the access token is not.

**Options:** set the access token as a second cookie and have the frontend read it via an authenticated `/auth/me` call; or return it in a fragment (`#token=`), which is not sent to servers; or post it to the opener window.

Related inconsistency: `main.ts` configures CORS with `credentials: true` and registers `cookie-parser`, which suggests cookie-based auth, but `JwtStrategy` uses `ExtractJwt.fromAuthHeaderAsBearerToken()`. Cookies are used *only* for refresh. Worth settling on one model.

---

## 6. `z.coerce.boolean()` makes `BYPASS_BILLING=false` mean true

**`src/config/env.schema.ts:58`**

```typescript
BYPASS_BILLING: z.coerce.boolean().default(false),
```

`z.coerce.boolean()` applies JavaScript truthiness. The string `"false"` is non-empty, therefore `true`. Anyone who writes `BYPASS_BILLING=false` in a production `.env` intending to enforce billing **disables billing enforcement**.

Both `BillingGuard` and `billing-bypass.middleware.ts` read this value, so the blast radius is the whole payment gate.

**Fix:** `z.enum(['true','false']).default('false').transform(v => v === 'true')`, or `z.string().default('false').transform(v => v.toLowerCase() === 'true')`.

This is a small change guarding real revenue. It should not wait.

---

## 7. Dead code: `PageContentSkill`

**`src/skills/impl/page-content.skill.ts`**

The class is defined and exported. It appears in `SkillsModule` providers **nowhere**, and `grep -rn "PageContentSkill\|page-content.skill" src test` returns only its own definition.

It was superseded by the `PageStructureSkill` + `SectionContentSkill` split, which gives per-section retry granularity. The file was never deleted.

Delete it. A skill file that looks registered but is not will eventually cost someone an afternoon.

---

## 8. `QUEUE_NAMES.DEPLOYMENT` is declared but never registered

**`src/common/constants/queue-names.constant.ts`** declares six queues; `queue.module.ts` registers five. There is no `deployment` producer or consumer.

Deployment currently runs **inline** at the end of `GenerationService.generateProject()` — `NextjsBuilderService.buildAndDeploy()` is awaited inside the generation job. Consequences:

- Deploy time counts against the generation job's timeout.
- A Vercel failure fails the whole generation run, after all the LLM work is already paid for.
- Deployment cannot be retried independently of regeneration.

Either register the queue and move deployment into it, or remove the constant. Leaving a name with no queue behind it invites someone to produce to it and get a runtime error.

---

## 9. Test suite does not type-check

`npx tsc --noEmit` reports **10 errors, all in `test/`**, none in `src/`:

| File | Error |
| ---- | ----- |
| `billing.e2e-spec.ts:47` | `useBodyParser` does not exist on `INestApplication` |
| `bullmq.e2e-spec.ts:53` | `Promise<void>` not assignable to `Promise<string>` |
| `bullmq.e2e-spec.ts:72` | `jobState` declared but never read |
| `full-flow.e2e-spec.ts:74`, `skill-pipeline.e2e-spec.ts:44,120` | `model` declared but never read |
| `full-flow.e2e-spec.ts:109` | `.match` does not exist on a union content type |
| `storage.e2e-spec.ts:34,55,71` | `any` not assignable to `never` |

Several are `noUnusedLocals` violations, which are trivial. `useBodyParser` looks like a genuine API drift against NestJS 11.

While these exist, `tsc --noEmit` cannot be a CI gate — which is convenient, because there is no CI either (item 10).

---

## 10. There is no CI pipeline

The roadmap lists "CI pipeline (lint + type-check + tests)" as an **Aug 26 Phase 1 deliverable**. There is no `.github/workflows/`, no `.gitlab-ci.yml`, no CI configuration of any kind in the repository.

Everything in this document would have been caught earlier and cheaper by a pipeline that ran `lint`, `typecheck`, and `test:e2e` on every push. It is the highest-leverage missing item after tenant isolation, and unlike the isolation work it is a few hours.

---

## 11. Lint reports 454 errors, all type-safety

After removing formatting from ESLint on 2026-09-01, `npx eslint "src/**/*.ts"` reports 481 problems / 454 errors and **zero** formatting issues:

| Count | Rule |
| ----- | ---- |
| 237 | `@typescript-eslint/no-unsafe-member-access` |
| 148 | `@typescript-eslint/no-unsafe-assignment` |
| 25 | `@typescript-eslint/no-unsafe-argument` (warn) |
| 17 | `@typescript-eslint/no-unsafe-return` |
| 13 | `@typescript-eslint/no-unused-vars` |
| 12 | `@typescript-eslint/no-unsafe-call` |
| 11 | `@typescript-eslint/no-unnecessary-type-assertion` |
| 8 | `@typescript-eslint/require-await` |

These come from `recommendedTypeChecked` reacting to `any`. The config sets `@typescript-eslint/no-explicit-any: 'off'` — so the project has explicitly opted **into** `any` while leaving every downstream `no-unsafe-*` rule at error level. That is internally inconsistent: it is legal to write `any` and an error to use it.

**Two coherent positions**, either better than the current one:

- **Accept `any` in the current code:** downgrade the `no-unsafe-*` family to `'warn'`. Clears ~430 red markers, keeps the signal, matches the existing `no-explicit-any: 'off'` stance.
- **Tighten:** turn `no-explicit-any` back on, type `SkillInput.context` and `SkillOutput.data` properly with Zod-inferred types, and work the count down.

The 13 `no-unused-vars` errors are real and should be fixed regardless.

---

## 12. Codebase is not Prettier-formatted

All 148 files in `src/` fail `prettier --check`. 102 fail even when line endings are ignored, so this is genuine formatting drift, not a CRLF artifact.

A repo-wide `prettier --write` was run on 2026-09-01, produced a **124-file, ~2,100-line** diff, and was reverted at the user's direction as too noisy to review alongside feature work.

Mitigation in place: `.vscode/settings.json` sets `editor.formatOnSaveMode: "modifications"`, so Prettier only touches lines you actually edit. Commits stay clean without a mass rewrite.

Note for whenever this is done: widening `printWidth` does not avoid the pass. At 120 columns, 76 of 148 files still differ. Do it as one isolated commit and add it to `.git-blame-ignore-revs`.

---

## 13. Smaller observations

**Placeholder domain in SEO artifacts.** `generation.service.ts:46` — ``const domain = `${projectId}.builder.local`;`` with the comment "For MVP, we'll use a placeholder domain if none exists." The sitemap, JSON-LD, and internal links are generated against this fake host even when the project already has a real `Domain` row. Anything generated before domain purchase carries wrong absolute URLs.

**Vercel client mocks silently.** `vercel.client.ts:39` — `if (!this.apiToken) return { status: 'mocked', domain };`. A run without `VERCEL_API_TOKEN` completes successfully and reports a live URL that does not exist. Fine for local development, dangerous if it ever reaches staging.

**Streaming token usage is not recorded.** `ai-gateway.service.ts` logs `{ promptTokens: 0, completionTokens: 0 }` for every streamed call, with a comment acknowledging it. All interview chat is streamed, so **chat token spend is currently invisible.** Unit economics is a Phase 7 deliverable; this needs solving before then.

**`LeadsService` transporter can be undefined.** `initializeMailer()` warns and returns when SMTP credentials are missing, leaving `this.transporter` unassigned. The failure surfaces as a `TypeError` at send time — after a real lead has come in. Fail at boot, or check before sending.

**No rate limiting.** `THROTTLE_TTL` and `THROTTLE_LIMIT` are validated by the env schema and read by nothing. `@nestjs/throttler` is not installed. Every endpoint, including the unauthenticated `POST /api/projects/:projectId/leads`, is unthrottled.

**No API documentation.** No `@nestjs/swagger`, no OpenAPI document. Phase 0 called for an API contract specification. The frontend is a separate repository consuming 36 undocumented routes.

**`db-dump.json` is tracked and contains real ids.** Confirmed intentional by the user on 2026-09-01. Worth revisiting before the repository gains contributors.

---

## 14. What was verified, and how

So this document can be trusted or checked:

| Claim | Verified by |
| ----- | ----------- |
| 36 routes / 15 controllers | static scan of `@Controller` + verb decorators |
| 13 models, 3 migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| 6 skills registered, 1 orphan | `skills.module.ts` providers vs. `grep -rn PageContentSkill` |
| 5 of 6 queues registered | `queue-names.constant.ts` vs. `registerQueue` calls |
| 10 type errors, all in `test/` | `npx tsc --noEmit` |
| 454 lint errors, 0 formatting | `npx eslint "src/**/*.ts" --format json` |
| 148/148 files unformatted | `npx prettier --check "src/**/*.ts"` |
| Middleware operation coverage | reading `prisma-tenant.middleware.ts` |

**Not verified:** the E2E suite was not executed — it requires live Postgres and Redis. No claim is made about whether it passes. No generation run was performed against a real Anthropic key, so end-to-end pipeline behaviour is inferred from code, not observed.
