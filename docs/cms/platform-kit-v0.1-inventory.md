# Platform Kit v0.1 coupling and public-symbol inventory

Date: 2026-08-15

This is the KIT-002 baseline used for the Hero/FAQ strangler slice. It records
coupling rather than treating the current module layout as the target design.

## Current public surface

`@rem-viet/cms` exposes a single root entry point. Its public symbols fall into
these groups:

| Group                  | Representative exports                                                     | Current coupling / disposition                                                                          |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Landing template       | ten block schemas, types, defaults, `homeBlockSchema`, `defaultHomeBlocks` | Hero/FAQ schemas and defaults now originate in the template package; eight blocks remain legacy         |
| Revision documents     | page/post snapshot schemas, JSON value                                     | Portable candidates, but still include current page/template assumptions                                |
| Roles and capabilities | staff roles, capability schema, role policy                                | Capability vocabulary now originates in core; role mapping remains client policy                        |
| Rich text and URLs     | rich-text schemas/parser, safe link/media schemas                          | Generic candidates; safe link/media primitives are available in core while compatibility exports remain |
| Site and operations    | manifest, forms, redirects, incidents, deployment provenance, vitals       | Application/provider/operations coupling remains outside KIT-001–007                                    |
| Media policy           | MIME allowlist, limits, key pattern                                        | Current Cloudflare application policy; not core                                                         |

The additive compatibility surface now also re-exports core envelopes,
document factories, capabilities, migrations, and errors. No existing export
was removed.

## Coupling map

| Area             | Evidence location                                                               | Coupling observed                                                     | v0.1 action                                                                                   |
| ---------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Content services | `packages/api/src/services/content.ts`, `content-revisions.ts`                  | imports `@rem-viet/cms`; Drizzle rows and published-revision behavior | unchanged; runtime/provider work starts at KIT-008                                            |
| Database         | `packages/db/src/schema/content.ts`, migrations 0006-0008                       | D1/Drizzle tables and JSON block payloads                             | unchanged; never exported from core                                                           |
| Admin            | `apps/web/src/routes/admin/home.tsx`, `admin-home-block-editor.tsx`             | ten concrete form branches and workflow UI                            | unchanged for editor behavior; Hero/FAQ legacy facade keeps inputs stable                     |
| Public renderer  | `apps/web/src/components/landing/homepage-renderer.tsx`                         | concrete component switch plus section metadata                       | Hero/FAQ dispatch moved to typed registry; eight render cases remain                          |
| Hero/FAQ visuals | `landing/hero.tsx`, `landing/faq.tsx`                                           | app CSS, icons, GSAP wrapper/hooks, loader state                      | markup and animation lifecycle unchanged; renderer components injected into template registry |
| Infrastructure   | `packages/infra/alchemy.run.ts`, `packages/infra/src`, `packages/infra/scripts` | Cloudflare resources and operational contracts                        | unchanged; forbidden from neutral packages                                                    |
| Provisioning     | root `site:*` scripts and direct `packages/cms/src/*` imports                   | repository-local paths and site lifecycle                             | unchanged; CLI extraction starts after this slice                                             |

## Direct-import debt

Repository scripts still deep-import `packages/cms/src` for site manifests,
defaults, deployment provenance, and revision validation. This is documented
coupling, not a package API endorsement. It must be removed when CLI/runtime
libraries are extracted; changing it during the Hero/FAQ slice would broaden
the regression surface without proving the registry boundary.
