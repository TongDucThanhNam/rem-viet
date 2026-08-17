# ADR 0004: Per-client infrastructure isolation

- Status: Accepted
- Date: 2026-08-13

## Decision

The agency starter is single-site software. Every client gets a distinct
Worker, D1 database, R2 bucket, secrets and domain. We will not add `tenantId`
to application tables and will not build SaaS billing or cross-client admin.

Reusable code is distributed through the agency starter/private packages;
client data is never centralized. Resource names will later derive from a
validated site manifest plus deployment stage.

Extraction rule: implement Rèm Việt and one additional client first. Extract a
shared abstraction only after the repeated boundary is visible in both sites.
