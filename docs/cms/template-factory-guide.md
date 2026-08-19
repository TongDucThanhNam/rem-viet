# Agency Template Factory guide

`@agency/cms-template-factory` is the developer-owned boundary for creating a
bounded client template. It composes `@agency/cms-visual-editor`; it does not
replace provider lifecycle, server authorization, revisions, or deployment
gates.

## One block definition

Use `defineCmsTemplateBlock()` once per component. The definition contains:

- canonical type and schema version;
- schema-generated inspector fields;
- defaults and a fail-closed parser;
- public renderer and admin editor mapping keys;
- component/field capabilities and layout constraints;
- seed creation; and
- every contiguous data migration.

`createCmsTemplateFactory()` turns those definitions into the typed component
registry, document parser, seed builder, and document/block migration path.
Missing component registrations, duplicate types, future schemas, migration
gaps, unknown slots, and invalid slot cardinality are rejected.

Nested composition is explicit. Declare named `slots` on a layout component,
including allowed child types and minimum/maximum counts. A component without a
declared slot does not gain arbitrary Webflow-style nesting.

## Site definition

`defineCmsAgencySite()` binds the template to a canonical `CmsSiteManifest`, a
versioned theme-token map, and reviewed asset contracts. The manifest template
ID and content schema must match the factory. Its brand logo must exist in the
asset contract. `createCmsAgencySiteArtifacts()` then emits:

- `site.manifest.json`;
- `theme.tokens.json`;
- `assets.contract.json`; and
- `content.seed.json`.

Every seed document must carry the same site identity as the manifest. This is
a generation-time tenant boundary in addition to provider/server enforcement.

## Agency workflows

`createCmsAgencyWorkflowPlan()` exposes the reusable workflow vocabulary:

| Workflow    | Purpose                                              |
| ----------- | ---------------------------------------------------- |
| `create`    | Plan and apply a non-destructive site bootstrap      |
| `add-block` | Generate a block scaffold owned by the template      |
| `check`     | Verify registrations/contracts and run quality gates |
| `migrate`   | Run backup-before-apply migrations                   |
| `seed`      | Load reviewed content into an isolated environment   |
| `dev`       | Start local development                              |
| `build`     | Produce a local build                                |
| `deploy`    | Prepare the existing guarded deployment workflow     |
| `backup`    | Run the existing backup workflow                     |
| `handover`  | Verify artifacts and complete the handover checklist |

Plans are descriptive and side-effect free. `deploy` is marked as a remote
mutation requiring explicit authorization; this package never deploys by
itself.

## Bundle boundary

Public renderers import template public entries and `@agency/cms-react` only.
Admin/editor mappings belong in explicit authoring subpaths. The repository
bundle test rejects `cms-admin` or `cms-visual-editor` sources in a public entry
graph.
