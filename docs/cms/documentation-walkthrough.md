# Independent documentation walkthrough

This walkthrough produces the human evidence required by Section 10 of
`perfect-cms-plugin-goal.vi.md`. It must be performed by a person other than the
project owner, from a fresh clone or isolated clean checkout, using only the
checked-in documentation. Automated tests, an AI review, or the project owner
repeating the commands cannot replace this receipt.

## Safety boundary

- Use local fixtures, disposable databases, synthetic content, and packed
  artifacts. Do not use client personal data or production credentials.
- Do not publish packages, mutate production, or require a managed registry.
- The project owner may observe and record issues, but must not supply missing
  commands or operate the terminal for the independent operator.
- Stop and record a failure if the guide requires an undocumented intervention,
  exposes a secret, loses canonical content, or leaves a P0/P1 issue open.
- When a documentation defect is found, fix it normally, commit the remediation,
  and repeat the affected task from a new clean checkout. Do not edit the
  evidence into a pass without rerunning it.

## Required walkthrough

The operator checks out the full documentation commit recorded in the evidence
and completes every area below.

1. **Installation and diagnostics** — Follow
   `platform-kit-operator-guide.md` through the free/self-hosted packed path.
   Exercise dry-run, add, repeated add, diagnose, build, remove dry-run, remove,
   and the post-remove build on a disposable TanStack Start fixture.
2. **Schema and template authoring** — Follow the template authoring section and
   `template-factory-guide.md`. Generate one bounded block, register it through
   public APIs, and run its parser, migration, renderer, editor, and
   accessibility checks.
3. **Editor and client manual** — Use `client-manual-vi.md` to complete a
   synthetic draft, preview, publish, revision restore, media, redirect, and
   lead workflow without opening canonical JSON.
4. **Provider configuration** — Follow the local provider path and inspect the
   Cloudflare/Postgres capability and fail-closed diagnostics. A live paid
   provider is not required for this documentation gate.
5. **Extension lifecycle** — Follow `extension-sdk-guide.md` against disposable
   storage and complete install, enable, disable, uninstall, compatibility, and
   rollback verification without loading arbitrary editor code.
6. **Migration, upgrade, and rollback** — Run the documented clean-checkout
   coordinated migration from schema 1 to 2 and back to 1. Confirm canonical
   content, revisions, media metadata, and receipt-bound recovery survive.
7. **Backup and restore** — Follow `agency-operations-runbook.md` with a local
   backup and isolated restore drill. Confirm integrity, required tables, and
   row-count evidence without overwriting the source database.
8. **Incident response** — Walk through the documented synthetic incident:
   identify the last known good version, contain writes, select the receipt-bound
   recovery path, and prepare a redacted issue record with no secret or content
   payload.
9. **Client handover** — Follow `client-handover-checklist.md` and
   `pilot-handover-script.md` as an operator rehearsal. Do not self-attest the
   separate non-developer pilot.

All nine booleans in the evidence template remain `false` until the corresponding
area has actually passed. Findings may contain only issue IDs, short bounded
summaries, severity, resolved state, and an optional remediation commit. Do not
record credentials, private origins, database identifiers, customer content, or
raw logs.

## Record and verify

Copy the template outside the committed source evidence, fill only real results,
and let the independent operator approve it after the walkthrough completes:

```bash
cp docs/releases/documentation-walkthrough-evidence.template.json \
  docs/releases/documentation-walkthrough-evidence.json

bun run release:docs:verify \
  --evidence=docs/releases/documentation-walkthrough-evidence.json \
  --repository=TongDucThanhNam/rem-viet \
  --commit=<full-documentation-git-sha>
```

On PowerShell, use `Copy-Item` instead of `cp`. The verifier requires exact
repository and commit binding; all required guides at that commit; a different
project owner and operator; a clean independent-checkout declaration; all nine
tasks; zero undocumented intervention and open P0/P1; resolved, unique findings;
valid remediation ancestry; and approval/record timestamps after completion.

Retain the accepted JSON with the release artifacts. Commit only bounded,
reviewed evidence; never commit shell history, provider output, credentials, or
customer data.
