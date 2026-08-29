# Visual authoring architecture

The visual-authoring system is an extraction around the existing canonical CMS
documents, not a second page database and not an unrestricted page builder.

## Ownership boundaries

`@agency/cms-visual-editor` owns framework-neutral contracts and algorithms:

- canonical document/node identity and named slots;
- typed component registrations, fields, defaults and validation;
- searchable, bounded component-pattern registries and atomic insertion;
- a versioned, bounded structured clipboard with fresh-ID atomic insertion;
- template-declared inline-text targets, normalization and atomic updates;
- component/field capabilities and bounded layout constraints;
- insert, edit, move, duplicate and remove commands;
- branch-safe bounded undo/redo;
- selection, inspector and responsive-workspace contracts;
- contiguous document migrations and editor-adapter round trips; and
- authenticated preview envelopes, replay state and response headers.

`@agency/cms-admin` owns React authoring primitives such as autosave, draft
flush, preview connection state, generated collection controls and workflow
presentation. Provider packages own persistence, authorization, tenant/site
isolation, versions and immutable revisions. Templates own concrete schemas,
production React components, editor mappings, design tokens, assets and
migrations. Applications own transport, routing and server-session binding.

The public renderer imports only a template's public entry. Authoring mappings
live in explicit `./visual-authoring` or `./admin` subpaths, and the browser
metafile test rejects the visual kernel, admin and template factory from public
template entry graphs.

## Canonical flow

1. A developer defines a block once with schema version, fields, defaults,
   parser, renderer/editor keys, permissions, migrations and constraints.
2. The template factory creates the component and optional multi-block pattern
   registries, seed path and fail-closed document parser from those definitions.
3. An editor adapter maps the canonical document into replaceable UI state.
4. Copy captures canonical nodes in a bounded versioned payload. Paste treats
   that payload as untrusted input, regenerates every nested ID, and re-runs the
   destination registry, schema, slot, constraint, and insert-grant checks.
5. The host publishes only permission-granted inline targets. A rendered field
   can emit a bounded text intent, but the host repeats target, capability,
   normalization and schema checks before accepting it.
6. Every accepted command returns a new canonical document and revalidates the
   whole registry/constraint contract before persistence.
7. Provider writes authorize on the server, validate expected version and site
   identity, then preserve immutable published revisions.
8. Production renderers consume canonical blocks; no editor-library state is
   stored or required by the public bundle.

Puck and Craft.js remain possible future adapters. ADR 0035 records why the
custom adapter was retained: neither spike reduced maintained code enough while
preserving the established schema, permission, migration and bundle contracts.

## Secure preview

The v2 protocol binds every message to an explicit allowed origin, authenticated
session binding, site, document, document type, version, conflict token, source,
message ID, issue time and monotonic sequence. Receivers reject wrong source,
wrong identity, stale/future messages and replays before decoding the inner
adapter payload. Preview responses are private, no-store, noindex and carry an
explicit `frame-ancestors` policy.

Rèm's homepage host/preview pair uses v2 around its established v1 intent shapes
as a compatibility adapter. Standard-page, post and localized generic-collection
hosts/previews also create bound v2 peer sessions; the retained staging matrix
proves their authenticated origin/session/site/document/version/replay boundary.

## Reuse proof

Rèm registers ten existing homepage block types through a compatibility adapter
without rewriting persisted content, plus four standard-page block types and
two template-owned starter patterns. Its standard-page CTA title is the first
live inline-text consumer, and its live canvas consumes structured copy/paste
through the secure preview protocol. Atelier registers nine independent
editorial block types, a two-slot nested layout, two editorial patterns, and
inline-enabled masthead/nested-story titles through the factory; its nested-slot
fixture independently exercises the same clipboard kernel. Packed-consumer
tests run both against the same Cloudflare provider lifecycle. Thus shared
registry, inline, clipboard, pattern, constraint, provider and packaging fixes
reach both templates without copying their production components.
