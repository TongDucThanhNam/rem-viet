# ADR 0035: Visual Authoring Kernel and replaceable editor adapter

- Status: Accepted
- Date: 2026-08-19
- Scope: visual-authoring extraction and custom/Puck/Craft.js decision gate

## Context

Rèm Việt has three production-component visual editors: homepage, standard
page, and post. They already share autosave, flush, optimistic conflicts,
immutable revisions, focus-workspace behavior, connection state, bounded local
history, and a neutral composition-intent protocol. Their canonical documents
are provider-owned CMS values, not editor-library state.

The productization milestone requires one framework-neutral kernel and a
replaceable adapter boundary. Before selecting an editor library, the existing
implementation was compared with Puck 0.23.0 and Craft.js 0.2.12. The bounded
spike used React 19.2.3 and TypeScript 6, compiled canonical round-trip adapters,
and built separate browser entry points. The minified results were:

| Entry                          |     Bytes |
| ------------------------------ | --------: |
| Production renderer with React |    26,216 |
| Puck editor                    | 1,050,988 |
| Craft.js editor                |   129,003 |

Both library adapters round-tripped the spike's canonical document. That proves
an adapter is possible; it does not make either vendor state acceptable as the
database contract.

## Decision matrix

Scores are 0 (fails) through 5 (strong). Compatibility means compatibility
with the current contracts, not general product quality.

| Criterion                              | Existing custom |   Puck | Craft.js |
| -------------------------------------- | --------------: | -----: | -------: |
| React 19 and TanStack Start            |               5 |      5 |        2 |
| Cloudflare Workers boundary            |               5 |      4 |        3 |
| Same-origin iframe support             |               5 |      5 |        2 |
| Keyboard and accessibility behavior    |               4 |      4 |        2 |
| Extensibility                          |               4 |      5 |        4 |
| Maintenance health                     |               5 |      5 |        2 |
| Public-bundle isolation                |               5 |      4 |        4 |
| Deterministic canonical serialization  |               5 |      4 |        2 |
| Document migration support             |               5 |      4 |        1 |
| Permission enforcement                 |               5 |      4 |        3 |
| Preserve the existing canonical schema |               5 |      4 |        3 |
| **Total / 55**                         |          **53** | **48** |   **28** |

Puck is the only credible library candidate. It supports React 19, iframe
preview, viewports, slots, dynamic component permissions, history, and data
migration utilities. It is active and extensible. However, introducing it now
would not materially reduce maintained code: the three editors' secure preview,
autosave, revision, conflict, media, field permission, template constraint, and
provider integration contracts must remain. Puck would initially add an adapter,
config mappings, and a second history/selection system while the proven custom
workspace remains in service. The editor-only payload is isolatable but large.

Craft.js provides lower-level drag/drop and node state rather than a complete
accessible editor. Its serialized resolver-name/node graph is more invasive,
responsive iframe and field UI remain application work, and current React 19
maintenance evidence is weaker. It cannot satisfy the gate with less maintained
code.

Primary project evidence consulted on 2026-08-19:

- Puck repository and releases: <https://github.com/puckeditor/puck>
- Puck component/iframe API: <https://puckeditor.com/docs/api-reference/components/puck>
- Puck permissions: <https://puckeditor.com/docs/api-reference/permissions>
- Puck slots: <https://puckeditor.com/docs/api-reference/fields/slot>
- Puck migration contract: <https://puckeditor.com/docs/integrating-puck/data-migration>
- Craft.js repository and serialization model: <https://github.com/prevwong/craft.js>
- Craft.js React 19 issue inventory: <https://github.com/prevwong/craft.js/issues>

## Decision

Retain the existing custom editor as the first adapter. Extract pure contracts
to `@agency/cms-visual-editor`:

- canonical document/node identity and typed component/field registry;
- renderer/editor mapping keys, defaults, validation, slots, cardinality, and
  parent/child constraints;
- component and field capability checks;
- selection, command, bounded history, and migration contracts;
- a library-neutral `CmsVisualEditorAdapter` with canonical round-trip checks;
- the established v1 intent protocol as a compatibility export; and
- a v2 authenticated preview envelope with explicit origin allowlists, site,
  document, session binding, version/conflict identity, monotonic sequence,
  stale/replay rejection, and private/no-store/noindex response headers.

`@agency/cms-admin` remains the React workflow/presentation package and
re-exports the moved compatibility symbols during the migration window. Puck
may be reconsidered as a second adapter only if a later route deletion proves a
net maintained-code reduction and all server-side security/permission/lifecycle
tests remain unchanged.

## Consequences

- Canonical content remains independent of custom, Puck, Craft.js, or another
  editor implementation.
- The public renderer imports neither this editor package nor a UI library.
- Existing content and v1 messages remain compatible while routes adopt v2
  session-bound envelopes incrementally.
- UI permission projections never replace server authorization.
- Puck/Craft state may exist only inside an adapter and must pass canonical
  round-trip and migration fixtures before use.
