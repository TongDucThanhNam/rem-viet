# ADR 0027: Provider-neutral visual authoring

- Status: Accepted
- Date: 2026-08-16
- Scope: CMS authoring experience and provider integration boundary

## Context

The platform kit already defines structured blocks, workflow primitives, and a
provider boundary, but the first admin experience presented those capabilities
as conventional forms beside a small reload-based preview. Current visual CMS
products make the rendered page the primary workspace: editors select content
in context, see draft changes immediately, switch viewport profiles, and reorder
only within composition boundaries owned by the frontend.

Sanity, Storyblok, and future providers use different preview transports and
overlay implementations. Treating one vendor's visual-editing SDK as a core
contract would leak provider types into templates and make the platform harder
to adopt incrementally.

## Decision

Visual authoring is a first-class but provider-neutral capability. The core
publishes a small capability description (`draftMode`, `livePreview`,
`clickToEdit`, `sectionReorder`, `responsivePreview`, `webhooks`,
`localization`). It is deliberately separate from authorization grants and
storage capabilities.

The admin package owns a versioned visual-editor message protocol. The initial
self-hosted adapter uses same-origin `postMessage` events for ready, state,
selection, target-relative move/insert intents (`before`/`after`), duplicate,
and remove. Receivers validate the channel and message shape, then the template
validates the current block schema and composition boundary before applying
state. A provider adapter may replace this transport with vendor-native preview
APIs while preserving the same authoring intent.

The rendered React page remains the source of visual truth. Preview mode
annotates existing section roots and template-registered field targets
imperatively instead of inserting layout wrappers. Selection messages may carry
a stable schema field path; the host validates that path against the current
block's field registry before focusing its inspector control. The canvas is the
primary workspace, the block tree provides bounded composition and ordering,
and human-readable forms act as the selected block's inspector. Hero and final
CTA positions stay pinned; other registered sections may be enabled, disabled,
or reordered. The selected section receives a contextual canvas toolbar with
keyboard-operable up/down controls and a drag handle. Drop indicators annotate
existing section roots, while the left block tree remains an equivalent
accessible fallback. The template publishes explicit minimum/maximum instance
counts and start/end pinning per block type. The canvas and sidebar both derive
add, duplicate, and remove availability from that policy; removal keeps a
one-click undo path. Repeated blocks receive fresh top-level and nested stable
IDs, and preview annotations map each rendered occurrence to exactly one
structured block.

The admin package also owns a provider-neutral, bounded draft command-history
primitive. New commits clear the redo branch, rapid edits in the same semantic
field group coalesce into one step, and consumers can reset history when a
server version replaces the working draft. The flagship editor applies it to
all block field and composition changes, exposes undo/redo in the canvas chrome,
and supports `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl+Y` outside native text
controls. This immediate local history is separate from immutable published
revisions and provider restore semantics.

Component discovery follows the same boundary. The template publishes an
exhaustive, immutable authoring catalog for every composable block type: a
localized label, concise purpose, category, and search keywords. The admin owns
only the accent-insensitive catalog filter and presentation primitives. Both the
sidebar and live canvas intersect this catalog with the template's current
cardinality rules, then render searchable descriptive choices. Provider studios
may present the catalog differently, but applications must not fork labels or
discovery vocabulary locally.

## Consequences

- Editors get live, contextual authoring without coupling the frontend to a
  specific hosted CMS.
- Template layout, accessibility, animation, and responsive behavior remain
  owned by React and the design system.
- Provider integrations can report visual-editing capabilities honestly and
  keep provider-specific preview mechanics inside their adapter packages.
- Every distinct rendered editing surface across all flagship block types has a
  stable field-path target, including copy, media, action regions, icons,
  statistics, overlays, accessibility labels and repeated items. A delegated
  hover chip identifies the exact inspector destination before selection.
- Authenticated browser coverage compares the complete registered path set with
  rendered annotations and verifies that every target resolves to a mounted
  inspector control. It also moves a structured section from the canvas,
  restores the original order, adds, duplicates and removes bounded sections,
  exercises undo/redo buttons and keyboard history, proves repeated instances
  retain independent annotations, and proves pinned regions expose no drag,
  duplicate, or remove action.
- The same browser proof searches both sidebar and canvas catalogs without
  Vietnamese diacritics, verifies purpose copy, dismisses by keyboard, and
  inserts the selected structured section.
  Invisible companion metadata such as image alt text,
  internal media IDs and crop/number-format settings stays in the adjacent
  inspector; it is not misrepresented as a separate visual hit target.
- Cross-origin provider studios will require an explicit trusted-origin policy;
  the self-hosted transport remains same-origin by default.
