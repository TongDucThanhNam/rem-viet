# `@agency/cms-visual-editor`

Framework-neutral visual-authoring contracts for Agency CMS. The package owns
canonical visual nodes, component/field registries, searchable reusable pattern
registries, bounded composition, permissions, commands, local history, document
migrations, editor adapters, and the authenticated preview protocol. Pattern
insertion is bounded, validates every nested component permission, advances the
document exactly once, and therefore remains one undoable authoring action.

It deliberately contains no React, drag-and-drop library, provider SDK,
database code, application routes, or public renderer. Puck, Craft.js, or the
current custom editor may implement `CmsVisualEditorAdapter`, but their state is
never the canonical database format.
