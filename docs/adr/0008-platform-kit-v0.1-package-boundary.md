# ADR 0008: Platform Kit v0.1 package boundary

- Status: Accepted
- Date: 2026-08-15
- Scope: KIT-001 through KIT-007

## Context

`@rem-viet/cms` currently mixes portable content contracts with the flagship
landing template and application-facing operational schemas. Moving all ten
landing blocks, persistence, admin, and infrastructure at once would make it
hard to distinguish a valid package boundary from a behavior regression.

## Decision

Use a private-first, additive strangler slice at version `0.1.0`:

```text
Rem Viet app / clean consumer
  -> @agency/cms-template-rem-viet
       -> @agency/cms-react
            -> @agency/cms-core
  -> @rem-viet/cms compatibility facade
       -> @agency/cms-template-rem-viet
       -> @agency/cms-core
```

The complete target graph remains:

```text
consumer/template -> cms-admin/cms-react/cms-runtime -> cms-core
provider -> cms-runtime + cms-core
cms-alchemy -> provider/runtime contracts
cms-cli -> public package APIs
```

Dependencies may only point inward. Core cannot import React, a provider SDK,
an application, or a template. React cannot import a concrete template or
persistence. A template can depend on React/Core contracts but not a provider.
The compatibility facade is intentionally outside the neutral graph.

The canonical block shape is `{ id, type, schemaVersion, enabled, data }`.
Hero and FAQ own schema version 1 in the template package. The compatibility
facade parses the existing flattened records and returns the unchanged legacy
shape, so stored revisions, editors, and API payloads remain compatible during
the strangler phase.

The package scope is `@agency/*`. Packages remain `private: true` and are
distributed as explicitly installed tarballs/private-registry artifacts. The
0.1 artifacts contain allowlisted TypeScript source plus package metadata and a
README; they do not depend on monorepo aliases. Internal unpublished packages
are coordinated optional peers so sibling tarballs satisfy them without a
public npm lookup.

Hero and FAQ React implementations remain in the Rem Viet app for this slice
because their CSS, icons, GSAP wrapper, SplitText, loader gate, and shared hooks
are application assets. The template package owns their canonical schemas,
defaults, adapters, and registry factory. The app injects the unchanged
renderers into that registry. Moving renderer implementation and theme assets
is a later template-distribution concern, not a reason to couple `cms-react` to
the flagship.

## Stable 1.0 criteria

Do not tag 1.0 until all ten flagship blocks use versioned template contracts,
provider conformance and upgrade/rollback fixtures pass, CLI install/verify is
idempotent, at least one non-Rem-Viet consumer has completed an N to N+1
upgrade, public APIs and migration policy are documented, and release
provenance is independent of any client deployment.

## Consequences

- Existing `@rem-viet/cms` imports continue to work.
- New consumers can use portable envelopes and the registry immediately.
- Hero/FAQ rendering has one registry dispatch rather than a template switch.
- The other eight blocks and provider/admin/CLI extraction remain deliberately
  coupled until later tickets prove their own boundaries.
- Publishing to public npm, production deployment, and SaaS adapters are out of
  scope for this decision.
