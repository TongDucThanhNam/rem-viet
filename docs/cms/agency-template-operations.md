# Agency template operations

This is the local operating sequence for a template built with
`@agency/cms-template-factory`. It does not authorize deployment, registry
publication or production mutation.

## Create and check

Use `createCmsAgencyWorkflowPlan()` to resolve `create` or `check` for the exact
site ID. Generate the manifest, versioned theme tokens, asset contract, content
seed and handover list through the template bootstrap API. Review every path and
tenant/resource name before applying a non-destructive file plan.

For Atelier, `createAtelierBootstrapPlan()` is the executable example. For Rèm,
the compatibility bootstrap remains supported. Do not copy either package's
source into a client repository.

## Add and migrate

Use the `add-block` workflow/CLI to scaffold a template-owned block, then perform
the explicit registry integration described in the extension guide. Before a
schema increase, create a backup plan, validate every contiguous migration on
fixtures, dry-run the provider migration, and retain separate success and
recovery paths. Never overwrite receipts or improvise rollback without the
matching backup identity.

## Seed, develop and build

Seed only into the manifest's isolated site/provider resources. Run local
provider conformance, template tests, typecheck, secure build and browser
lifecycle at desktop/tablet/mobile sizes. Verify keyboard composition, axe,
stored-content sanitization, autosave refresh recovery and two-tab conflicts.

## Deploy and backup

`deploy` plans are marked remote mutations. They require separate explicit user
authorization, provider preflight, exact origin/resource confirmation and the
repository's guarded deployment command. This milestone does not execute them.
Run backup before a real migration and verify an isolated restore before relying
on it as operational evidence.

## Handover

Use the generated handover checklist to review content, roles, media/alt policy,
preview/publish/revision restore, backups and support boundaries. Paid-client
reuse and unassisted human usability remain external evidence until real signed
or observed receipts exist.

Coordinated package upgrades install one exact version across all eleven private
artifacts. The clean-consumer and N-to-N+1-to-N rehearsals are mandatory before
preparing a private release; no public publication is implied by a passing local
rehearsal.
