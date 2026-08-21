# `@agency/cms-cli`

Callable, filesystem-port-based CMS project operations plus the packaged
`agency-cms` executable. Version `0.1.0` provides idempotent init plans, safe
block scaffolds, ordered content migrations, artifact/resource verification,
and production-safe release migration orchestration.

## Add to an existing TanStack Start app

Run the integration from the existing app root:

```bash
bunx --bun @agency/cms-cli add \
  --framework=tanstack-start \
  --provider=<provider-id> \
  --dry-run
bunx --bun @agency/cms-cli add \
  --framework=tanstack-start \
  --provider=<provider-id>
bun run cms:diagnose
```

`add` first verifies the TanStack package and file-route root. It only adds
missing package entries and creates new CMS-owned files. A write-ahead receipt
at `.agency-cms/integration.receipt.json` records the exact package entries and
SHA-256 of every managed file, so an interrupted command can be rerun safely.
Existing divergent files and package scripts fail closed.
When package dependencies are missing, `add` runs `bun install` as part of the
same command. Automated or offline workflows may opt out explicitly with
`--skip-install` and install the reviewed package changes themselves.

Provider-specific routes, bindings, migrations, and diagnostics come from the
selected provider package's versioned `./integration` export. Generated REST
routes remain fail-closed until the application supplies the binding and actor
resolver required by that provider. Run `diagnose` to see separate framework,
package, generated-file, authentication, and provider-binding checks.

Removal is reviewable and refuses to delete a generated file or package entry
that the consumer changed after installation:

```bash
bunx --bun @agency/cms-cli remove --dry-run
bunx --bun @agency/cms-cli remove
```

Consumer-owned package entries added after CMS installation are preserved.

```bash
bunx --bun @agency/cms-cli --help
bunx --bun @agency/cms-cli plan-init \
  --template=@agency/template-showcase/bootstrap \
  --site=acme --name="Acme Studio" --site-url=https://acme.example \
  --preset=showcase --provider=edge-native --features=blog,leads,media \
  --output=plans/site-init.json --dry-run
bunx --bun @agency/cms-cli plan-init \
  --template=@agency/template-showcase/bootstrap \
  --site=acme --name="Acme Studio" --site-url=https://acme.example \
  --preset=showcase --provider=edge-native --features=blog,leads,media \
  --output=plans/site-init.json
bunx --bun @agency/cms-cli init --plan=plans/site-init.json --dry-run
bunx --bun @agency/cms-cli add-block \
  --site=acme --type=testimonialGrid --directory=src/blocks
bunx --bun @agency/cms-cli verify --spec=plans/site-verify.json
```

The init plan and verification spec are versioned JSON owned by the selected
template/client repository. This keeps provider configuration and branded
defaults outside the neutral package while giving every client the same
non-destructive command engine. Paths must stay inside the invocation directory;
unknown options, unsafe paths, divergent generated files and existing receipts
fail closed.

New consumers should produce schema-v2 init plans with
`createCmsSiteBootstrapPlan`. The plan contains exactly one `json-exact`
`site.manifest.json`, binds it to `cmsSiteManifestSchema`, requires its ID to
match the requested site, and lists secret names without their values. The
binary reports `missingSecrets` by comparing that checklist with its process
environment. Schema-v1 init plans remain readable only as an additive migration
window for existing repository wrappers; they do not prove canonical manifest
validation.

`plan-init` closes the clean-repository bootstrap loop without embedding branded
defaults in the CLI. It loads an explicitly selected installed package subpath
or `./` repository-local module exporting `cmsTemplateInitializer`. The
initializer identity and exact semantic version must match the generated
manifest, and the plan must match every requested site/provider/preset/locale
input. Dry-run prints the full reviewable plan without writing; apply creates
only the plan file, never the site. Repeating an identical command returns
`unchanged`; a divergent existing plan fails closed. Review that file before
running `init`.

`add-block` generates a complete template-owned vertical slice rather than a
renderer-only placeholder:

```text
src/blocks/testimonialGrid/
├── contract.ts            # versioned neutral block envelope + data schema
├── defaults.ts            # registry default
├── migrations.ts          # contiguous schema migration entry point
├── seed.ts                # fresh-ID seed factory
├── renderer.tsx           # cms-react renderer contract
├── editor.tsx             # cms-admin editor contract
├── registry.ts            # typed renderer/editor definitions
├── index.ts               # public block exports
├── block.manifest.json    # machine-readable artifact map
└── REGISTER.md            # template-union, registry, seed, and upgrade steps
```

Generated template code imports `zod`, React, `@agency/cms-core`,
`@agency/cms-react`, and `@agency/cms-admin`; the consuming template must declare
those as direct dependencies. Registry composition stays an explicit template
edit because silently rewriting an arbitrary application registry would be
unsafe. Re-running the command is idempotent, while any divergence in generated
code fails rather than overwriting client work.

Release migrations use a project-owned driver module that exports
`migrationDriver` (or a default export) with `inspectVersion`, `createBackup`,
`applyStep` and `restoreBackup`. The executable requires the plan's exact apply
or rollback confirmation. It validates a backup before the first mutation,
checks every observed version, writes a success receipt exclusively, and writes
the recovery point to the caller-selected recovery path if an apply fails.

```bash
bunx --bun @agency/cms-cli migrate \
  --plan=plans/migration.json \
  --driver=ops/migration-driver.ts \
  --receipt=evidence/migration.json \
  --recovery=evidence/migration-recovery.json \
  --confirm="APPLY CMS MIGRATION ..."

bunx --bun @agency/cms-cli rollback \
  --plan=plans/migration.json \
  --driver=ops/migration-driver.ts \
  --recovery=evidence/migration.json \
  --receipt=evidence/rollback.json \
  --confirm="ROLLBACK CMS MIGRATION ..."
```

The TypeScript API remains the source of truth. Repository scripts may remain
thin adapters for template-specific plan generation and provider-specific
drivers; they must not duplicate migration safety semantics.
