# ADR 0022: Package/content upgrade and rollback rehearsal

- Status: Accepted
- Date: 2026-08-16
- Scope: coordinated Platform Kit package upgrades

## Context

A clean install proves packaging but not maintainability. The stable contract
requires a non-Rèm consumer to move from version N to N+1 with an explicit data
migration, retain CMS state, and return to N from a backup if validation fails.
Workspace aliases and mutating package sources during the rehearsal would make
the result non-representative.

## Decision

`cms:kit:upgrade` packs the eight workspace packages at `0.1.0`, copies their
publishable files to an isolated staging directory, normalizes workspace catalog
references, and packs a coordinated `0.2.0-rehearsal.1` set. It never edits the
workspace package manifests.

An independent copied consumer then:

1. installs every N tarball and bootstraps a persistent D1 page with two
   immutable revisions plus media metadata/object bytes;
2. installs every N+1 tarball, applies idempotent provider migrations, migrates a
   versioned content value from schema 1 to 2, and verifies all provider state;
3. restores the schema-1 backup, reinstalls every N tarball, and verifies the
   same draft, published revision pointer, revisions, media row, and object;
4. writes a receipt containing the installed versions and SHA-256 digest of each
   baseline and next artifact.

## Consequences

- Package and content rollback is a repeatable quality command rather than a
  documentation-only promise.
- Catalog/workspace references must be normalized before a package is portable;
  the rehearsal caught this before consumer installation.
- The rehearsal uses local tarballs and a staged prerelease. A real private
  registry publication, signed CI provenance, production D1 backup, and staging
  deployment receipt remain required before stable 1.0.
