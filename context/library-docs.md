# Library Docs

How each installed library is actually used in this repository, and the traps specific to the versions pinned here. This is not a substitute for upstream documentation — it records the decisions and constraints that upstream docs cannot know about.

---

## Before Using Any Library

1. **Check it is installed.** `package.json` is the authority. Several things named in the roadmap PDF (OpenAI Realtime, Gemini Live) have env vars but no adapter and no dependency.
2. **Check whether an installed library already covers it.** `googleapis` covers GBP, GSC, GTM, and Gmail. Do not add a per-service SDK.
3. **Check this file for a pin.** Some versions are held back deliberately.
4. **Never add a dependency to solve a five-line problem.**

---

## NestJS 11

`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/bullmq` — all `^11` except `bullmq` bindings.

**Bootstrap.** `NestFactory.create(AppModule, { rawBody: true })`. `rawBody` is **required** — Stripe signature verification reads the unparsed body. Removing it silently breaks webhooks while every other route keeps working.

**`APP_MODE` branch.** `main.ts` calls `app.init()` (no HTTP listener) when `APP_MODE === 'worker'`, otherwise `app.listen(PORT)`.

**Middleware.** `TenantMiddleware` is applied in `AppModule.configure()` via `consumer.apply(TenantMiddleware).forRoutes('*')`. It runs before guards.

**Config.** `ConfigModule.forRoot({ isGlobal: true, validate })` where `validate` is a Zod `parse`. Global, so `ConfigService` injects anywhere without re-importing.

**Circular modules.** `forwardRef()` is already needed for `QueueModule` ↔ `AssetsModule` and `QueueModule` ↔ `AnalyticsModule`. A third instance means the module boundary is wrong.

**Trap:** `@nestjs/config` `get<boolean>('BYPASS_BILLING')` returns whatever the Zod schema coerced. The schema uses `z.coerce.boolean()`, which makes **any** non-empty string `true` — including `"false"`. Set the variable to empty or omit it to disable the bypass.

---

## Prisma 5.22

`prisma` (dev) and `@prisma/client` both `^5.22.0`.

**Generator has no custom `output`**, so the client generates into `node_modules/.prisma/client`. Nothing needs to be gitignored for it.

**Middleware via `$use()`.** `PrismaService` constructor calls `this.$use(tenantMiddleware())`.

> **`$use()` is deprecated in Prisma 5 and removed in Prisma 6.** Upgrading past 5.x requires porting `prisma-tenant.middleware.ts` to Client Extensions (`$extends`). This is the single largest blocker to a Prisma major upgrade. Client Extensions also cover `findUnique`/`update`/`delete`, so the port is an opportunity to close the isolation gap at the same time.

**Middleware `params` shape.** `params.model` is the PascalCase model name string, `params.action` the operation. The tenant filter mutates `params.args.where` in place before `next(params)`.

**`jsonb` columns** are typed `Json?` and arrive as Prisma's `JsonValue` — effectively `any`. Validate with Zod before trusting the shape.

**Migrations.** Three applied. `npx prisma migrate deploy` runs in the container CMD before the app starts. Never edit an applied migration.

**Composite unique.** `Page` uses `@@unique([projectId, slug])`, which is what makes `upsertPage` idempotent.

---

## BullMQ 6.2 + @nestjs/bullmq 11

**Connection.** `BullModule.forRootAsync` with `{ connection: { url: REDIS_URL } }`.

**Registration.** Five queues via `BullModule.registerQueue`. `QUEUE_NAMES.DEPLOYMENT` is declared in the constants file but never registered — producing to it would throw.

**Consumer pattern.** `BaseConsumer<T> extends WorkerHost`, implements `process(job)`, logs, calls the abstract `handleJob(job)`, and **rethrows on error**. Rethrowing is what lets BullMQ apply its retry/backoff. A consumer that swallows an error marks the job complete.

**Process gating.** Consumers are only added to `providers` when `APP_MODE !== 'api'`. In an API-only process the workers never attach, so jobs queue up and wait for a worker.

**Trap:** with `APP_MODE` unset — the default for `npm run start:dev` — consumers **are** registered, so a single dev process is both API and worker. That is convenient locally and unlike production.

---

## Zod 4.4

Three boundaries, and nowhere else:

```typescript
// 1. environment — fails at boot
export const envSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  BYPASS_BILLING: z.coerce.boolean().default(false),
  // ...
});

// 2. HTTP bodies — via ZodValidationPipe
// 3. LLM output — via GuardrailsService.validateOutput()
```

- Use `.strict()` on request schemas so unknown fields are rejected, not dropped.
- Infer types, never hand-write them alongside a schema: `type X = z.infer<typeof XSchema>`.
- **Zod 4 changed error shapes** from v3. `error.issues` is the array; code written against v3's `error.errors` will not compile.
- `z.coerce.boolean()` follows JavaScript truthiness — `"false"` is `true`. See the `BYPASS_BILLING` trap above.

---

## Anthropic SDK 0.120

Only text provider wired. Used exclusively inside `ClaudeFableAdapter`.

**Models registered** in `ModelRegistry`:

```typescript
this.registry.set('claude-fable-5', this.claudeAdapter);
this.registry.set('claude-haiku-4-5-20251001', this.claudeAdapter);
```

`getAdapter()` throws `Unsupported model ID: ...` for anything else. Adding a model means registering it here — a bare string at a call site will throw at runtime.

`ChatService` defaults to `claude-haiku-4-5-20251001` for interview turns. Skills choose their own model.

**Never import this SDK outside `src/ai-gateway/adapters/`.** The gateway exists so a provider swap touches one file.

**Streaming.** `AIGatewayService.generateStream()` is an async generator yielding `TextChunk`. Its usage accounting is stubbed to zeros with a comment — token counts for streamed responses are not currently recorded.

---

## ioredis 6

Two consumers: BullMQ's connection (managed by `@nestjs/bullmq`) and `RedisService` in `common/redis/` for the keyword cache.

Keyword results are cached with a 7-day TTL keyed on trade + location. The cache is a cost control on the Google Ads API, not a correctness mechanism — a cold cache must still work.

---

## Google APIs

| Package | Used for | Where |
| ------- | -------- | ----- |
| `googleapis` 176 | OAuth, GBP, GSC, GTM, Gmail | `auth/`, `gbp/`, `analytics/clients/` |
| `google-ads-api` 24 | Keyword Planner volumes | `keywords/clients/google-ads.client.ts` |
| `@google-analytics/admin` 10 | GA4 property creation | `analytics/clients/ga4.client.ts` |
| `@googlemaps/google-maps-services-js` 3.4 | Geocoding / place lookup | GBP support |

**Two distinct credential paths, easy to confuse:**

- **User OAuth** (`GOOGLE_CLIENT_ID` / `SECRET` / `CALLBACK_URL`) — sign-in and anything acting *as the contractor*, including Gmail send scope.
- **Service account** (`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `PRIVATE_KEY`) — backend calls to GSC, GA4 Admin, GTM.

`GOOGLE_ADS_*` is a third set entirely: developer token, its own OAuth client, a refresh token, and both `CUSTOMER_ID` and `LOGIN_CUSTOMER_ID`. The login customer id is the manager account; omitting it fails with a confusing permission error.

**Private key trap:** `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` contains literal `\n` sequences in `.env`. It must be newline-unescaped before use.

---

## Stripe 22.6

**Webhook.** `POST /billing/webhook` verifies the signature against the raw body. Depends on `rawBody: true` in `main.ts`.

**Idempotency.** Every handled event inserts a `StripeEvent` row whose primary key **is** the Stripe event id. A replayed event collides on insert and is skipped. This is the whole mechanism — do not add a second one.

**Dev bypass.** `BYPASS_BILLING=true` short-circuits both `BillingGuard` and `billing-bypass.middleware.ts`. Production must run with it unset or empty.

**Reconciliation.** `reconcileAllSubscriptions()` runs as a daily BullMQ job comparing Stripe state to the `Subscription` table. The roadmap requires a 7-day clean run before GA.

---

## Storage — @aws-sdk/client-s3 + R2

Cloudflare R2 speaks the S3 API, so `@aws-sdk/client-s3` is the client. `R2_ENDPOINT` points at the R2 account endpoint; `R2_PUBLIC_URL` is the public asset base.

`@aws-sdk/s3-request-presigner` generates presigned URLs for direct upload.

Local development substitutes **MinIO** from `docker-compose.yml` — same API, no cloud dependency.

---

## Media — sharp 0.35, fluent-ffmpeg

`sharp` converts uploads to WebP in `assets/image-processor.service.ts`, driven by the `asset-conversion` queue. It is a native module: the Dockerfile installs `openssl` on Alpine for it and Prisma.

`fluent-ffmpeg` with `@ffmpeg-installer/ffmpeg` handles video in `video-processor.service.ts`. The installer package ships the binary so no system ffmpeg is needed.

Conversion is queued, never inline in the request. Uploads return immediately.

---

## nodemailer 9

Gmail SMTP for lead forwarding in `leads.service.ts`:

```typescript
nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
```

`SMTP_PASSWORD` is a **Google App Password**, not the account password, and requires 2FA on the account.

**Trap:** `initializeMailer()` logs a warning and returns without assigning `this.transporter` when credentials are missing. Any later send then throws on `undefined`. Missing SMTP config fails at send time, not at boot.

---

## Passport — google-oauth20 + jwt

`passport-google-oauth20` for sign-in, `passport-jwt` for request authentication. Tokens are issued by `@nestjs/jwt` and delivered as cookies (`cookie-parser` is registered in `main.ts`).

`JWT_EXPIRY` defaults to `15m` with `REFRESH_TOKEN_EXPIRY` at `7d`; `POST /auth/refresh` rotates the access token.

CORS is configured with `credentials: true` and a single origin from `FRONTEND_URL`. Cookie auth will not work cross-origin without both.

---

## Jest 30 + Supertest 7

**E2E only.** Specs live in `test/*.e2e-spec.ts` with config `test/jest-e2e.json`.

```bash
npm run test:e2e      # jest --config ./test/jest-e2e.json --runInBand
```

`--runInBand` is mandatory — the specs share one database and will race otherwise.

`test/mock-queue.module.ts` replaces the real queue so specs do not need a worker. `test/setup.ts` and `test/test-utils.ts` hold shared fixtures. `.env.test` supplies dummy credentials.

**Known state:** 10 TypeScript errors across `test/` (`useBodyParser` missing on `INestApplication`, `Promise<void>` vs `Promise<string>`, unused locals, an `any`-to-`never` argument). Fix what you touch.

---

## Docker Compose

Services: `postgres` (5433 on the host), `redis`, `minio`, a one-shot `migrate`, then split `api` and `worker` containers differing only by `APP_MODE`.

```bash
docker compose up -d          # infra
npx prisma migrate dev        # schema
npm run start:dev             # single process = API + worker
```

Named volumes `pgdata` and `miniodata` persist across restarts. Removing them resets local state.

---

## Not Installed

Named in the roadmap or env but with no dependency and no code:

| Thing | Env vars present | Status |
| ----- | ---------------- | ------ |
| OpenAI Realtime (voice) | `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL` | Sprint 4; `VoiceAdapter` interface is a labelled placeholder |
| Gemini Live (voice) | `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL` | Sprint 4 |
| `@nestjs/throttler` | `THROTTLE_TTL`, `THROTTLE_LIMIT` | Validated, never read. No rate limiting exists. |
| `@nestjs/swagger` | — | No OpenAPI document |
| Bright Data | `BRIGHT_DATA_API_KEY` | Unused |
| SerpAPI | `SERPAPI_API_KEY` | Unused |
| PageSpeed | `GOOGLE_PAGESPEED_API_KEY` | Unused |
