# `@agency/cms-agency`

Provider-neutral, content-free agency control-plane contracts. Sites emit
strict signed receipts containing deployment identity, versions, provider,
health checks, migration drift, backup verification, aggregate audit/alert/job/
webhook counts, and handover state. Receipts never contain content, secret
values, raw logs, webhook payloads, customer data, or backup locators.

`verifyCmsAgencySiteReceipt()` authenticates each receipt with a host-trusted
Ed25519 verifier before `createCmsAgencyFleet()` accepts it.
`inspectCmsAgencyFleet()` reports stale receipts, unhealthy sites, version
drift, pending migrations, missing/stale production backups, critical alerts,
dead letters, and unsigned handover without joining client content databases.

Operations are deliberately one site/stage at a time.
`createCmsAgencyOperationPlan()` only creates a reviewable backup, upgrade,
handover-export, or owner-rotation plan. `dispatchCmsAgencyOperation()` requires
the exact confirmation and, for production upgrades, a fresh verified
site-bound backup receipt created after the plan. The package supplies no bulk
production mutation path.
