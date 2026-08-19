# Visual authoring architecture

The visual-authoring system is an extraction around the existing canonical CMS
documents, not a second page database and not an unrestricted page builder.

## Ownership boundaries

`@agency/cms-visual-editor` owns framework-neutral contracts and algorithms:

- canonical document/node identity and named slots;
- typed component registrations, fields, defaults and validation;
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
2. The template factory creates the registry, seed path and fail-closed document
   parser from that definition.
3. An editor adapter maps the canonical document into replaceable UI state.
4. Every accepted command returns a new canonical document and revalidates the
   whole registry/constraint contract before persistence.
5. Provider writes authorize on the server, validate expected version and site
   identity, then preserve immutable published revisions.
6. Production renderers consume canonical blocks; no editor-library state is
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
as a compatibility adapter. Standard-page and post routes remain incremental
follow-up migrations; they are not silently claimed as v2 adopters.

## Reuse proof

Rèm registers ten existing block types through a compatibility adapter without
rewriting persisted content. Atelier registers nine independent editorial block
types and a two-slot nested layout through the factory. Packed-consumer tests
run both against the same Cloudflare provider lifecycle. Thus shared registry,
constraint, provider and packaging fixes reach both templates without copying
their production components.
