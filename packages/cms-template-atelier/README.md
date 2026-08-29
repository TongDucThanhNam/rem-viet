# `@agency/cms-template-atelier`

Second-template proof for an independent editorial arts journal. It uses a
modular print-inspired system—cobalt, signal red, mint, condensed labels, ruled
columns—and an issue/story/event information architecture. It imports no Rèm
Việt landing component, asset, CSS, copy, or animation.

The public entry exports schemas and production React components. The
`./visual-authoring` entry composes nine block definitions through the shared
template factory and visual kernel, including a named two-column layout with
bounded primary/sidebar slots and two searchable editorial patterns. Pattern
insertion exercises the same nested constraints and permissions as manual
composition. Masthead and nested story titles also opt into the same
permission-filtered inline-text contract used by the Rèm template; the template
declares content semantics and bounds without importing any app route or React
editing implementation. Its nested story fixture also proves the shared
structured clipboard can paste into a declared layout slot with fresh IDs and
one document version while preserving Atelier's independent schema and
constraints. The same nested fixture maps its primary/sidebar slots into the
shared permission-aware outline and renders the packaged ARIA tree without Rèm
labels or route code. `./bootstrap` generates a complete client plan.
