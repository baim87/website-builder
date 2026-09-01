# Integration Test — end to end via the API

Exercising the real service by hand, on Windows PowerShell. This is the manual counterpart to `test/*.e2e-spec.ts` — use it to prove a running instance actually works, and to see where a generation run stalls.

Every command below is PowerShell 5.1. `&&` and `mkdir -p` are Bash and will not parse.

---

## 1. Preflight

```powershell
# Infrastructure
docker compose up -d
docker compose ps            # postgres, redis, minio should be "running"

# Schema
npx prisma migrate dev

# One process serving as both API and worker (APP_MODE unset)
npm run start:dev
```

Confirm it is alive:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

**If the process exits immediately at boot**, env validation failed. `ConfigModule` runs `envSchema.parse(process.env)` and a missing required variable is a hard crash, by design. Compare `.env` against `.env.example`.

**To run API and worker separately**, as production does:

```powershell
$env:APP_MODE = 'api';    npm run start:dev      # terminal 1 — enqueues only
$env:APP_MODE = 'worker'; npm run start:dev      # terminal 2 — consumes only
```

With `APP_MODE=api` alone, nothing processes jobs and generation will sit in the queue forever. That is correct behaviour, not a bug.

---

## 2. Getting a token

`JwtStrategy` uses `ExtractJwt.fromAuthHeaderAsBearerToken()`, so **every protected call needs `Authorization: Bearer <token>`.** The `refreshToken` cookie is only used by `POST /auth/refresh`.

**Option A — the real flow.** Open `http://localhost:3000/auth/google` in a browser and complete Google sign-in. The callback redirects to `${FRONTEND_URL}/dashboard?token=<accessToken>`. Copy the token out of the address bar. That redirect is the only place the access token is exposed.

**Option B — mint one locally.** Faster when you only need the API. Requires a `User` row to exist, and `JWT_SECRET` from your `.env`:

```powershell
# create a user and print a token for it
node -e "
const {PrismaClient}=require('@prisma/client');const jwt=require('jsonwebtoken');
(async()=>{const p=new PrismaClient();
const u=await p.user.upsert({where:{email:'dev@local.test'},update:{},
  create:{email:'dev@local.test',name:'Dev'}});
console.log(jwt.sign({sub:u.id,email:u.email},process.env.JWT_SECRET,{expiresIn:'2h'}));
await p.\$disconnect();})()"
```

Then:

```powershell
$token = '<paste token>'
$H = @{ Authorization = "Bearer $token" }
```

Verify:

```powershell
Invoke-RestMethod http://localhost:3000/auth/me -Headers $H
# → id, email
```

A 401 here means the token, the secret, or the header format is wrong. Nothing downstream will work until this returns a user.

---

## 3. The endpoints, in order

```
POST   /projects                                → { id, name, status:"draft" }
PATCH  /projects/:id/business-context           → fill the interview data
GET    /projects/:id/business-context           → read it back
POST   /projects/:id/generate                   → { message: "Generation queued successfully" }
GET    /projects/:id                            → poll; watch websiteData.generationStatus
GET    /public/site-content/:projectId          → the finished payload
```

`generationStatus` moves `pending` → `generating` → `deploying` → `completed`, or `failed`. There is no dedicated status endpoint — read it off the project.

---

## 4. Full script

```powershell
$base  = 'http://localhost:3000'
$token = '<paste token>'
$H     = @{ Authorization = "Bearer $token" }

# ---------------------------------------------------------------- create
$project = Invoke-RestMethod "$base/projects" -Method Post -Headers $H `
  -ContentType 'application/json' `
  -Body (@{ name = 'Summit Roofing'; trade = 'roofing' } | ConvertTo-Json)

$pid = $project.id
"project: $pid"

# ------------------------------------------------------- business context
# -Depth matters: PowerShell's default of 2 silently truncates nested arrays.
$context = @{
  businessName         = 'Summit Roofing Co'
  contactPerson        = 'Dale Whitmore'
  businessAddress      = '1420 Pine Ridge Rd, Boulder, CO 80301'
  phone                = '+1-303-555-0142'
  email                = 'dale@summitroofing.test'
  trade                = 'roofing'
  services             = @('Roof Replacement','Storm Damage Repair','Gutter Installation')
  serviceAreas         = @('Boulder','Longmont','Louisville')
  hours                = @{ mon = '7-5'; tue = '7-5'; wed = '7-5'; thu = '7-5'; fri = '7-4' }
  brandVoicePreference = 'straightforward, local, no hype'
  primaryColor         = '#1B3A5C'
  secondaryColor       = '#E07A28'
  fontStyle            = 'geometric sans'
  usps                 = @('30-year workmanship warranty','Same-week storm response')
} | ConvertTo-Json -Depth 6

Invoke-RestMethod "$base/projects/$pid/business-context" -Method Patch `
  -Headers $H -ContentType 'application/json' -Body $context

# --------------------------------------------------------------- generate
Invoke-RestMethod "$base/projects/$pid/generate" -Method Post -Headers $H
# → { message = "Generation queued successfully" }

# ------------------------------------------------------------------- poll
do {
  Start-Sleep -Seconds 5
  $p = Invoke-RestMethod "$base/projects/$pid" -Headers $H
  $status = $p.websiteData.generationStatus
  "$(Get-Date -f HH:mm:ss)  $status"
} while ($status -in @('pending','generating','deploying'))

"final: $status"

# ----------------------------------------------------------------- result
# Invoke-WebRequest, not Invoke-RestMethod: keeps the server's exact JSON
# instead of a round-trip through PowerShell objects.
$site = Invoke-WebRequest "$base/public/site-content/$pid" -Headers $H
$site.Content | Out-File site.json -Encoding utf8
"pages: " + (($site.Content | ConvertFrom-Json).pages.Count)
```

---

## 5. One-liners

```powershell
# how many pages landed, and their slugs
Invoke-RestMethod "$base/public/site-content/$pid" -Headers $H |
  Select-Object -ExpandProperty pages | Select-Object slug

# section types on one page
(Invoke-RestMethod "$base/public/site-content/$pid" -Headers $H).pages |
  Where-Object slug -eq 'home' | Select-Object -ExpandProperty sections |
  Select-Object type

# the audit trail for this run — one row per skill call
npx prisma studio          # then open SkillInvocation, filter by projectId

# same, from the shell
node -e "
const {PrismaClient}=require('@prisma/client');
(async()=>{const p=new PrismaClient();
const r=await p.skillInvocation.findMany({where:{projectId:'$pid'},
  orderBy:{createdAt:'asc'},
  select:{skillType:1,status:1,model:1,tokens:1,latencyMs:1,error:1}});
console.table(r);await p.\$disconnect();})()"

# SEO artifacts
(Invoke-RestMethod "$base/projects/$pid" -Headers $H).websiteData.sitemapXml
(Invoke-RestMethod "$base/projects/$pid" -Headers $H).websiteData.robotsTxt
```

---

## 6. Expected shape of a good run

For the payload above — 3 services, 3 service areas — the deterministic page list is **12 pages**:

```
home, about-us, services, service-areas, portfolio, contact
services/roof-replacement, services/storm-damage-repair, services/gutter-installation
service-areas/boulder, service-areas/longmont, service-areas/louisville
```

If you get fewer than 12, **pages were dropped**. `OrchestratorService` catches per-page failures, logs them, and continues — the run still reports `completed`. Check the worker log for `Failed to generate page <slug>`. Nothing in the API response tells you this happened.

Similarly, a section whose three attempts all fail is replaced by `getFallbackSection()`. Generic copy such as `"Welcome"` / `"Professional services."` in a `HeroSection`, or a section with an `id` beginning `fallback-`, means the LLM call failed there. The run still looks successful.

---

## 7. Failure paths worth exercising

| Scenario | How | Expected |
| -------- | --- | -------- |
| No auth | drop `-Headers $H` | 401 |
| Cross-tenant read | mint a token for a second user, `GET /projects/<other id>` | 404 — `ProjectsService.findOne` passes `userId` explicitly |
| Cross-tenant on an unguarded path | any `findUnique`/`update` that omits `userId` | **may succeed — this is the open isolation gap.** See `review-notes.md` |
| Bad body | `name` empty in `POST /projects` | 400 from `ZodValidationPipe` |
| Unknown model id | register a skill with an unlisted model | throws `Unsupported model ID: ...` |
| No worker | `APP_MODE=api` only, then generate | `202`-style ack, status stays `pending` forever |
| Anthropic down | unset `ANTHROPIC_API_KEY` after boot | pages fall back to static sections |
| Vercel unconfigured | unset `VERCEL_API_TOKEN` | `VercelClient` returns `{ status: 'mocked' }`; run still completes |
| Stripe replay | POST the same webhook event twice | second is ignored via `StripeEvent` primary-key collision |

---

## 8. If it stalls

**Status stays `pending`.** No worker is consuming. Either `APP_MODE=api` is set on the only process, or Redis is unreachable. Check `docker compose ps` and the worker log for a BullMQ connection error.

**Status stays `generating`.** A skill is retrying. Each has 3 attempts, sections have their own loop on top, and calls are sequential per page — a large service/area list takes a while. Watch the worker log for `[<slug>] Generating <sectionType> (Attempt n/3)`.

**Status is `failed`.** Only Phase 1 rejection (Brand Identity or Brand Voice) or a throw from `NextjsBuilderService` reaches the outer catch. Page-level errors never get there. The exception and stack are in the worker log.

**Status reached `completed` but pages are missing.** Expected behaviour, not a crash — see section 6.

---

## 9. Reset

```powershell
# wipe generated data, keep the schema
node -e "
const {PrismaClient}=require('@prisma/client');
(async()=>{const p=new PrismaClient();
await p.project.deleteMany({});   // cascades to context, pages, assets, chat, invocations
await p.\$disconnect();})()"

# nuclear: drop volumes and start over
docker compose down -v
docker compose up -d
npx prisma migrate dev
```

`Project` deletion cascades to `BusinessContext`, `WebsiteData`, `SiteAnalytics`, `Domain`, `Page`, `Asset`, `ChatMessage`, and `SkillInvocation`. `User`, `Subscription`, and `Payment` survive.
