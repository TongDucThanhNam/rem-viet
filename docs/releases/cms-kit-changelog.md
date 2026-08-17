# CMS Platform Kit changelog

All package versions are coordinated. A change is not released until its
compatibility matrix, migration notes, packed-consumer test, and rollback
evidence cover the same version.

## 0.1.0 — internal preview

### Added

- Neutral document/block contracts and runtime page/media workflow ports.
- Cloudflare D1/R2 provider with immutable page revisions, optimistic locking,
  scheduling, media usage protection, and additive migrations through
  `0003_media_metadata`.
- Typed React renderer and admin editor registries plus reusable autosave,
  preview, command, action, status, and revision composition.
- Rèm Việt template package with ten flagship and three standard-page version-1
  block contracts and legacy storage adapters.
- Callable Alchemy resource planning and CLI init/add-block/migrate/verify APIs.
- Exact-confirmation backup-before-apply migration orchestration and receipt-
  bound rollback.
- Eight-artifact clean-consumer, N→N+1→N rehearsal, artifact allowlist/content
  inspection, and fail-closed private-release provenance.

### Compatibility

- This is a private `0.x` preview. Install all eight packages at exactly
  `0.1.0`; mixed versions are unsupported.
- The validated toolchain and schema versions are recorded in
  `cms-kit-compatibility.json`.
- Stable `1.0` remains blocked on private-registry, independent staging,
  operational, non-developer pilot, and two-paid-site evidence.
