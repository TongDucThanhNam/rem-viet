# `@agency/cms-visual-editor`

Framework-neutral visual-authoring contracts for Agency CMS. The package owns
canonical visual nodes, component/field registries, searchable reusable pattern
registries, a versioned structured clipboard, permission-filtered inline-text
targets, bounded composition, permissions, commands, local history, document
migrations, editor adapters, and the authenticated preview protocol. Pattern
and clipboard insertion are bounded, validate every nested component permission,
advance the document exactly once, and therefore remain one undoable authoring
action. Clipboard paste regenerates every nested node ID and validates the
destination registry, schema, slots, constraints, and grants; copied JSON is not
trusted as authority. Inline editing is opt-in per text field; discovery and
mutation both enforce component and field grants, and accepted text is
normalized, bounded, schema-validated, and applied through the same atomic
command path as inspector edits.

It deliberately contains no React, drag-and-drop library, provider SDK,
database code, application routes, or public renderer. Puck, Craft.js, or the
current custom editor may implement `CmsVisualEditorAdapter`, but their state is
never the canonical database format.
