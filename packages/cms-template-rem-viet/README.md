# @agency/cms-template-rem-viet

Rèm Việt template-owned schemas and versioned defaults for all ten flagship
homepage blocks plus the rich-text, product-grid, and CTA standard-page blocks;
flattened compatibility adapters for existing stored content; and typed
renderer-registry factories. The package contains content contracts; concrete
React components, CSS, assets, GSAP behavior, and field controls remain consumer
injections.

`remVietTemplateComposition` is the authoritative bounded-composition policy.
It publishes minimum/maximum instance counts and pinned start/end regions for
every flagship block type, allowing an admin or provider adapter to expose only
safe add, duplicate, remove, and reorder actions.

`remVietTemplateAuthoringCatalog` is the authoritative localized discovery
metadata for those blocks. Admin surfaces should consume its labels,
descriptions, categories, and keywords instead of maintaining app-local copies;
the same catalog can power searchable section libraries across provider modes.

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
