# ADR 0026: Confirmation-gated private publication

- Status: Accepted
- Date: 2026-08-16
- Scope: Platform Kit private registry distribution

## Context

Release preparation proves artifact coordination and provenance but deliberately
does not write to a registry. Copying its generated `npm publish` commands by
hand would leave clean-checkout verification, partial publication state, and
registry-side verification dependent on operator discipline. A local pack
receipt must also remain distinguishable from an actual registry receipt.

## Decision

`cms:kit:release:publish` is the only documented publication path. It accepts a
prepared bundle under `.tmp/cms-kit-release`, eligible clean provenance, the
agency registry and token from environment variables, and the exact confirmation
`PUBLISH CMS KIT <version> <full-commit>` recorded in the publish plan.

Immediately before registry access it verifies the current commit and empty Git
status, canonical provenance, the exact package set and plan, and release-input
digests. Preparation creates publishable artifacts in isolated temporary
directories: it removes the workspace-only `private` flag without mutating the
source manifest and rejects install/publish lifecycle hooks. The publisher
rebuilds those artifacts from the clean source and requires every SHA-256 and
size to match the prepared record, so a modified untracked bundle fails closed.
It also rejects a version already present in the registry before the first
write. Publication is restricted and disables lifecycle scripts. After each
package it persists partial state, verifies the exact registry version, and only
then emits a final `published-and-verified` receipt for the complete coordinated
set. The temporary npm configuration contains an environment-variable reference,
not the token, and is removed in a `finally` block.

## Consequences

- Preparation remains safe to rehearse and never authorizes publication by
  itself.
- Dirty, changed, mismatched, unauthenticated, or casually confirmed releases
  fail before the first registry write.
- A mid-flight failure is visible through a partial receipt; operators must
  reconcile immutable registry versions rather than retry blindly.
- The executor and receipt schema are proven locally, but a successful private
  registry receipt remains external evidence and cannot be synthesized.
