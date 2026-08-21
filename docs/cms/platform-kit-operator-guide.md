# Agency CMS Platform Kit operator guide

Status: internal `0.x` operating contract<br>
Validated baseline: `@agency/cms-*` `0.1.0`<br>
Compatibility source: `docs/releases/cms-kit-compatibility.json`

This guide is for agency engineers who install, extend, upgrade, and support a
client repository. It does not replace a client statement of work or turn a
local rehearsal into registry, staging, or production evidence.

## 1. Installation

### Prerequisites

- Use the exact Bun and framework versions recorded in the compatibility matrix.
- Start from a client-owned repository and a client manifest with unique Worker,
  D1, R2, backup-bucket, domain, and secret names.
- Obtain read access to the agency private registry. Keep the token in the
  release environment; never place it in `.npmrc`, a site manifest, source, or
  generated evidence.
- Retain the registry publication receipt and the artifact SHA-256 values from
  `provenance.json`.

Install one coordinated version of the required packages. The stable release
set contains 24 artifacts; a site normally installs one provider, the neutral
runtime/admin packages, the modules it enables, and its selected template. Do
not mix versions:

```bash
bun add @agency/cms-core@0.1.0 @agency/cms-runtime@0.1.0 \
  @agency/cms-provider-cloudflare@0.1.0 @agency/cms-react@0.1.0 \
  @agency/cms-admin@0.1.0 @agency/cms-alchemy@0.1.0 \
  @agency/cms-cli@0.1.0 @agency/cms-visual-editor@0.1.0 \
  @agency/cms-collaboration@0.1.0 \
  @agency/cms-module-seo@0.1.0 @agency/cms-module-redirects@0.1.0 \
  @agency/cms-module-search@0.1.0 @agency/cms-module-forms@0.1.0 \
  @agency/cms-module-taxonomy@0.1.0 @agency/cms-module-import@0.1.0 \
  @agency/cms-module-observability@0.1.0 \
  @agency/cms-module-privacy@0.1.0 \
  @agency/cms-module-cache-cloudflare@0.1.0 \
  @agency/cms-template-factory@0.1.0 \
  @agency/cms-template-atelier@0.1.0 \
  @agency/cms-template-rem-viet@0.1.0
```

The coordinated release also contains the alternative
`@agency/cms-provider-local` and `@agency/cms-provider-postgres` artifacts. Do
not install more than one provider unless the application is an explicit
migration harness.

The release also contains `@agency/cms-agency` for a separate operator-owned
control-plane application. Do not install it in every client site and do not
centralize client content, secrets, backup locations, or raw logs. Feed it only
host-trusted signed site receipts and dispatch one reviewed site/stage plan at a
time.

Install only the official modules the site uses. Taxonomy retains canonical
trees; import retains imported content and receipts until explicit export/purge;
search, observability, and cache receipts are derived and deletable. Configure
Sentry/OpenTelemetry exporters and Cloudflare credentials only in the server
environment. WordPress WXR import must be dry-run and reviewed before applying
its checkpointed plan.

Collaboration presence and locks are ephemeral; comments and activity are
personal/editorial records and must be exported before uninstall. Configure a
site-owned realtime transport only at the adapter boundary—the collaboration
kernel works without it. Privacy exports and erasure execution are server-only.
Review the exact subject and policy version, retention result, and active legal
holds before dispatching an erasure plan. Keep exported personal data outside
repository and release evidence.

For an existing TanStack Start application, use the packaged integration
command before template initialization:

```bash
bunx --bun agency-cms add \
  --framework=tanstack-start --provider=cloudflare --dry-run
bunx --bun agency-cms add \
  --framework=tanstack-start --provider=cloudflare
bunx --bun agency-cms diagnose
```

Valid provider IDs are `cloudflare`, `local`, and `postgres`. `add` creates only
CMS-owned files and missing package entries, installs dependencies, and writes
`.agency-cms/integration.receipt.json`. Re-running the same command is
idempotent. A divergent managed file or script fails closed. Use
`--skip-install` only for a reviewed offline workflow. Removal follows the same
receipt and preserves consumer-owned changes:

```bash
bunx --bun agency-cms remove --dry-run
bunx --bun agency-cms remove
```

The clean-room packed verifier exercises add, repeated add, diagnose, build,
typecheck, remove, post-remove build, and public-bundle provider isolation for
all three providers. This is local package evidence; repeat the chosen path in
the client repository and target operating system.

The installed package exposes a real binary. A template owns the versioned init
plan and verification spec; the neutral CLI validates and applies them:

```bash
bunx --bun agency-cms plan-init \
  --template=@agency/cms-template-rem-viet/bootstrap \
  --site=<client-id> --name="<client name>" \
  --site-url=https://<production-origin> \
  --preset=showcase --provider=cloudflare \
  --features=blog,leads,media \
  --output=plans/site-init.json --dry-run
bunx --bun agency-cms plan-init \
  --template=@agency/cms-template-rem-viet/bootstrap \
  --site=<client-id> --name="<client name>" \
  --site-url=https://<production-origin> \
  --preset=showcase --provider=cloudflare \
  --features=blog,leads,media \
  --output=plans/site-init.json
bunx --bun agency-cms init --plan=plans/site-init.json --dry-run
bunx --bun agency-cms init --plan=plans/site-init.json
bunx --bun agency-cms verify --spec=plans/site-verify.json
```

Never run the non-dry init until its file list and modes have been reviewed.
`plan-init` writes only the review artifact; it does not initialize the site.
The selected installed initializer must bind its exact package version and ID to
the manifest. Its generated seed uses client-named placeholder assets rather
than silently referencing files that exist only in the Rèm Việt repository.
`exact` and `json-exact` files reject drift; `preserve` files retain deliberate
client customization. All paths are repository-relative and the CLI refuses to
overwrite a divergent file.

Then:

1. Create a schema-v2 site plan with `createCmsSiteBootstrapPlan`; inspect the
   canonical manifest, generated files, and `requiredSecrets` before calling
   `applyCmsFilePlan`. Schema-v1 plans are compatibility input, not the standard
   for a new client.
2. Compose per-client infrastructure with `createCmsAlchemyResourcePlan` and
   provider-specific factories. Confirm every required binding explicitly.
3. Apply provider migrations to an empty local D1 database and load the client
   seed through a template adapter.
4. Register template renderers and editors through the public registry APIs.
5. Run typecheck, build, provider conformance, and `verifyCmsSiteArtifacts`.
   Staging browser evidence must include distinct desktop and mobile Playwright
   projects; a desktop project resized to a narrow viewport is not a mobile
   receipt. The desktop staging matrix must also execute the neutral page-
   provider conformance function through the authenticated deployed API; route
   smoke alone is not equivalent provider evidence.
   If the template adopts global content, also run the keyed global-provider
   conformance and retain a browser receipt that edits, renders, and restores
   site settings plus every registered navigation location.
6. Provision staging, migrate, seed, create the initial owner, and remove the
   bootstrap credential before any handover.

### PostgreSQL and S3-compatible deployment

Choose `--provider=postgres` for deployments outside the Cloudflare D1/R2
runtime. The generated `.env.cms.example` lists the server-only contract:

- `CMS_POSTGRES_URL` for PostgreSQL;
- `CMS_S3_REGION`, `CMS_S3_BUCKET`, `CMS_S3_ACCESS_KEY_ID`, and
  `CMS_S3_SECRET_ACCESS_KEY` for object storage;
- optional `CMS_S3_ENDPOINT` for MinIO, R2's S3 API, or another compatible
  service; and
- a random 32+ character `CMS_ADMIN_TOKEN` for the generated example API
  boundary. Replace that example bearer boundary with the application's real
  actor/session resolver before client handover.

Run `applyPostgresCmsMigrations(pool)` as a deployment step before shifting
traffic. Reuse the same `pg.Pool` for the collection and media providers.
PostgreSQL mutations use serializable transactions and advisory transaction
locks; the current provider stores collection state and DAM metadata in
separate JSONB state tables per namespace. This is a transactional portability
baseline, not a claim of fully normalized per-document scale. Load-test the
client's expected collection and DAM volume before approval.

Keep the S3 bucket private. Serve assets through the DAM delivery adapter's
bounded presigned URLs, apply bucket lifecycle/retention rules deliberately,
and verify object versioning or backup recovery with the client's storage
service. The local conformance suite covers collection and DAM behavior, and a
live MinIO test covers signed put/get/exists/delete behavior. A real target
PostgreSQL/S3 staging rehearsal is still required.

For a provider migration, keep the driver in the client repository and export
only `inspectVersion`, `createBackup`, `applyStep`, and `restoreBackup`. Run the
CLI with the plan's printed exact confirmation and separate success/recovery
paths. The command verifies the backup before mutation, checks every schema
transition, never overwrites a receipt, and writes the recovery point when an
apply fails. Use that recovery (or the successful migration receipt) with the
exact rollback confirmation; do not improvise a provider rollback outside the
receipt chain.

Never copy package source into the client repository or import a package's
`src/*` path. A missing public export is a Platform Kit issue, not permission to
create a privileged deep import.

Extension packages follow the separate signed lifecycle in
`docs/cms/extension-sdk-guide.md`. Verify provenance and compatibility before
loading code, run the compatibility kit only against disposable storage, and
retain its receipt. Normal installation cannot downgrade an extension; use the
exact upgrade receipt for a reviewed rollback. Never let an editor install
arbitrary extension code.

### Experimental Sanity visual tier

Sanity is opt-in and is not one of the coordinated stable artifacts. Start from
`apps/studio/README.md`, keep Studio schema code in the agency-owned repository,
and create documents through the provider with the template's
`encodeRemVietSanityPageContent` codec. Configure the Studio and frontend
origins exactly; provision a Viewer token and a separate preview-cookie signing
secret only in the server environment. Hero and SEO fields accept native Sanity
assets with crop/hotspot controls and retain a URL fallback for existing
provider-managed media. Keep asset selection and URL building in a code-owned
provider/web materializer so the saved crop/hotspot is applied and the portable
page contract still receives `src`, `mediaId`, and `alt`; do not leak Sanity
asset references into neutral packages. A passing local Studio/web build is
necessary but insufficient: retain the schema-v3 clean-Git hosted-conformance receipt and
a browser-visible Presentation proof covering secret activation, Hero/FAQ
editing, click-to-edit, in-place mutation updates, release-perspective switching,
and exact cleanup before advertising this tier to a client.

Commit the hosted receipt first, keep authenticated browser state only under
the ignored `.playwright/.auth/` directory, and use the guarded receipt runner:

```bash
bun run cms:sanity:presentation:login
bun run cms:sanity:presentation --id="<proof-id>" \
  --hosted-receipt="docs/releases/evidence/<hosted-receipt>.json"
bun run cms:sanity:presentation --apply --id="<proof-id>" \
  --hosted-receipt="docs/releases/evidence/<hosted-receipt>.json" \
  --confirmation="<exact phrase printed by dry-run>"
```

The apply step requires a clean full Git SHA and matching project, dataset,
Studio origin, and preview origin. Retain its exclusive JSON receipt, hashed
Playwright report, and hashed screenshot together; never retain or publish the
authenticated storage-state file.

Commit those browser artifacts without source changes, then run the promotion
verifier with the two receipt paths and proof ids. Its dry run prints the exact
confirmation; the confirmed apply writes an exclusive promotion-readiness
receipt only if both Git intervals are evidence-only, both proof commits are
strict ancestors of the clean evidence commit, and every receipt/artifact hash
matches. The command is `bun run cms:sanity:promotion`; it is deliberately
network-free and does not alter the adapter version or stable release set.

For published-content invalidation, configure a narrow Sanity document webhook
to `POST https://<frontend-origin>/api/sanity/webhook`. Use the exported
`SANITY_WEBHOOK_FILTER` and `SANITY_WEBHOOK_PROJECTION`, disable drafts and
versions, and set a unique 32+ character secret in both Sanity and the frontend
as `SANITY_WEBHOOK_SECRET`. The endpoint verifies the raw signed bytes and the
expected project/dataset headers before parsing. It records Sanity's
`idempotency-key` in D1, treats current/completed retries as duplicates, reclaims
an abandoned processing lease, and deletes the exact Cloudflare cache keys for
the affected agency page (plus `/` for `home`). Failed purge work releases the
claim and returns 503 so Sanity can retry. The scheduled Worker deletes only
completed delivery records older than 30 days.
Keep the provider's default `webhooks: false` until that complete receiver is
deployed; opt in explicitly only for the configured environment.

Do not enable the webhook capability with a custom bearer header alone, a
parsed-and-reserialized body, an in-memory idempotency map, draft events, or an
empty revalidation callback. After deployment, retain a Sanity attempts-log
delivery showing the endpoint's 202 response and a second delivery/replay
showing deterministic deduplication; this is external evidence and is not
created by the local test suite.

## 2. Template authoring

For new bounded visual templates, prefer `defineCmsTemplateBlock()` and
`createCmsTemplateFactory()` as described in
`docs/cms/template-factory-guide.md`. One definition owns schema fields,
defaults/seed, parser, renderer/editor keys, permissions, constraints and
migrations. `@agency/cms-template-atelier` is the independent nine-block
nested-slot example; it is not a Rèm component fork.

Each editable block owns five explicit artifacts:

1. a versioned data schema and stable block type;
2. a default/seed value with stable IDs;
3. a migration chain for every supported older schema version;
4. a renderer registered in the template's React registry;
5. an editor registered in the admin registry.

Use the installed binary for the initial template-owned vertical slice:

```bash
bunx --bun agency-cms add-block \
  --site=<client-id> --type=<lowerCamelType> --directory=src/blocks
```

The command creates the versioned block envelope, defaults, migration entry
point, fresh-ID seed factory, renderer, editor, typed registry definitions,
public exports, machine-readable `block.manifest.json`, and `REGISTER.md`. The
template must directly depend on `zod`, React, `@agency/cms-core`,
`@agency/cms-react`, and `@agency/cms-admin`. Re-run is idempotent; divergent
generated code is never overwritten. `REGISTER.md` remains a deliberate human
integration step because arbitrary registry/union rewrites are not safe to
automate. Add the block to the template package, never to a core switch
statement. Verify:

- parse/serialize golden fixtures and rejection of unknown future versions;
- public SSR output and the chosen unknown-block policy;
- editor changes, autosave, preview flush, publish, revision, and restore;
- global settings/navigation schemas stay template-owned while using the keyed
  provider contract; every admin save supplies the loaded expected version and
  every restore appends a new immutable revision;
- image alt text and safe rich-text/link rules;
- animation/layout behavior in the client app, including reduced motion and
  mobile static paths.

A client-only layout or field component may stay in the client repository. Move
it into a neutral package only after a second real template proves reuse.

## 3. Upgrade and migration

Never upgrade one package independently. Prepare a coordinated release from a
clean commit:

```bash
bun run cms:kit:release:prepare --version=<next-version>
```

For an authorized private release, inspect `provenance.json` and
`publish-plan.json`, set `CMS_PRIVATE_REGISTRY_URL` and
`CMS_PRIVATE_REGISTRY_TOKEN` only in the release environment, then run the
separate publisher with the exact generated confirmation:

```bash
bun run cms:kit:release:publish \
  --bundle=.tmp/cms-kit-release/<prepared-bundle> \
  --confirm="PUBLISH CMS KIT <version> <full-git-commit>"
```

The publisher accepts only the unchanged clean prepared checkout, restricted
access, and all 24 hash-matching artifacts. Keep the final publication
receipt outside the ephemeral checkout. If a partial receipt remains, stop and
reconcile registry state package by package before preparing a new version;
published package versions are immutable and must not be overwritten.

Before staging or production:

1. Verify the release provenance, artifact policy, compatibility matrix,
   changelog, schema notes, and rollback boundary.
2. Run `bun run cms:kit:clean-checkout` from the exact source commit. Retain its
   receipt; it covers the frozen install, packed consumers, portability,
   receipt-bound migration rollback, isolated local backup/restore, and the
   coordinated 24-package upgrade/rollback rehearsal.
3. Build a `createCmsMigrationPlan` with the actual site, stage, target, current
   version, target version, and contiguous migration IDs.
4. Present the plan and its generated apply/rollback confirmation strings to the
   operator. Do not auto-confirm them.
5. Supply a provider driver that inspects the live version, creates an immutable
   backup, applies one step, verifies the version, and restores only the receipt-
   bound backup.
6. Run the plan on an isolated restored database first, then staging. Smoke
   login, draft isolation, publish, restore, media, redirects, sitemap, and lead
   delivery.
7. Create a fresh production backup before the production migration. Persist the
   returned migration receipt outside the deployment filesystem.

If execution throws `CmsCliMigrationExecutionError`, stop writes and retain its
`recovery` value. Do not improvise forward SQL. Diagnose against an isolated copy;
then either resume with a reviewed release or call `rollbackCmsMigration` using
the exact plan, recovery point, backup driver, and rollback confirmation.

Rollback is complete only after the restored schema version, package version,
draft, published revision pointer, revision count, media metadata/object bytes,
and public smoke tests all match the pre-migration evidence.

## 4. Incident handling

Follow `docs/agency-operations-runbook.md` for the client runtime. For a Platform
Kit incident, additionally record:

- site ID, stage, deployed commit, coordinated package version, provider schema,
  and migration receipt ID/hash;
- affected capability and whether public reads, admin writes, or background jobs
  must be disabled;
- the first bad version and last known good version;
- whether the issue reproduces in the independent consumer or only the client
  adapter/template.

Never put secrets, raw customer form payloads, registry tokens, or backup bytes
in an incident ticket. A core fix must be released as a coordinated package
version and consumed through the normal upgrade path. Copying a patch into one
client repository does not close a Platform Kit incident.

## 5. Client handover

Use `docs/client-manual-vi.md` for editor training and
`docs/pilot-handover-script.md` for the observed pilot. Handover requires:

- named owner/admin/editor accounts with least privilege;
- verified preview, publish, restore, media, SEO, redirect, lead, and sitemap
  workflows;
- documented backup/restore ownership and incident contact route;
- removal of bootstrap passwords and confirmation that client users cannot see
  infrastructure or registry credentials;
- a signed scope statement identifying which fields are client-editable and
  which layout/animation changes remain agency work.

Record real human timings and approval in release evidence. Do not pre-fill or
self-attest a non-developer pilot.

## 6. Commercial support boundary

The default commercial boundary has three phases. A signed client agreement may
increase service, but must not silently reduce security or recovery gates.

| Phase                                         | Included                                                                                                                          | Excluded                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Delivery                                      | Installation, configured template, staging/production launch, one handover session, and release evidence                          | Unbounded redesign, custom integrations not named in scope, content entry beyond the agreed seed          |
| Stabilization (30 calendar days after launch) | Regressions in delivered workflows, security defects, failed documented migration/rollback, and one refresher handover            | New blocks, new provider, campaign work, client-caused credential/domain changes                          |
| Maintenance retainer                          | Supported-version upgrades, dependency/security review, backup/alert review, incident triage, and agreed content/template changes | Unsupported forks, direct database edits, copied core patches, third-party outages outside agency control |

Baseline service targets during the client's contracted support window:

- P0 public outage, draft leak, data loss, or credential exposure: acknowledge
  within 1 business hour; contain first, then recover from verified evidence.
- P1 blocked publish/admin critical path with public site available: acknowledge
  within 4 business hours.
- P2 non-critical defect or support request: acknowledge within 2 business days.

These are response targets, not guaranteed resolution times. No on-call coverage
exists outside the signed support window unless the agreement explicitly adds it.

## 7. Version and deprecation policy

- `0.x` is private preview: coordinated breaking changes are allowed only with a
  compatibility-matrix update, migration notes, and tested rollback.
- Stable `1.x` keeps public APIs for at least 90 days after a deprecation notice
  and one minor release. Critical security removals may be faster and must carry
  an incident/release note.
- Support covers the current minor and the immediately previous minor. Older
  clients must upgrade or purchase an explicitly scoped extended-support window.
- Provider schema changes are additive first. Destructive cleanup occurs only in
  a later release after every supported consumer has migrated and rollback no
  longer depends on the old shape.
- A release is not stable until two independent paid sites consume the same core
  version and receive a core fix through upgrade rather than copied source.

## 8. Stable Platform Kit evidence

Do not reuse the Rèm Việt client-ready record as the Platform Kit product
record. Publish and verify one coordinated starting version and the target
`1.0.0` version through the guarded private-registry workflow. Preserve both
publication receipts under `docs/releases/evidence/`.

For each of at least two paid client repositories, complete
`docs/releases/cms-kit-adoption.template.json` after the target upgrade and
client-owner review. Store only opaque SHA-256 fingerprints for the private
repository and off-repo paid-engagement/support evidence. The receipt must prove
clean public-export installation, provider conformance, production-like restore,
reusable admin workflow, handover, absence/presence of the same named core fix,
and no copied package patch.

Assemble `docs/releases/evidence/cms-kit-v1.0.0.json` from the final template and
run `bun run cms:kit:v1:verify`. The verifier requires unique site, repository,
and origin identities, exact publication/adoption digests and chronology, a
changelog-bound fix, client-owner approvals, agency-owner commercial approval,
strict source/evidence Git ancestry, and zero non-evidence source drift after
the target publication. `--validate-only` is shape inspection, not approval.
