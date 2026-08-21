# `@agency/cms-module-import`

Provider-neutral import/export module with a bounded WordPress WXR parser,
deterministic conflict planning, dry-run, checkpointed batch execution, and
portable JSON reports. XML DTD/entities are rejected before parsing. Imported
canonical content is retained on uninstall; an operator must explicitly export
and purge module-owned import receipts.
