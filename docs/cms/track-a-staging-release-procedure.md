# Track A staging release procedure

This is the canonical procedure for preparing a Rèm Việt Track A staging
candidate from a clean checkout. It does not authorize a production change, a
staging deployment, a GitHub setting/secret write, a workflow dispatch, or a
package publication.

## Release boundary

- Run from the exact commit intended for staging. `git status --porcelain` must
  be empty before the clean-checkout gate and again after it.
- Use only `rem-viet`, `staging`, and
  `https://rem-viet-web-staging.terasumi.workers.dev` in the commands below.
- Never pass credentials on the command line. Alchemy/Cloudflare profiles and
  password-manager injection are the only supported credential paths.
- Stop on any unexpected create, replace, delete, non-additive database plan,
  P0/P1 issue, failed cleanup, or provenance mismatch.
- Production is out of scope. The production backup and migration gates remain
  open until the real launch window.

## 1. Clean-checkout local gate

Create a new checkout outside the working repository so ignored state,
`node_modules`, local databases, and private env files cannot make the gate pass:

```bash
git clone --no-local <repository-url> rem-viet-track-a-release
cd rem-viet-track-a-release
git checkout <full-release-commit>
git status --porcelain
bun install --frozen-lockfile
bun run quality
git status --porcelain
```

Both status commands must print nothing. Root quality is authoritative and
already includes the high-severity dependency audit, migration parity,
formatting, unit/contract tests, all 14 empty/upgraded CMS migrations, packed
clean-consumer install/build/provider smoke, N→N+1 upgrade/rollback rehearsal,
18 package typechecks, secret-canary build scan, artifact performance budgets,
and isolated Rèm Việt/Acme desktop/mobile E2E.

Record only the full commit, start/end timestamps, command, exit code, Bun
version, and pass/fail. Do not retain environment values or raw browser/provider
logs in release evidence.

## 2. Safe staging inspection

These commands are read-only or stop before provider effects:

```bash
bun run site:deploy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev --dry-run

bun run site:deploy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev --preflight

bun run site:deploy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev --plan

bun run release:readiness --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --profile=default --alerts-profile=alerts
```

The readiness command is expected to exit nonzero while any external receipt is
missing. A zero exit is meaningful only when the schema-v3 release record,
current live audits, clean checkout, GitHub workflows, and deployed provenance
all agree.

Before an authorized apply, review the provider plan against the previous live
inventory. Database changes must be the repository's additive migrations;
existing D1 and R2 identities must remain manifest-owned. Do not infer deletion
permission from an unrecognized or empty resource.

## 3. Authorized staging apply

This phase requires explicit staging-deployment authorization and working
provider credentials. First create and validate a staging backup:

```bash
bun run site:backup --site=rem-viet --stage=staging --remote
bun run cms:restore:drill --file=backups/<new-export.sql>
```

Retain the command's sanitized SHA-256, size, table count, critical row counts,
and restore result. Do not commit the SQL or a provider download URL.

Apply only the reviewed plan:

```bash
bun run site:deploy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev --yes

bun run site:deploy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev --plan
```

The post-apply plan must report Worker, D1, and R2 as `noop`. If apply partially
fails, follow the D1 recovery section in `docs/agency-operations-runbook.md`; do
not delete resources or clear Alchemy state.

## 4. Post-deploy verification

Run the public/authenticated staging smoke required by the release schema, then
confirm `/api/health` exposes the exact site, stage, full commit, deploy-input
SHA-256, and `sourceState=clean`. The database migration ledger must contain all
14 migrations.

For the independent site, inject `CMS_E2E_PASSWORD` from the password manager
and run the exact desktop/mobile/provider-conformance receipt flow:

```bash
bun run site:smoke:staging --site=acme-demo --stage=staging \
  --origin=https://<acme-staging-host> --dry-run

bun run site:smoke:staging --site=acme-demo --stage=staging \
  --origin=https://<acme-staging-host> \
  --deploy-started-at=<ISO-8601> --deploy-completed-at=<ISO-8601> \
  --brand-started-at=<ISO-8601> --brand-completed-at=<ISO-8601> \
  --confirm-site=acme-demo --confirm-origin=https://<acme-staging-host> --apply
```

Cleanup failure invalidates the receipt. Never copy credentials, form payloads,
email addresses, raw provider errors, or D1/R2 IDs into the evidence record.

## 5. Handover and final release evidence

Use `docs/client-handover-checklist.md` and
`docs/pilot-handover-script.md`. The pilot must be performed by a
non-developer against the same clean staging deployment. Start with the
intentionally invalid templates:

- `docs/releases/pilot-evidence.template.json`
- `docs/releases/v1.0.0-client-ready.template.json`

Validate the real pilot with `release:pilot:verify`, rerun
`release:readiness`, then run `release:verify` only after every external receipt
exists. Do not tag while either command is nonzero.

## Current external operator inputs

| Gate                         | Exact external input required                                                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flagship staging convergence | Explicit authorization for the staging backup/apply and credentials accepted by the `default` Alchemy profile.                                                                          |
| Notification delivery        | Private deployed `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, and `EMAIL_FROM`; controlled smoke UUID; one real inbox receipt timestamp.                                                |
| Operational alert            | Private `CLOUDFLARE_ALERT_EMAIL`; Workers Observability threshold configured in the dashboard; controlled failure; correlated Cloudflare dispatch and inbox receipt.                    |
| Scheduled backup             | GitHub variables `CMS_BACKUP_SITE`, `CMS_BACKUP_STAGE`, `CLOUDFLARE_ACCOUNT_ID`; dedicated secret `CMS_BACKUP_CLOUDFLARE_API_TOKEN`; one green manual run and the following weekly run. |
| Field performance            | At least 75 representative public samples for each of CLS, LCP, and INP in the audited 28-day staging slice, within all p75 budgets.                                                    |
| Independent site             | Clean deployment of the exact release commit, password-manager-provided `CMS_E2E_PASSWORD`, timed operator receipt, and successful six-scenario cleanup.                                |
| Human pilot                  | A non-developer tester, unassisted run, per-task timings, post-run tester approval, and zero open P0/P1 defects.                                                                        |
| Production launch            | Explicit production authorization, rotated secrets, immutable pre-migration production export, isolated restore drill, migration window, and owner approval.                            |
