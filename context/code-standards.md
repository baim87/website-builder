# Code Standards

Conventions for this repository. Some are aspirational targets, some describe what the code already does — each rule says which. An AI agent working in this codebase follows these without exception so patterns do not drift between sessions.

---

## Engineering Mindset

- **Read the context files first.** Verify against `architecture.md` before assuming how a subsystem works.
- **Scope is sacred.** Build what the task requires. A refactor that was not asked for is a defect.
- **Deterministic first.** If a step can be computed in code, it is never delegated to the LLM. The page list, the link graph, and the SEO artifacts are code. Only prose is generated.
- **Failures are expected.** Every external call — Anthropic, Stripe, Vercel, Google, R2, SMTP — is wrapped, logged, and classified. One failure never crashes the worker.
- **Degrade, do not abort.** A failed section becomes a fallback. A failed page is logged and skipped. The run continues.
- **One thing at a time.** Finish a feature before starting the next.
- **Clean over clever.** A junior developer must be able to read it.

---

## Formatting and Linting

Settled 2026-09-01. Read this before changing any lint or editor config.

- **Prettier is the only formatter.** Config is `.prettierrc`: `singleQuote: true`, `trailingComma: "all"`, and Prettier's default 80-column `printWidth`.
- **Formatting is not linted.** `eslint.config.mjs` uses `eslint-config-prettier`, which *disables* stylistic rules. It does **not** use `eslint-plugin-prettier`, which would report formatting as ESLint errors. Do not reintroduce the plugin — it produced ~26 red errors per file and made every file look broken on open.
- **The codebase is not Prettier-formatted.** As of 2026-09-01 all 148 files in `src/` fail `prettier --check`. This is known and deliberate: a repo-wide format pass was attempted, produced a 124-file diff, and was reverted as too noisy to review alongside feature work.
- **Format on save is scoped to modified lines.** `.vscode/settings.json` sets `editor.formatOnSaveMode: "modifications"` so Prettier touches only the lines you edited. New code follows the style; untouched code stays byte-identical; commits stay clean.
- **ESLint never rewrites files on save.** `editor.codeActionsOnSave` is empty by design. `npm run lint` still passes `--fix` when run deliberately.
- **When the repo is eventually normalized**, do it as a single isolated commit with nothing else in it, and add that commit to `.git-blame-ignore-revs`.

---

## TypeScript

What `tsconfig.json` actually sets:

```jsonc
"strictNullChecks": true,
"noImplicitAny": true,
"strictBindCallApply": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"target": "ES2023",
"module": "nodenext"
```

- **`strict` is not enabled.** Only the individual flags above. Turning on `strict` wholesale would surface hundreds of new errors — treat it as a planned migration, not a drive-by change.
- **`any` is permitted but discouraged.** `@typescript-eslint/no-explicit-any` is `off`. The existing skill and orchestrator code leans on `any` heavily (`SkillInput.context`, `SkillOutput.data`). New code should prefer `unknown` plus narrowing, or a Zod-inferred type.
- **Domain types are inferred from Zod schemas**, never hand-written next to them:
  ```typescript
  export type BrandIdentity = z.infer<typeof BrandIdentitySchema>;
  ```
- `const` by default; `let` only for genuine reassignment.
- Explicit return types on public service methods. Inference is fine for locals.
- `interface` for contracts that get implemented (`Skill`, `TextAdapter`); `type` for object shapes and unions.

---

## NestJS Conventions

- **Every feature is a module.** `app.module.ts` holds imports and the `TenantMiddleware` binding — nothing else.
- **Controllers are thin.** Validate, delegate, return. A handler longer than ~10 lines belongs in a service.
- **Constructor injection only.** No `@Inject()` with string tokens unless registering a dynamic provider.
- **Business logic lives in services**, never in controllers, guards, or consumers.
- **Consumers delegate immediately.** `GenerationConsumer.handleJob()` is two lines: log, then call `GenerationService`. Job orchestration is not queue-layer work.
- **Circular module dependencies use `forwardRef()`.** Already required between `QueueModule` ↔ `AssetsModule` and `QueueModule` ↔ `AnalyticsModule`. Adding a third is a signal to reconsider the boundary.
- **Never read `process.env` in a service.** Inject `ConfigService`. The only sanctioned exceptions are `main.ts` and `queue.module.ts`, which branch on `APP_MODE` before the DI container exists.

---

## File and Folder Naming

```
*.module.ts        NestJS module
*.controller.ts    HTTP routes
*.service.ts       business logic
*.client.ts        third-party SDK wrapper      (vercel.client.ts, ga4.client.ts)
*.skill.ts         a Skill implementation       (in skills/impl/)
*.producer.ts      BullMQ enqueue               (in queue/producers/)
*.consumer.ts      BullMQ processor             (in queue/consumers/)
*.middleware.ts    Nest or Prisma middleware
*.guard.ts         route guard
*.pipe.ts          validation pipe
*.constant.ts      frozen literals              (in common/constants/)
*.interface.ts     contracts
*.schema.ts        Zod schemas
*.dto.ts           request/response shapes
*.e2e-spec.ts      end-to-end test              (in test/)
```

kebab-case filenames, PascalCase classes, camelCase members. A folder gets an `interfaces/`, `schemas/`, `dto/`, `constants/`, or `clients/` subfolder only when it holds more than one such file.

---

## Service Structure

```typescript
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly websiteDataService: WebsiteDataService,
  ) {}

  async generateProject(projectId: string): Promise<string> {
    // 1. mark state
    // 2. fetch inputs
    // 3. do the work
    // 4. persist
    // on throw: mark failed, rethrow
  }
}
```

- `private readonly logger = new Logger(ClassName.name)` as the first member. This is the established pattern; keep it.
- Numbered step comments in long orchestration methods — `generation.service.ts` and `orchestrator.service.ts` both use them and they earn their place.
- Public methods take primitives or DTOs, never Prisma models pulled from another service's internals.

---

## Skills

A skill is the only place an LLM is asked for content. Adding one:

1. Implement `Skill` in `src/skills/impl/<name>.skill.ts`.
2. Define its Zod output schema in `src/skills/schemas/skill-outputs.schema.ts`.
3. Validate through `GuardrailsService.validateOutput(raw, Schema)` — never trust raw model output.
4. **Register it in `SkillsModule` providers.** An unregistered skill is dead code; `page-content.skill.ts` is the cautionary example.
5. Wire it into `OrchestratorService` at the right phase.
6. Give it a fallback in `getFallbackSection()` if it produces a section type.

Rules:

- A skill never calls Prisma. It receives context and returns data; persistence is the orchestrator's or `GenerationService`'s job.
- A skill never imports `@anthropic-ai/sdk`. It calls `AIGatewayService`.
- A skill is a pure function of its `SkillInput` as far as callers are concerned. Same input, same `inputHash`.
- Every invocation is logged to `SkillInvocation` by `SkillExecutorService` — do not bypass the executor.

---

## LLM Interaction

- Model ids come from `ModelRegistry`, never from a string literal at a call site.
- Ask for JSON, then parse and validate. Never `JSON.parse()` model output without a Zod schema behind it.
- System prompts are built by dedicated builders (`InterviewPromptBuilder`), not concatenated inline in a service method.
- Sanitize any user text that reaches a prompt through `GuardrailsService.validateInput()`.
- Set `temperature` and `maxTokens` explicitly for generation skills. Defaults drift between models.
- Retries belong to the orchestrator, not the adapter. The adapter surfaces the error.

---

## Validation and Guardrails

Three places untrusted data enters, and nothing else:

| Boundary | Mechanism |
| -------- | --------- |
| Environment | `env.schema.ts` via `ConfigModule.forRoot({ validate })` — fails at boot |
| HTTP request bodies | Zod DTO + `ZodValidationPipe` |
| LLM output | `GuardrailsService.validateOutput()` → `OutputValidatorService` |

- Use `.strict()` on request schemas so unknown fields are rejected rather than silently dropped.
- Normalize lightly — trim and collapse whitespace. Do not strip characters a contractor legitimately typed.
- `InputSanitizerService` handles prompt-injection defence for anything heading into a system prompt.

---

## Prisma

- `PrismaService` extends `PrismaClient` and is the only place the client is constructed.
- **Tenant scoping is not automatic for single-record operations.** The middleware covers `findMany`, `findFirst`, `updateMany`, `deleteMany`, `count`, `aggregate`, `groupBy` only. For `findUnique`, `create`, `update`, and `delete` on a tenant-scoped model you **must** pass `userId` yourself:
  ```typescript
  await this.prisma.project.findUnique({ where: { id: projectId, userId } });
  ```
- Multi-row writes that must succeed together go in `$transaction`.
- `jsonb` columns are typed `Json?` by Prisma and arrive as `any` — validate before use.
- Every schema change ships with a migration. Never edit an applied migration; add a new one.
- `PrismaService` uses `$use()`, the Prisma 4/5 middleware API. It is deprecated and removed in Prisma 6 — see `review-notes.md` before upgrading.

---

## Queues

- Producers are always registered; consumers are gated on `APP_MODE !== 'api'`. Preserve that split.
- A new queue needs four things: an entry in `QUEUE_NAMES`, a `BullModule.registerQueue`, a producer, and a consumer. `QUEUE_NAMES.DEPLOYMENT` has the first and none of the rest.
- Consumers extend `BaseConsumer<T>` and implement `handleJob` only. `process()` already logs and rethrows.
- **Rethrow from `handleJob`.** Swallowing an error tells BullMQ the job succeeded and kills the retry.
- Job payloads carry ids, never whole entities. The consumer re-reads from Postgres.
- Jobs must be safe to run twice. Use upserts.

---

## Error Handling

- `GlobalExceptionFilter` shapes the HTTP response. Controllers do not format errors.
- Throw Nest HTTP exceptions from services (`NotFoundException`, `BadRequestException`) — `DomainService` is the reference.
- Use `getErrorMessage()` from `common/utils/error.util` rather than `error.message` on an `unknown`.
- Log with context: the project id, the page slug, the skill name. `[${pageSlug}] Generating ${sectionType}` is the standard the orchestrator sets.
- Never log secrets, tokens, or full LLM prompts.

---

## Testing

- **E2E only.** `test/*.e2e-spec.ts` with Jest + Supertest. There is no unit suite.
- Run with `npm run test:e2e` (`--runInBand`; the specs share a database).
- `test/mock-queue.module.ts` substitutes the queue so specs do not need a live worker.
- `.env.test` is committed with dummy values and is the fixture environment.
- A new endpoint ships with an E2E spec covering the happy path and the auth failure.
- **Known state:** several existing specs do not type-check (`npx tsc --noEmit` reports 10 errors, all in `test/`). Fix the one you touch; do not treat a clean typecheck as the current baseline.

---

## Docker

- Three-stage build: `deps`, `builder`, `runner`. Keep it that way — the runner must not contain dev dependencies or source.
- The runner runs as non-root `nestjs` with `dumb-init` as PID 1 for signal forwarding.
- The builder copies only `src/` and the tsconfigs. If you add a directory the build needs, add an explicit `COPY`.
- `.dockerignore` excludes `dist`, so the image always builds from source. Never rely on a committed `dist/`.

---

## Comments

- Explain **why**, not what. `// Pass 1 because the while loop here already handles retries and fallbacks` is a good comment — it prevents a plausible bug.
- Document deliberate limitations where the reader will hit them, the way `prisma-tenant.middleware.ts` documents its uncovered operations.
- No commented-out code. Delete it; git remembers.

---

## Dependencies

- Do not add a dependency without checking whether an installed one covers it. `googleapis` already covers most Google surfaces.
- Pin ranges as `^` and let the lockfile hold the exact version. Commit `package-lock.json`.
- Before upgrading a major version of Prisma, BullMQ, or NestJS, read `library-docs.md` — several are pinned deliberately.

---

## Definition of Done

A change is done when all of these are true:

1. It compiles — `npm run typecheck` introduces no new errors.
2. `npm run lint` reports no new errors.
3. Lines you touched are Prettier-clean; lines you did not are unchanged.
4. New endpoints have an E2E spec.
5. New env vars are in `env.schema.ts`, `env.constants.ts`, **and** `.env.example`.
6. Schema changes have a migration.
7. New skills are registered in `SkillsModule` and wired into the orchestrator.
8. `git status` shows only files relevant to the change.
