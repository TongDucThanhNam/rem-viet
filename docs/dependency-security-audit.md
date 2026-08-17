# Dependency security audit — 2026-08-14

## Release disposition

- `bun run audit:security`: **PASS** (no critical/high advisories).
- The security gate is the first step of `bun run quality`.
- No known P0/P1 dependency issue remains in the release candidate.
- Re-run this review immediately before every client launch because advisory
  data and package releases change independently of the repository.

## Changes applied

- Better Auth `1.6.9` -> `1.6.27`, including the upstream security fixes in the
  current 1.6 line.
- Vite `8.0.8` -> `8.2.1`, Cloudflare Vite plugin `1.17.1` -> `1.52.1`, and
  Wrangler -> `4.123.0`.
- The installed shadcn CLI was removed. The four state variants used by the UI
  are defined locally in `packages/ui/src/styles/globals.css`; future component
  generation can use an explicitly versioned one-shot CLI instead of making its
  MCP/HTTP stack part of every install.
- Unused jsdom and Testing Library packages were removed.
- Root overrides pin patched transitive releases for Astro, brace-expansion,
  ip-address, js-yaml, nanoid, PostCSS, sharp, undici, Vite and ws. The Astro pin
  also prevents Alchemy's unused optional Astro peer from resolving to an old
  vulnerable major in this TanStack Start project.
- Better Auth accepts `cf-connecting-ip` as its trusted Cloudflare client-IP
  header; the production-like Wrangler E2E suite no longer reports an unknown
  client IP during sign-in.
- Secondary-site deployment loads only `sites/<site>/.env` (plus root
  Cloudflare credentials) and fails before provisioning when its private env or
  required auth bindings are absent; it cannot inherit the flagship app env.
- The 2026-08-17 default-branch publication surfaced 22 GitHub Dependabot alerts
  (9 high, 11 moderate, 2 low), all attached to the unused, source-less
  `packages/shared-config` manifest and its legacy Next 14/Sharp dependencies.
  No workspace source, script or documentation referenced that package. The
  manifest was removed instead of carrying upgraded dead dependencies; GitHub
  then reported zero open alerts. `bun install --frozen-lockfile` made no
  lockfile change, `bun audit --audit-level high` passed, and the client-secret
  audit remained clean.

## Accepted non-P0/P1 findings

A full unfiltered `bun audit` still reports:

1. One moderate esbuild development-server advisory through Drizzle Kit's
   legacy `@esbuild-kit` loader. The application does not expose an esbuild dev
   server; Drizzle Kit is a local migration CLI, and production is built and
   served by Vite/Cloudflare. A cross-major global esbuild override was rejected
   because it would violate the loader's pinned compatibility range.
2. Low-severity local source-map/file-read findings in Babel/esbuild build
   tooling. They require local access or interaction and do not ship as the
   Worker request runtime.

Controls: development servers bind to localhost, untrusted repositories or
source maps are not processed in the launch pipeline, migration input is agency
controlled, and critical/high findings fail the release gate. Re-evaluate these
accepted findings when Drizzle Kit/Alchemy publish compatible stable upgrades.

## Verification evidence

```text
bun run audit:security                         PASS
bun run quality                                PASS
Alchemy CLI 0.91.2 startup/version smoke       PASS
All workspace typechecks                       PASS
Primary and acme-demo production builds        PASS
Primary deploy preflight (real tsx entrypoint) PASS
Production Worker Playwright                   23 passed / 5 intentional skips
```

Primary references used for this review:

- Better Auth releases: https://github.com/better-auth/better-auth/releases
- Better Auth security reference: https://better-auth.com/docs/reference/security
- Better Auth rate limiting: https://better-auth.com/docs/concepts/rate-limit
- Bun overrides: https://bun.com/docs/pm/overrides
