# Visual authoring extension guide

Extensions are developer-owned code. Client editors may compose only the block
types, fields, children and counts declared by the template.

## Add a component

1. Choose a stable lower-camel-case type and schema version. Never reuse a type
   for incompatible data.
2. Define one strict parser and reviewed defaults. Reject unknown future schema
   versions and unsafe links/media values.
3. Declare inspector fields, including required reviewed alt text for editable
   media.
4. Point to production renderer and editor mapping keys. Keep both mappings out
   of the public entry unless the renderer itself is needed publicly.
5. Declare insert/edit/move/duplicate/remove capabilities and any field-specific
   overrides. Missing capabilities deny the operation.
6. Declare allowed parents and named slots with child allowlists and cardinality.
   A missing slot is not an implicit free-form container.
7. Register every contiguous migration before increasing the schema version.
8. Add seed, parse/serialize, command, permission, migration, SSR and public-
   bundle tests.

`defineCmsTemplateBlock()` produces the schema field definition, seed creator,
renderer/editor mapping and migration registration from that single contract.
`createCmsTemplateFactory()` must be able to parse the complete default document
before the block is considered registered.

## Change an existing component

Add a migration rather than rewriting stored documents. Migrations must advance
exactly one version, preserve node IDs/site identity and be deterministic. Run
existing-content golden fixtures through the canonical parser and adapter, then
verify public SSR before and after the adapter round trip.

If the visual UI needs a new behavior, extend the neutral adapter/command
contract only when both templates can use it. Template-specific presentation,
copy, CSS and animation stay in the template.

## Permission and security review

Client-side controls are presentation only. Repeat capability, tenant/site,
schema and expected-version enforcement at the server/provider boundary. New
preview messages must use the v2 envelope, validate the inner payload after the
envelope, and never use `*` as the target origin. Render user content through
React or a reviewed sanitizer; do not introduce raw HTML sinks.

## Required verification

Run the affected package type/tests, boundary and public-bundle tests, packed
clean consumer, upgrade/rollback rehearsal, secure web build and the relevant
authenticated browser lifecycle. A local component demo is not provider,
accessibility or migration evidence.
