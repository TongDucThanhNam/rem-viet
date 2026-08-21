# Client-ready release evidence

## Evidence templates and hygiene

The two Track A templates are intentionally invalid until real observations
replace every placeholder:

- `pilot-evidence.template.json` is the bounded non-developer worksheet consumed
  by `release:pilot:verify`.
- `v1.0.0-client-ready.template.json` is the final schema-v3 record consumed by
  `release:verify` and the tag workflow.

Only retain site/stage/origin, full Git SHA, deploy-input/artifact SHA-256,
provider receipt IDs, canonical GitHub Actions run URLs, aggregate counts,
bounded timing, issue IDs, and approval timestamps. Never put tokens, cookies,
passwords, account/database/bucket IDs, email addresses, phone numbers, lead
payloads, private env values, signed URLs, or raw provider/browser logs in these
files. The live audit commands reduce their output to the same allowlist before
printing it.

Evidence is stale when its release commit or deploy-input identity no longer
matches the exact clean checkout/live Worker, when a default-branch workflow
has drifted or become inactive, or when the current scheduled-backup/provider
audits no longer reproduce the recorded readiness. `release:readiness` performs
those live comparisons and must be rerun immediately before the offline
`release:verify`; a previously valid JSON file cannot override a current red
live audit.

Use `docs/cms/track-a-staging-release-procedure.md` for the exact clean-checkout
and staging order. Do not copy sample output from documentation into either
template.

## CMS Platform Kit private bundle

Prepare the coordinated twenty-four-package bundle from an exact clean commit with:

```bash
bun run cms:kit:release:prepare --version=0.1.0
```

The command packs every package at the same version, hashes each tarball, and
writes `provenance.json` plus `publish-plan.json` under `.tmp/cms-kit-release/`.
Provenance includes the full Git commit, clean/dirty state, `bun.lock` digest,
compatibility-matrix, changelog, and migration-notes digests, plus per-artifact
allowlist inspection counts. The compatibility matrix and release notes must
cover the requested version. Artifact inspection rejects tests/fixtures/source
maps/hidden configuration, secret-like material, and private-client coupling in
neutral packages. Workspace manifests remain `private`; preparation builds each
publishable tarball in an isolated temporary directory with that workspace-only
flag removed and rejects package lifecycle hooks. The preparation command does
not publish. A dirty local rehearsal may use
`--allow-dirty`, but its record is always `publishEligible: false`.

Private publication requires a clean record, an agency-controlled registry URL,
`CMS_PRIVATE_REGISTRY_TOKEN` supplied only in the release environment, and the
exact confirmation written to `publish-plan.json`. From the unchanged clean
checkout, run the guarded publisher and retain its receipt:

```bash
bun run cms:kit:release:publish \
  --bundle=.tmp/cms-kit-release/<prepared-bundle> \
  --confirm="PUBLISH CMS KIT <version> <full-git-commit>"
```

The publisher revalidates the commit, clean worktree, canonical provenance,
exact twenty-four-package plan, release-input hashes, and registry non-existence.
It then rebuilds all twenty-four tarballs from the clean source and requires matching
digests and sizes before the first write. It publishes with lifecycle scripts
disabled, verifies every package by exact version, and writes
`publication-receipt.json`. If a later package or
verification fails, retain `publication-receipt.partial.json` and investigate;
do not retry blindly. Do not turn a local tarball receipt into a registry claim.

The `v1.0.0-client-ready` tag is fail-closed. Before creating it:

1. Copy `v1.0.0-client-ready.template.json` to
   `v1.0.0-client-ready.json`.
2. Replace every placeholder with evidence from the exact release commit.
3. Keep identifiers, timings, hashes and provider message IDs, but never secrets
   or personal form payloads.
4. Commit the evidence, run `bun run release:verify`, then create the tag from
   that same clean commit.

Run the unified snapshot while preparing the record:

```bash
bun run release:readiness --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default --alerts-profile=alerts
```

It performs seven live audits in parallel: read-only D1 capacity, Cloudflare
alert history, deterministic alert-policy preflight, field performance,
notification-smoke preflight, GitHub scheduled-backup activation and the
tag-triggered client-ready workflow. The notification preflight also validates
public Worker provenance against repository HEAD. The GitHub release audit
requires byte-identical default-branch workflow content plus an active Actions
registration; a local YAML file alone is not release protection. `--profile` is
used for deploy/D1 audits; `--alerts-profile` is forwarded only to the two
Notifications audits so neither credential needs the other's permissions.
Results are reduced to safe counts/actions before combining them with schema-v3,
commit, deploy-input hash and clean-checkout status. Omitting site/stage/origin
is supported but explicitly leaves alert provisioning, field performance,
notification runtime and both GitHub activation audits open. It intentionally
exits nonzero until the release record is complete;
`release:verify` remains the authoritative final gate.

Audit only the tag gate without touching repository state:

```bash
bun run release:github:audit
```

The command never creates/enables a workflow or pushes a tag. It exits with a
release-gap status until the exact local contract is present and active on the
default branch.

Audit the field-performance gate directly against the deployed staging D1:

```bash
bun run site:vitals:audit --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default --json
```

The command is read-only and emits a `releaseEvidence` performance object only
after the fixed 28-day window has at least 75 qualifying samples for each of
CLS/LCP/INP and all three p75 budgets pass. Before that it exits nonzero and
returns `releaseEvidence: null`; never replace field data with synthetic rows.

Prepare the notification evidence with the two-phase smoke documented in the
operations runbook. Its default mode is read-only and emits a stable UUID. A real
send requires that UUID, `--apply` and exact `--confirm-origin`; it creates one
synthetic lead, requests one email, replays the key and proves D1/provider attempt
state. It still emits no evidence until a human who can see the configured inbox
runs `--verify --receipt-confirmed-at=<ISO timestamp>` with the same UUID. Copy
only that verified JSON's `releaseEvidence` object into `notification`; provider
acceptance without the external receipt is not delivery proof.

Prepare operational-alert evidence separately. Put
`CLOUDFLARE_ALERT_EMAIL` in private env. First prepare the isolated Alchemy
`alerts` profile with `cloudflare:alerts:profile`, authenticate it with only
account/user read and notification read/write scopes, and require the safe
dry-run receipt to report `credentialsReady=true`. That OAuth profile is for
read/verify only: live Cloudflare evidence rejects its policy POST. Create a
dedicated account-owned token scoped to this account with Account Notifications
Read plus Edit/Write, store it only as `CLOUDFLARE_ALERT_API_TOKEN` in private
env, and do not reuse `CLOUDFLARE_API_TOKEN`. Then run
`cloudflare:alerts:policy --profile=alerts` without `--apply`, and create the
deterministic policy only with exact origin and policy-name confirmations. Token
verification proves only that a token is active; the successful policy POST is
the write-permission proof. The tool never updates or
deletes drifted policies and never claims that the underlying Workers
Observability threshold exists. After an operator configures the documented
`cms.operational_incident` threshold, triggers a controlled notification failure
and confirms the email in the real inbox, rerun with
`--verify --receipt-confirmed-at=<ISO timestamp> --json`. Copy only that verified
`releaseEvidence` object into `notification.operationalAlert`; a matching provider
history row without human receipt is not delivery proof.

The verifier requires all master-plan release boundaries together: root quality,
staging desktop/mobile safety, an unassisted non-developer pilot under 30
minutes, 28-day staging real-user p75 with at least 75 samples per metric,
exactly-once
Resend notification and a delivered Cloudflare email alert from an enabled
Health Check or Workers Observability policy, a clean-checkout isolated second
site under two hours, one-day brand/content entry, the plan's 90%/30-minute/
10-second/5-minute KPI limits, production security rotation/review, and an
immutable production backup made before migration with a restore drill. The
second-site gate additionally requires an immutable staging backup to pass an
isolated remote D1 restore with exact table/row parity before provisioning; the
temporary target must be deleted afterward. The verifier also requires two
distinct immutable production-backup receipts from the configured GitHub
workflow: one successful `workflow_dispatch`, followed by the next successful
weekly `schedule` run within eight days.

Before copying either receipt into the completed release record, run the
read-only verifier:

```bash
bun run site:backup:github:audit --site=rem-viet --stage=production
```

It suppresses repository variable values and secret material, requires the
default-branch workflow to match the audited local contract, downloads only the
retained JSON evidence, validates the restore and immutable R2 archive as one
run-bound artifact pair, enforces 365-day protection, and requires the scheduled
receipt to follow the manual dispatch with a distinct object.

The template intentionally fails validation. It is a checklist, not evidence.
The completed JSON is an auditable attestation; retain the referenced external
artifacts in agency-controlled storage according to the operations runbook.

## Platform Kit v1 evidence

Track B has a separate stable-product gate; the client-site record above cannot
substitute for it. The kit verifier requires two exact restricted-registry
publication receipts: the shared starting version and the `1.0.0` release that
contains one named core fix. For each of at least two independent paid sites,
copy `cms-kit-adoption.template.json` into `docs/releases/evidence/` and record
the external deployment/upgrade result. Use only opaque repository, engagement,
and support-agreement SHA-256 fingerprints—never client contracts, invoices,
credentials, repository URLs, or private names.

Each adoption receipt must prove a clean independent repository installed only
public package exports, ran provider conformance and a production-like restore,
used the reusable admin workflow, lacked the named core fix before upgrade,
contained it afterward, copied no package source/patch, completed handover, and
was approved afterward by the client owner. Both receipts must bind the exact
SHA-256 values of the initial and target registry publication receipts.

After those receipts are committed, copy `cms-kit-v1.0.0.template.json` to
`docs/releases/evidence/cms-kit-v1.0.0.json`, replace every placeholder, and
run:

```bash
bun run cms:kit:v1:verify \
  --evidence=docs/releases/evidence/cms-kit-v1.0.0.json
```

The final verifier parses both publication receipts and every adoption receipt,
rehashes and requires every referenced JSON file to be tracked, proves unique
site/repository/origin identities, checks version/fix/digest/chronology links,
and verifies the current commit is a strict descendant of the target release
source. From that source commit onward, only `docs/releases/evidence/` changes
are permitted. It also binds the current changelog digest and requires the
target version plus core-fix ID to appear there. Final agency-owner approval must
follow assembly and both client-owner approvals. `--validate-only` checks only
the top-level JSON shape and is never stable-release evidence.

Both templates intentionally fail validation until real external data replaces
every placeholder. The correct label remains `0.x technical candidate` until
the full command passes from the clean evidence commit.

Generate the clean-checkout second-site fragment with
`bun run site:smoke:staging`. Its dry-run reports only readiness booleans. Apply
requires exact site/origin confirmation, operator timing windows, a password
injected through `CMS_E2E_PASSWORD`, matching clean local/live provenance and a
three-noop provider plan. It requires four mutation/cleanup scenarios in the
desktop Chrome project and two separate responsive/accessibility/visual-
authoring scenarios in the mobile Chrome project. The mobile authoring receipt
selects the 390 × 844 canvas, proves click-to-inspector focus, searchable
component discovery, zero page overflow, and automated accessibility. The
desktop matrix includes
the exact neutral `runPageProviderConformance` contract through the deployed,
authenticated page API, covering draft isolation, optimistic conflict,
schedule/unschedule, publish, immutable revisions, restore, unpublish and
delete with cleanup. A desktop-only Playwright report cannot satisfy the staging
receipt. The command emits only `releaseEvidence.secondSite`; its fail-closed
schema requires `desktopChrome`, `mobileChrome`, and
`cloudflarePageProviderConformance` to be true. It never accepts a password
argument or copies browser/provider failure output into the receipt.

Use `site:backup:archive:prepare` and `site:backup:archive` for Cloudflare R2.
Only copy the command's `releaseEvidence` object after its locked upload and
download/hash verification pass; a local `.sql` file remains `immutable=false`.
`site:backup:scheduled` and `.github/workflows/scheduled-cms-backup.yml` automate
the same verification for recurring operations. Record both canonical GitHub
Actions run URLs, distinct run IDs and the immutable R2 evidence returned by
each run. These recurring receipts never substitute for the production export
created immediately before the migration recorded by this release.

The agency owner's approval timestamp must follow every recorded gate. This
keeps final sign-off from being copied forward before the scheduled receipt,
restore drill, field evidence or security review actually exists.

## Optional Sanity promotion evidence

The experimental Sanity adapter has an independent three-commit evidence chain;
it is not part of the stable twenty-four-package publication merely because local
tests pass. From a clean source commit, run and commit the schema-v3 hosted
receipt. From that next clean commit, run and commit the Presentation receipt,
Playwright report, and screenshot. From the resulting clean evidence commit,
run `cms:sanity:promotion` dry-run and exact-confirmed apply.

The final verifier is network-free. It parses both receipt schemas, validates
their scope and chronology, rehashes all four files, requires strict Git
ancestry, and allows only `docs/releases/evidence/` changes between proof
commits. The hosted blob must exist at the Presentation commit while the later
browser receipt and artifacts must not. `.gitattributes` marks this evidence
tree `-text` so checkout line-ending conversion cannot invalidate a recorded
SHA-256. Commit the resulting promotion-readiness receipt; it authorizes a
technical review but does not itself remove the package's experimental version
or provide commercial approval.

## Pilot evidence before final assembly

The pilot can be validated independently before the other external gates are
ready. Copy `pilot-evidence.template.json`, record the real non-developer result
and run:

```bash
bun run release:pilot:verify --evidence=docs/releases/pilot-evidence.json --site=rem-viet --origin=https://rem-viet-web-staging.terasumi.workers.dev --commit=<full-deployed-git-sha>
```

The standalone contract is the same pilot contract consumed by the final
release verifier, plus per-step timings, confusion notes and tester approval. It
requires an existing Git commit and fetches `/api/health` from the exact origin.
The live Worker must report the same site, staging stage, clean commit and
deploy-input SHA-256 recorded in `pilot.deployment`. The tool never performs
pilot actions or turns incomplete checkboxes into a pass. Copy only its
`releaseEvidence` fragment into the final record after the tester confirms it.
