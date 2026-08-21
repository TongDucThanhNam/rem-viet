# `@agency/cms-module-taxonomy`

Provider-neutral nested-document and taxonomy module. It owns a versioned term
collection, validates bounded forests, rejects missing parents, cross-taxonomy
links, duplicate sibling slugs, and cycles, and exposes deterministic roots,
children, breadcrumbs, descendants, and safe tree moves. Uninstall retains the
canonical hierarchy until an operator explicitly exports and purges it.
