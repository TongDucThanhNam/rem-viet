# Admin viewport evidence

These captures are generated from the authenticated production-like local
runtime by the admin shell viewport-matrix Playwright test. They cover light
and dark mode at 360, 768, 1024, 1440, and 1920 px. The same test asserts
responsive navigation ownership, zero document overflow at every size, and
representative axe scans at 360 and 1440 px.

Regenerate them from the repository root by setting
`ADMIN_UX_EVIDENCE_DIR` to this directory and running:

```powershell
bun scripts/test-e2e-local.ts --grep "supported light and dark viewport matrix"
```

The full authenticated suite remains the behavioral acceptance source; these
PNG files are visual review aids rather than pixel-diff baselines.
