# Dependency security audit — 2026-08-21

## Release disposition

- `bun run audit:security`: **PASS** (no critical/high advisories across 1,332
  packages; eight findings remain below the configured threshold).
- The security gate is the first step of `bun run quality`.
- No known P0/P1 dependency issue remains in the release candidate.
- Re-run this review immediately before every client launch because advisory
  data and package releases change independently of the repository.

Audited toolchain: Bun `1.4.0`, Better Auth `1.6.27`, Vite `8.2.1`, Wrangler
`4.123.0`, and Alchemy `2.0.0-beta.72`.

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
  ip-address, js-yaml, nanoid, PostCSS, sharp, undici, Vite, and ws. The Astro
  pin also prevents Alchemy's unused optional Astro peer from resolving to an
  old vulnerable major in this TanStack Start project.
- Better Auth accepts `cf-connecting-ip` as its trusted Cloudflare client-IP
  header; the production-like Wrangler E2E suite no longer reports an unknown
  client IP during sign-in.
- Secondary-site deployment loads only `sites/<site>/.env` (plus root
  Cloudflare credentials) and fails before provisioning when its private env or
  required auth bindings are absent; it cannot inherit the flagship app env.
- The 2026-08-17 default-branch publication surfaced 22 GitHub Dependabot
  alerts, all attached to the unused, source-less `packages/shared-config`
  manifest and its legacy Next 14/Sharp dependencies. No workspace source,
  script, or documentation referenced that package. The manifest was removed;
  GitHub then reported zero open alerts. `bun install --frozen-lockfile` made no
  lockfile change, the high-severity audit passed, and the client-secret audit
  remained clean.

## Accepted non-P0/P1 findings

The unfiltered `bun audit` reports six moderate and two low advisories:

1. `@hono/node-server` through Alchemy/Prisma development tooling: repeated-
   slash middleware bypass and Windows `serve-static` encoded-backslash path
   traversal. The application runtime is a Cloudflare Worker and does not use
   that Node static-file server.
2. esbuild through Drizzle Kit, Vite/tsx, Wrangler, and Sanity CLI: development-
   server cross-origin read and Windows local-file read. Development servers
   bind to localhost and are not the production request runtime.
3. `smol-toml` through Sanity CLI: denial of service for hostile TOML with very
   large consecutive comment runs. CMS operators do not process user-supplied
   TOML.
4. `uuid` through Effect/Sanity integrations: buffer-bound handling in APIs
   that accept a caller-provided output buffer. The application does not call
   those buffer-writing variants with untrusted offsets.
5. Valibot through environment tooling, Alchemy/Prisma, and Sanity visual
   editing: a crafted record issue path can make `flatten()` throw. The
   affected flattening path is not used for untrusted public request input.
6. Babel source-map handling through build/Studio toolchains: local arbitrary
   file read via a crafted `sourceMappingURL`. Launch jobs build agency-owned
   source and do not process untrusted repositories or source maps.

Controls: untrusted repositories, TOML, source maps, and migration input are not
processed in the launch pipeline; local development servers are not exposed;
critical/high findings fail the release gate. Re-evaluate these findings when
Alchemy, Drizzle Kit, Sanity, or their compatible transitive ranges update.

## Verification evidence

```text
bun run audit:security                         PASS
  Bun 1.4.0; 1,332 packages; 8 below threshold
bun audit                                      6 moderate / 2 low (accepted above)
Focused CMS security matrix                    81 passed / 0 failed
Same-origin mutation guard suite               4 passed / 0 failed
All touched workspace typechecks               PASS
Primary production build                       PASS
Packed provider/bundle clean-consumer check    PASS
```

Primary references used for this review:

- Better Auth releases: https://github.com/better-auth/better-auth/releases
- Better Auth security reference: https://better-auth.com/docs/reference/security
- Better Auth rate limiting: https://better-auth.com/docs/concepts/rate-limit
- Bun overrides: https://bun.com/docs/pm/overrides
