# Rem Viet

Rem Viet is a Bun monorepo for the Rem Vina storefront, admin CMS, blog, and
Cloudflare deployment. The active application lives in `apps/web`; older
Next/Express/Mongo references are migration history, not the current runtime.

## Current Stack

- Runtime/package manager: Bun
- App: TanStack Start, React 19, Vite 8
- Styling: Tailwind CSS v4, shared UI package, landing-specific CSS in
  `apps/web/src/landing.css`
- Animation: GSAP + Lenis for the landing page
- Data/API: TanStack Start routes, tRPC, Drizzle ORM
- Auth: Better Auth with admin allowlist through `ADMIN_EMAILS`
- Database: Cloudflare D1, SQLite dialect
- Media: Cloudflare R2 when `PRODUCT_IMAGES` binding is enabled
- Deploy: Alchemy to Cloudflare Workers

The canonical stack and deployment contract is documented in
`docs/better-t-stack-cloudflare.md`.

## Repository Layout

```txt
apps/
  web/                 TanStack Start app, routes, landing page, admin UI
packages/
  api/                 service layer and tRPC router
  auth/                Better Auth integration
  cms/                 CMS domain helpers/types
  db/                  Drizzle schema, migrations, import scripts
  env/                 Cloudflare env typing and local env shim
  infra/               Alchemy Cloudflare resources
  ui/                  shared styles/components
scripts/               migration and smoke-test helpers
draft/                 landing migration reference assets/code
```

## Prerequisites

- Bun 1.3.14 for package management, Turbo, and local scripts.
- A Cloudflare account connected through Alchemy's provider login.
- Wrangler is installed through the web app dependencies; no global install is
  required. It is retained for local D1 migration and E2E tooling, not for
  application deployment.

## Quick Start

Install dependencies:

```bash
bun install
```

Create local app env:

```bash
cp apps/web/env.example apps/web/.env
```

Then edit `apps/web/.env`. At minimum for local web work:

```bash
BETTER_AUTH_SECRET=change-me
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
ADMIN_EMAILS=admin@example.com
```

Connect Alchemy to Cloudflare once:

```bash
cd packages/infra
bunx alchemy login --configure
cd ../..
```

Run the web app and its Cloudflare bindings through Alchemy:

```bash
bun run dev
```

The Vite server is configured for `http://localhost:3001`. Alchemy appends its
Cloudflare Vite integration at runtime and uses real Cloudflare resources for
bindings; `apps/web/vite.config.ts` deliberately does not register either
`@cloudflare/vite-plugin` or a legacy Alchemy adapter.

## Common Commands

```bash
# Web dev server
bun run dev

# Production build through Turbo
bun run build

# Typecheck all active packages
bun run check-types

# Typecheck only the web app
cd apps/web && bun run check-types

# Build only the web app
cd apps/web && bun run build
```

Important: the web package script is `check-types`, not `typecheck`.

## Database

The active database is Cloudflare D1. Drizzle schema and migrations live in
`packages/db/src`.

Apply migrations to the local Wrangler D1 state:

```bash
bun run db:migrate:local
```

Seed the local blog posts:

```bash
bun run db:seed:posts:local
```

Generate Drizzle migrations:

```bash
bun run db:generate
```

Push schema with Drizzle D1 HTTP credentials:

```bash
bun run db:push
```

For `db:push`, `packages/db/drizzle.config.ts` reads Cloudflare D1 credentials
from `apps/web/.env`:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
```

## CMS And Admin

Admin UI is under `/admin`. Admin access is allowlisted by email:

```bash
ADMIN_EMAILS=tongducthanhnam@gmail.com
```

Public sign-up is not the admin creation flow. Users who are not allowlisted are
not treated as admins even if they can authenticate.

Blog routes:

- `/bai-viet`
- `/bai-viet/$slug.html`
- Admin posts UI under `/admin/posts`

Published seed posts are stored in `packages/db/seeds/posts.sql` and applied by
an idempotent Alchemy D1 Action after schema migrations.

## Deployment

Better-T-Stack supplies the monorepo/application shape; Alchemy is the sole
Cloudflare infrastructure and deployment layer. Use the manifest-aware command
so resource names, D1 migrations/seeds, the R2 binding, the Worker cron, and the
authentication origin are validated together:

```bash
bun run site:deploy --site=rem-viet --stage=staging --dry-run
bun run site:deploy --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.<account-subdomain>.workers.dev --preflight
bun run site:deploy --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.<account-subdomain>.workers.dev --plan
bun run site:deploy --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.<account-subdomain>.workers.dev --yes
bun run site:admin:create --site=rem-viet --stage=staging --dry-run
bun run site:admin:create --site=rem-viet --stage=staging
```

`--dry-run` never invokes Alchemy. `--preflight` invokes the real infrastructure
stack through `alchemy deploy --stage ...` but exits before any provider or
resource Effect runs. `--plan` invokes Alchemy's provider-backed read-only plan;
`--yes` is forwarded only to an actual deploy so CI and Windows terminals do not
depend on the interactive selector. `--dry-run`, `--preflight`, and `--plan` are
mutually exclusive. Every non-production deploy requires an explicit origin-only
HTTPS URL; that exact value becomes both `CORS_ORIGIN` and `BETTER_AUTH_URL`.
Production is locked to `siteUrl` in the selected manifest and Alchemy attaches
that hostname as the Worker's custom domain.

Every Alchemy Worker also receives a non-secret deployment identity: manifest
site, stage, full Git SHA, deterministic deploy-input SHA-256 and
`clean|dirty|unknown` source state. `/api/health` returns it with
`Cache-Control: no-store`. Staging may expose `dirty` for iterative work, but
pilot/release verification rejects it; production deploy fails before provider
effects unless the checkout is clean. After every apply, rerun `--plan` and
require Worker, D1 and R2 to be `noop`.

The infrastructure workspace pins the exact Alchemy/Effect versions validated
by Better-T-Stack 3.40.0. Lifecycle commands are the standard Alchemy CLI:

```bash
bun run deploy -- --stage production
bun run destroy -- --stage production
```

Prefer `site:deploy` for agency sites because it also selects the manifest,
private env file, seed, and validated origin. Physical Worker, D1, and R2 names
are pinned and wrapped in Alchemy's adoption policy so the Alchemy 2 cutover can
take ownership of matching existing resources instead of creating duplicates.
Always review the first deployment plan.

If Alchemy reports a D1 import/poll error during a first apply, do not delete the
database or clear stack state. Run the same manifest-aware command with `--plan`.
Only retry with `--yes` when the plan proves D1/R2 are `noop` and the remaining
operation is the expected Worker update. Stop and inspect the migration incident
when D1 still plans create/update/replace or when the resource identity differs.

Example staging Worker URL:

```txt
https://rem-viet-web-staging.terasumi.workers.dev
```

Immutable D1 backups use the manifest-owned private R2 archive. Operator and
composed periodic commands both run an isolated local restore and download/hash
verification before emitting evidence:

```bash
bun run site:backup --site=rem-viet --stage=staging --remote
bun run site:backup:archive --site=rem-viet --stage=staging --file=backups/<artifact>.sql --dry-run
bun run site:backup:scheduled --site=rem-viet --stage=staging --output=backups/<unique-artifact>.sql --dry-run
```

The weekly/manual workflow is
`.github/workflows/scheduled-cms-backup.yml`. It stays fail-closed until its
site/stage/account variables and dedicated Cloudflare backup token are set; see
`docs/agency-operations-runbook.md` before enabling it.

Before assembling a client-ready release, run the sanitized live snapshot:

```bash
bun run release:readiness --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default
```

It runs five live audits in parallel: D1 capacity, Cloudflare alert history,
deterministic alert-policy preflight, 28-day field performance and the read-only
notification-smoke preflight. It combines their sanitized results with the
schema-v2 evidence file and current Git state.
A nonzero exit is expected while any gate remains; output contains counts and
actions, never database IDs, resource names, recipient IDs, policy payloads, or
credentials. Running without site/stage/origin still checks capacity and alert
history but explicitly reports alert provisioning, field performance and
notification runtime as not audited. The final tag still requires
`bun run release:verify` from the exact clean commit.

Field-performance evidence has its own fail-closed, read-only D1 audit. Supply
the deployed origin explicitly for non-production stages:

```bash
bun run site:vitals:audit --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default
```

The command exits nonzero and withholds `releaseEvidence` until CLS, LCP and INP
each have at least 75 non-synthetic samples in the fixed 28-day window and meet
their p75 budgets. `--json` emits only site/stage, the public origin, aggregate
counts/p75 values and the copy-safe evidence object; Cloudflare account and D1
identifiers are never included.

Prepare the Cloudflare operational email policy with a read-only dry-run. Keep
the recipient only in private env as `CLOUDFLARE_ALERT_EMAIL`:

```bash
bun run cloudflare:alerts:policy --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default
```

Creation requires exact `--confirm-origin`, exact
`--confirm-policy=rem-viet-staging-operational-failures`, and `--apply`. The
command creates at most one deterministic `workers_observability_alert` email
policy for `status=FIRING_FAILED`; it never updates or deletes a same-name policy.
It does not invent the underlying Workers Observability query/threshold. After
an operator configures that threshold, triggers one controlled notification
failure and sees the email, `--verify --receipt-confirmed-at=<ISO timestamp>` is
the only mode that exposes the matching dispatch ID inside `releaseEvidence`.
The API token needs Notifications Read for dry-run/verify and Notifications
Write for apply.

Real notification proof uses a separate fail-closed, two-phase smoke. Start with
the default dry-run and retain its UUID:

```bash
bun run site:notification:smoke --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default
```

After the three Resend values are configured and the current Worker is deployed,
repeat with that UUID, `--apply`, and an exact `--confirm-origin`. Apply creates
one synthetic inbox lead, requests one real email and replays the same public
idempotency key once. It never claims inbox delivery. After the configured
recipient actually sees exactly one email, run `--verify` with the same UUID and
`--receipt-confirmed-at=<ISO timestamp>`; only that phase can emit the
schema-v2-compatible `notification` evidence object in `--json` output. Account,
database and recipient identifiers are never printed.

Cloudflare application env is loaded from `packages/infra/.env`, root `.env`
for backward compatibility, and the selected site's private env file.
Cloudflare provider credentials are stored in the selected Alchemy profile
under `~/.alchemy`; `wrangler login` and a root API token are not part of the
deployment flow.

`apps/web/.env` deploy bindings:

```bash
CORS_ORIGIN=
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
ADMIN_EMAILS=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
JSONLINK_API_KEY=
```

R2 is optional while the Cloudflare token does not have R2 permissions:

```bash
DISABLE_R2_BINDING=1
```

When this is enabled, media upload routes that require `PRODUCT_IMAGES` will
return a storage-not-configured response instead of using R2.

## Migration Tools

Legacy Mongo/Notion migration helpers still exist for cutover work:

```bash
bun run db:mongo-to-d1:sql
bun run db:notion-to-d1:sql
bun run db:migration:summary
bun run db:migration:verify
bun run db:migration:verify:fixture
bun run smoke:migration
```

Details and parity notes live in `MIGRATION.md`.

## Landing Page Notes

The landing page is the AWWWARDS-style experience in:

```txt
apps/web/src/routes/index.tsx
apps/web/src/components/landing/
apps/web/src/landing.css
```

Key conventions:

- Import GSAP from `apps/web/src/lib/gsap.ts`.
- Use `useGSAP()` for cleanup.
- Keep landing CSS as the canonical animation/pseudo-element layer.
- Public assets live in `apps/web/public/assets/` and are referenced as
  `/assets/<name>`.

## Troubleshooting

### Alchemy asks for Cloudflare credentials

Configure or refresh the provider profile from the infrastructure workspace:

```bash
cd packages/infra
bunx alchemy login --configure
```

### Deploy uses the wrong stage

Use `site:deploy --stage=<stage>` or pass `--stage` to the direct Alchemy
lifecycle command. The site wrapper also exports `ALCHEMY_STAGE` so physical
resource names and Alchemy state always use the same stage.

### R2 creation fails with Cloudflare authentication error

Set this in `apps/web/.env`:

```bash
DISABLE_R2_BINDING=1
```

Then deploy again. Re-enable R2 only after the token has the required R2
permissions.

## License

MIT. See `LICENSE`.
