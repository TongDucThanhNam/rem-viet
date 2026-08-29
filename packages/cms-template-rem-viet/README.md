# @agency/cms-template-rem-viet

Rèm Việt template-owned schemas and versioned defaults for all ten flagship
homepage blocks plus the rich-text, product-grid, CTA, and reusable-reference
standard-page blocks;
flattened compatibility adapters for existing stored content; and typed
renderer-registry factories. The package contains content contracts; concrete
React components, CSS, assets, GSAP behavior, and field controls remain consumer
injections.

The root export is safe for public rendering and does not import admin or visual
editor code. Authoring consumers opt into two isolated subpaths:

- `./admin` contains React editor-registry factories.
- `./visual-authoring` contains the ten-component homepage kernel registry, the
  four-component standard-page registry, template-owned searchable patterns,
  and the custom editor compatibility adapter.

`toRemVietVisualDocument()` and `fromRemVietVisualDocument()` preserve the
existing block envelopes exactly. The established flattened homepage seed still
passes through `toRemVietTemplateBlock()` and `toLegacyRemVietTemplateBlock()`;
no database rewrite is required.

`remVietTemplateComposition` is the authoritative bounded-composition policy.
It publishes minimum/maximum instance counts and pinned start/end regions for
every flagship block type, allowing an admin or provider adapter to expose only
safe add, duplicate, remove, and reorder actions.

`remVietTemplateAuthoringCatalog` is the authoritative localized discovery
metadata for those blocks. Admin surfaces should consume its labels,
descriptions, categories, and keywords instead of maintaining app-local copies;
the same catalog can power searchable section libraries across provider modes.

`remVietStandardVisualPatternRegistry` supplies starter content/CTA and catalog
section presets for the standard-page editor. They create canonical blocks with
fresh stable IDs, pass through the shared visual command and permission path,
and are committed by the app as one undoable history entry.

The standard-page CTA title opts into the shared inline-text contract. The live
canvas receives only permission-granted target metadata, emits a bounded v1
compatibility intent inside the authenticated v2 preview envelope, and the host
revalidates the field declaration, grants, normalization, schema, and canonical
command before committing one draft-history entry. Other fields remain
inspector-only until the template explicitly opts them in.

The live standard-page canvas also consumes the shared structured clipboard.
Copy serializes the selected canonical block into the versioned, bounded kernel
format. Paste creates fresh stable IDs, revalidates the Rèm standard-page
registry and `content.compose.insert` grant at the destination, and commits all
inserted roots as one undoable history entry. Canvas and host shortcuts travel
through the authenticated preview session; the clipboard payload itself never
bypasses the canonical command path.

The live standard-page block list is also backed by the shared visual outline
instead of a route-local list algorithm. The Rèm adapter supplies Vietnamese
labels and maps the application write capability to the template's explicit
composition grants; selection, stable IDs, action availability, and keyboard
tree behavior come from the packaged kernel/admin contract.

The `./bootstrap` export is the installed-template initializer consumed by
`agency-cms plan-init`. It generates a schema-v2 plan containing the canonical
site manifest, empty environment example, all-ten-block draft seed, handover
checklist, and client-named logo/media placeholders. Requested provider,
features, preset, template identity, and exact `0.1.0` version are validated
before a plan is returned. The stable initializer supports the Cloudflare
provider; experimental provider setup remains a separate explicit workflow.

`remVietStandardPagesCollection` is the code-first schema used by the live
standard-page vertical slice. It declares versioned fields, lifecycle,
permissions, SEO defaults, admin columns, and the allowed standard blocks.
`toRemVietStandardPageCollectionData()` and
`fromRemVietStandardPageCollectionData()` are the compatibility boundary
between the generic collection envelope and the existing public page shape.
`remVietStandardPagesModule` installs that collection plus its validation hook,
permission metadata, schema migration contribution, and admin navigation
contribution through the public core extension API used by independent
consumers.

The `reusableContent` standard block preserves a page-local visual ID while its
payload points to a provider-neutral reusable fragment. Public rendering swaps
the wrapper for the resolved concrete block; authoring may stay synced, pin a
published revision, apply bounded local overrides, or detach a provenance-bound
copy without changing the three concrete renderer contracts.

`remVietLocalizedCampaignsCollection` is the template's localization fixture:
Vietnamese and English variants share a campaign code while keeping their
headline and complete lifecycle independent. It is installed by the same
feature module, proving localization does not require a template-specific
provider branch.
