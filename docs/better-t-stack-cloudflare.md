# Better-T-Stack + Alchemy Cloudflare foundation

This repository follows the Better-T-Stack 3.40.0 shape for a full-stack
TanStack application and uses Alchemy as the only Cloudflare deployment layer.
The reference selection is recorded in `bts.jsonc`:

- frontend: TanStack Start
- backend: self (server routes live in `apps/web`)
- API: tRPC
- auth: Better Auth
- database/ORM: SQLite + Drizzle
- database setup: Cloudflare D1
- package manager/orchestrator: Bun + Turborepo
- web deploy: Cloudflare through Alchemy

## Ownership boundaries

| Layer                        | Source of truth                              |
| ---------------------------- | -------------------------------------------- |
| Application and SSR          | `apps/web`                                   |
| Domain services/API          | `packages/api`                               |
| Authentication               | `packages/auth`                              |
| CMS contracts                | `packages/cms`                               |
| Schema and migrations        | `packages/db`                                |
| Runtime binding types        | `packages/env`                               |
| Cloudflare resources         | `packages/infra/alchemy.run.ts`              |
| Per-customer identity/config | `sites/<site>/site.manifest.json` and `.env` |

`wrangler.jsonc` is retained only for local migration and E2E tooling. Do not
use `wrangler deploy`, check in a competing Cloudflare Vite plugin, or manage
D1/R2/Worker resources manually after Alchemy owns them.

## First-time setup

```bash
bun install
cp apps/web/env.example apps/web/.env
cd packages/infra
bunx alchemy login --configure
cd ../..
```

Alchemy stores provider credentials in `~/.alchemy/profiles.json`. The app's
runtime configuration remains in its private `.env` file; required secrets are
passed with Effect `Config.redacted` and do not become plain infrastructure
state values.

The exact generated Alchemy beta currently resolves vulnerable transitive
versions by default. Root overrides keep the generator-tested Alchemy/Effect
pair unchanged while moving Hono, `@hono/node-server`, and Lodash to patched
releases. `@puppeteer/browsers` is held at 3.2.0 to remove its unpatched
`extract-zip` dependency. Keep these overrides until a later Better-T-Stack
validated Alchemy pin no longer needs them, and require `bun run audit:security`
on every upgrade.

## Development

```bash
bun run dev
```

The root command runs `alchemy dev`. Alchemy loads the app's own Vite and
TanStack Start plugins, appends its Cloudflare integration in memory, and
provides typed D1/R2 bindings. The app itself does not depend on Alchemy or
`@cloudflare/vite-plugin`.

## Customer deployment

```bash
# Inspect names, seed selection, env file, and origin requirements only.
bun run site:deploy --site=acme --stage=staging --dry-run

# Import and validate the real Alchemy stack without creating resources.
bun run site:deploy --site=acme --stage=staging \
  --origin=https://acme-web-staging.<account>.workers.dev --preflight

# Deploy the reviewed staging stack.
bun run site:deploy --site=acme --stage=staging \
  --origin=https://acme-web-staging.<account>.workers.dev

# Production is locked to the manifest's siteUrl and attaches its hostname.
bun run site:deploy --site=acme --stage=production
```

The stack provisions one TanStack Worker, one D1 database with checked-in
migrations plus a content-hashed seed Action, and an optional R2 media bucket. The Worker
runs the CMS publish/retention scheduler every minute. Set
`DISABLE_R2_BINDING=1` only for an environment that intentionally has no media
storage.

Physical names include the selected stage and are explicitly pinned. D1, R2,
and the Worker use Alchemy's adoption policy so an Alchemy 2 migration can take
over matching resources. Review the first plan carefully before confirming it.

## Verification

```bash
bun run check-types
bun run build
bun run test
bun run site:deploy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev --preflight
```

No external deploy belongs in an automated local verification run. `--dry-run`
and `--preflight` are the safe gates before a human reviews an Alchemy plan.
