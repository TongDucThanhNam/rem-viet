# `@agency/cms-admin`

Provider- and template-neutral admin primitives. Version `0.1.0` dispatches
typed structured-block editors without a block-type switch and defines
explicit unknown-block behavior. It also provides trailing autosave, bounded
draft flush, save-before-preview orchestration, save-before-command execution,
capability-filtered action slots, keyed revision rows, and draft-status slots.
Reusable authoring helpers include bounded/coalesced draft command history,
bounded plain-text clipboard normalization for Google Docs/Office paste,
accent-insensitive template-catalog filtering, deep JSON revision equality,
stable-ID block revision summaries, value-safe metadata-field comparison, and a
provider-neutral media-selection resolver that adopts reviewed library alt text
without retaining stale descriptions while allowing explicit decorative-image
preservation.
Reusable-content primitives add accent-insensitive library discovery, published
and draft-only status, inbound usage counts, synced/pinned reference state,
override reset, and guarded detach actions. They consume the same complete
English/Vietnamese locale packs and per-message overrides as Admin Platform v2.
The app still supplies styling and mutations, while these primitives keep the
authoring semantics, translated copy, and accessibility structure consistent
across templates.
`resolveCmsEditorialReviewPresentation` centralizes review status and action
availability so unsaved or stale content is never presented as approved while
the application retains full control of localization and visual design. Both
request and decision actions require explicit grants; the resolver never infers
review authority from write, publish, or a role label.
Block movement is based on relative surviving-block order so neighboring
insertions and deletions do not create false reorder claims.
The package also owns the versioned, provider-neutral visual-authoring protocol
for preview readiness, canonical draft state, section selection, and optional
stable schema field paths for exact inspector focus. The first self-hosted
adapter carries these messages over same-origin `postMessage`;
hosted provider adapters may use their native preview transport without changing
the core message intent. Template browser coverage should prove that every
registered rendered surface is annotated and resolves to a mounted inspector
control; metadata with no distinct visual surface stays beside its primary field
in the inspector.
Applications still adapt their router, localized control presentation, transport,
provider, concrete field editors, conflict UI, and outer page-shell layout.

`CmsCollectionAdminShell` generates semantic collection navigation,
filter/search controls, list tables, and create/edit forms from a core registry.
Built-in controls cover every core field kind, relationship options are supplied
by the application, conditional visibility is shared with validation, and field-
or kind-level control registries allow template-owned premium UX without forking
the workflow shell. Generated interface copy resolves through the shared complete
English/Vietnamese locale packs; consumers select it with `uiLocale`, may provide
bounded `messageOverrides`, and receive the same resolved messages in custom field
controls. Transport, URLs, content locale state, collection/field labels, and
mutations remain consumer callbacks.

For localized collections the generated list and forms expose an accessible
locale selector, label fields as shared or localized, show locale/fallback
state in result rows, and preserve locale in edit and preview callbacks. The
application still owns routing, content-locale state, and translated collection
and field labels.
