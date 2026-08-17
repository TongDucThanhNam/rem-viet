# ADR 0021: Callable Alchemy and CLI boundaries

- Status: Accepted
- Date: 2026-08-16
- Scope: per-client infrastructure and repository commands

## Context

Per-client resource naming, binding validation, init, and verification worked in
the Rèm Việt monorepo, but their logic lived inside an Alchemy entry point and
executable scripts. Copying those files into a consumer would not count as a
Platform Kit boundary, and pinning Alchemy SDK types in a stable package would
make each Alchemy beta upgrade a public API change.

## Decision

Two dependency-light packages define callable contracts:

- `@agency/cms-alchemy` validates the structural manifest, stage, deployment
  origin, required bindings, isolated D1/R2/Worker names, unmanaged backup bucket,
  and cron plan. Consumers inject their pinned resource factories when they need
  generic composition.
- `@agency/cms-cli` creates safe relative file plans for idempotent site init and
  block scaffolding, applies them through an injected filesystem port, runs
  explicit contiguous value migrations, and verifies required artifacts plus
  resource isolation.

The live Alchemy stack consumes the packaged resource plan. `site:init` and
`site:verify` call the CLI package, and `cms:add-block` is a thin scaffold wrapper.
Template-specific seed generation, manifests, terminal copy, credentials, and
the concrete Alchemy SDK factories remain consumer adapters.

## Consequences

- Infrastructure and CLI contracts install without Rèm Việt, source aliases,
  Alchemy, Cloudflare SDK, or filesystem implementation dependencies.
- Dry-run and divergent-file behavior fail safely, while customized generated
  files are preserved by explicit policy.
- The eight-tarball clean consumer composes fake D1/R2/Worker factories and
  executes init, N-to-N+1 value migration, and verification entirely from packed
  artifacts.
- Production D1 migration execution, release provenance, N-to-N+1 package
  installation, and rollback receipts remain separate release gates.
