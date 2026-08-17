# ADR 0010: Flagship template ownership and neutral admin dispatch

- Status: Accepted
- Date: 2026-08-16
- Scope: post-KIT-014 all-block extraction

## Context

The Hero/FAQ vertical slice proved the package boundary, but eight Rèm Việt
block contracts and two application switches still prevented the template from
being consumed as a complete unit. Moving concrete React components into a
neutral package would also pull landing CSS, assets, and GSAP behavior across
the boundary before their packaging contract was understood.

## Decision

`@agency/cms-template-rem-viet` owns the versioned schema, canonical default,
legacy flattened adapter, migration list, and registry binding for all ten
flagship blocks. `@rem-viet/cms` remains an additive compatibility facade and
exports the established flattened names and values.

`@agency/cms-react` continues to own public renderer dispatch. Concrete landing
components remain app-owned and are injected into
`createRemVietBlockRegistry`; therefore the public renderer has no block-type
switch without changing any component markup, selectors, or GSAP lifecycle.

`@agency/cms-admin` owns a template-neutral typed editor registry and unknown-
editor policy. The Rèm Việt app injects its existing concrete field editors.
This removes the admin block-type switch but does not claim that the workflow
shell, autosave, preview, conflict handling, or template field editors have
been packaged.

All template blocks use schema version 1. The established homepage SQL seed is
the golden compatibility fixture: parsing every flattened seed block into a
canonical envelope and flattening it again must be lossless.

## Consequences

- Adding a template block changes the template registry, not a core renderer or
  admin switch.
- The compatibility facade contains no duplicate schema or default source of
  truth.
- The clean consumer installs six package tarballs and proves all ten blocks,
  public rendering, editor dispatch, and the provider workflow without source
  aliases.
- Concrete visuals/editors and the admin workflow shell remain explicit later
  extraction work; this decision does not make them neutral packages by name
  alone.
