# ADR 0032: Instance-scoped feature modules and pre-commit hooks

- Status: Accepted
- Date: 2026-08-18
- Scope: Core extension registry and generic Cloudflare collection lifecycle

## Context

Code-first collections can already travel from a consumer registry through the
generic runtime, Cloudflare persistence, and generated admin shell. Extending
that path still required consumers to assemble unrelated switches for hooks,
permissions, migrations, and admin metadata. A process-global plugin registry
would make tests and multiple CMS instances interfere, while post-commit hooks
could report failure after D1 had already persisted a mutation.

## Decision

`@agency/cms-core` exposes `defineFeatureModule()`,
`defineCmsLifecycleHook()`, and `createCmsExtensionRegistry()`. A module may
contribute collections, lifecycle hooks, permission declarations, executable
one-version migrations, and provider-neutral admin descriptors. Registry
construction rejects duplicate IDs and collection slugs, missing dependencies,
dependency cycles, and contributions aimed at unknown collections.

Every registry owns its maps and ordered arrays. Modules are topologically
ordered, with lexical IDs breaking ties. Hooks execute by module order, explicit
numeric order, then hook ID. There is no mutable singleton and installing a
module in one registry cannot change another.

Lifecycle events are `validate`, `create`, `update`, `publish`, `unpublish`,
`restore`, and `delete`. The Cloudflare collection provider authorizes the
operation and checks the target/version before invoking hooks. It executes
`validate` and then the operation event before assembling or submitting a D1
batch. Hook transforms flow to later hooks and are revalidated by the shared
collection parser; relationship integrity is checked against the transformed
data. Any thrown error aborts before document, revision, projection, redirect,
or audit writes begin.

Hooks are deliberately pre-commit. Database effects that must commit with a
document continue to use prepared mutation statements included in the provider
batch. Remote or best-effort post-commit work is outside this milestone.

The existing `registry` provider option remains a compatibility adapter.
Module-aware consumers pass `extensions`, whose collection registry is the
authoritative provider registry.

## Consequences

- Feature installation is public, deterministic, provider-neutral, and safe to
  use in multiple CMS instances in one process.
- Authorization failures occur before hooks, so unauthorized callers cannot
  trigger module behavior.
- Hook failures have simple rollback semantics because persistence has not
  started.
- Rèm Việt and the packed Acme fixture install collections and exercise hooks
  through the same APIs without changing their public rendering contracts.
- Post-commit webhooks and untrusted remote module loading remain separate,
  explicitly out-of-scope concerns.
