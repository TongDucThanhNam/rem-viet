# Atelier second-template proof

`@agency/cms-template-atelier` proves that the visual-authoring kernel and
template factory are not Rèm Việt-specific. It is an editorial arts journal,
not a landing-page reskin: the information architecture is organized around an
issue masthead, index, stories, visual essays, quotations, events, membership,
and publication contact details.

## Independent design and component system

Atelier owns its production React components and a print-inspired visual
system: cobalt, signal red, mint and paper tokens; ruled editorial columns; and
publication-oriented typography. Its public package imports no Rèm Việt
components, assets, CSS, copy, animation, or authoring adapter.

The template has nine registered component types:

1. `masthead`
2. `issueIndex`
3. `storyCard`
4. `mediaFeature`
5. `quotePull`
6. `scheduleGrid`
7. `membershipCta`
8. `siteFooter`
9. `columnLayout`

`columnLayout` demonstrates bounded nested composition. Its `primary` slot
accepts one to six story, media, or quotation nodes. Its `sidebar` accepts one
to four index or membership nodes. Unknown slots, incompatible child types,
and invalid cardinality fail closed in the shared kernel.

## Shared platform path

The package uses `defineCmsTemplateBlock()` and
`createCmsTemplateFactory()` for the same registry, schema fields, permissions,
defaults, validation, migrations, renderer/editor mappings, and seed path used
by the Rèm Việt adapter. It uses the same canonical visual document and node
contracts from `@agency/cms-visual-editor`.

The packed clean-consumer rehearsal installs Atelier from a tarball and runs a
second complete `createCloudflareCmsPageProvider()` conformance scenario on an
isolated local D1 database. That scenario proves draft isolation, optimistic
conflicts, scheduling, immutable publication, revisions, restore, unpublish,
and deletion with Atelier documents. The content then renders through
`AtelierDocument`, independently of the Rèm renderer registry.

This shared execution path is the evidence that fixes to kernel slot
validation, factory registration, and provider lifecycle reach both templates
without copied patches.

## Generated operation surface

`createAtelierBootstrapPlan()` produces the site manifest, theme tokens, asset
contract, content seed, environment-name contract, SVG assets, and handover
checklist through package APIs. It accepts the Cloudflare provider contract and
rejects provider drift. The generic workflow planner supplies `create`,
`add-block`, `check`, `migrate`, `seed`, `dev`, `build`, `deploy`, `backup`, and
`handover`; deploy remains a descriptive remote mutation requiring explicit
authorization.

## Verification

- Atelier unit/type tests cover nine blocks, nested constraints, distinct SSR,
  generated artifacts, and fail-closed provider identity.
- The browser metafile test proves both public template entries exclude the
  visual editor, admin, and template-factory source graphs.
- The clean-consumer rehearsal installs and runs both template lifecycles from
  packed artifacts.
- The coordinated eleven-package N-to-N+1 rehearsal includes Atelier and
  restores the baseline packages and content backup.

No deployment, public package publication, paid-client reuse, or human
usability evidence is claimed by this local proof.
