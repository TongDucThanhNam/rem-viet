# ADR 0023: Fail-closed private release preparation

- Status: Accepted
- Date: 2026-08-16
- Scope: Platform Kit distribution metadata

## Context

Packed-consumer and upgrade tests used local tarballs but did not define a
coordinated private-release record. Publishing packages independently could mix
versions, lose source provenance, or make a dirty checkout look releasable.
Automated preparation must not silently authorize an external registry write.

## Decision

`cms:kit:release:prepare` requires an explicit semver shared by all eight package
manifests. It packs the artifacts, records SHA-256 and size for each, and binds
the bundle to the Git commit/source state, `bun.lock`, and the checked-in CMS Kit
compatibility matrix. Every tarball is inspected before provenance is emitted:
only package metadata, README/license, and allowlisted `src` file types may be
present; tests, fixtures, source maps, hidden configuration, secret-like
assignments, and private-brand coupling in neutral packages are rejected.
The requested version must also have an exact compatibility-matrix entry,
changelog section, and structured migration/rollback notes. Their digests are
bound into provenance beside the lockfile.

The generated publish plan names a restricted private registry and token
environment variable, but the preparation command never publishes. Provenance
is publish-eligible only from a clean checkout with a full Git commit. The
`--allow-dirty` option exists solely for local rehearsal and can never make its
bundle eligible.

## Consequences

- Mixed package versions, duplicate subjects, invalid digests, and dirty release
  sources fail closed before an external write.
- Publish allowlist and content-policy counts are bound into each package record.
- Release inputs and every tarball can be independently verified from the bundle.
- Registry credentials remain outside files and command output.
- Actual private publication, registry-side provenance/retention, and an
  independent staging install remain external receipts; local preparation must
  not be reported as those outcomes.
