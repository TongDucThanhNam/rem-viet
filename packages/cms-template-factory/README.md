# `@agency/cms-template-factory`

Schema-first factory for bounded Agency CMS templates. One block definition
provides its canonical schema, generated inspector fields, defaults, renderer
and editor mapping keys, seed hook, migrations, permissions, and layout rules.
The factory composes those definitions into the shared visual-authoring kernel.

Site definitions bind a canonical manifest to versioned theme tokens, reviewed
asset contracts, seed documents, and fail-closed lifecycle workflow plans. The
package contains no React components, provider SDK, database code, or deployment
side effects.
