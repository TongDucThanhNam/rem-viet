# Collaboration and privacy operations

Status: provider-neutral `0.1.0` contract  
Packages: `@agency/cms-collaboration`, `@agency/cms-module-privacy`

This runbook covers the two P2 packages. It does not replace client policy,
legal advice, a data-processing agreement, or a real multi-user staging test.

## Collaboration

The collaboration kernel is deterministic and works offline. A site may connect
its own WebSocket, Durable Object, pub/sub, or hosted realtime service by
implementing `CmsCollaborationRealtimeTransport`; transport delivery is an
acceleration path, not the source of truth.

Use one authenticated session identifier per browser session. Call presence
`heartbeat()` only after the server has bound that session to the actor. The
memory store refuses actor changes for an existing session and automatically
expires stale entries. Presence is advisory and must never grant authorization.

Acquire a soft lock at document, field, or block scope before editing. Locks are
leases, not durable ownership: another session may reclaim them only after
expiry. A blocked claim returns the current owner without mutating it. Release
requires the same actor and session. Persisting implementations must preserve
those compare-and-set semantics.

Inline comment anchors contain collection, document, optional locale, field
path, and block ID. Mentions are explicit actor IDs; do not infer permissions or
send notifications from untrusted `@text`. Resolved threads reject replies until
they are reopened. Apply normal `content.write` authorization before any comment
mutation and `audit.read` before activity access.

`mergeCmsCollaborationFields()` performs a bounded three-way merge and retains
the current value for unresolved conflicts. Never publish while `clean` is
false. Render `diffCmsCollaborationFieldBlocks()` results for the reviewer; block
IDs must be stable and unique for move/change evidence to be meaningful.

The activity feed accepts bounded summaries only. Do not place field values,
comment bodies, tokens, email addresses, or raw transport payloads in summaries.
Export comments and permitted activity during uninstall handover, then delete
comments, activity, presence, and locks.

## Privacy policy

Define one subject-key field per classified collection. Every PII rule declares
classification, purpose, lawful basis, retention days, and erasure strategy.
Policy versions are immutable operating inputs: create a new version rather than
silently changing the rules used by an existing request.

Consent is append-only. A withdrawal is a new record, not an update to the grant.
Store proof that is necessary and proportionate; never put passwords, session
tokens, full payment data, or unrelated form payloads into consent proof.

## Subject export

1. Authenticate the requester and record the verification method outside the
   export body.
2. Create a unique request ID and select the reviewed policy version.
3. Read candidate records through the site provider; the module selects records
   whose configured subject key exactly matches the subject ID.
4. Generate `exportCmsSubjectData()` on the server.
5. Deliver through a short-lived authenticated channel. Do not commit the JSON,
   copy it into release evidence, or send it through ordinary logs/email.
6. Record only the request ID, policy version, aggregate record count, completion
   time, and approved delivery receipt in audit evidence.

## Erasure, retention, and legal holds

Generate a fresh `planCmsSubjectErasure()` immediately before execution. Legal
holds take precedence over erasure. Retention blocks a record until the latest
configured field deadline. A `retain` field prevents whole-document deletion;
eligible non-retained fields are redacted instead.

Review the exact subject ID, request ID, policy version, ready items, blocked
items, and legal-hold IDs. Store the SHA-256 returned by
`fingerprintCmsSubjectErasurePlan()` with that review. Dispatch only with the
same expected subject, policy version, and review fingerprint.
`executeCmsSubjectErasurePlan()` rechecks all three bindings before any provider
call and gives each call a deterministic idempotency key. The provider adapter
must make delete/redact idempotent and append a receipt without copying erased
values.

Never deactivate or shorten a legal hold merely to make a request executable.
Release/expiry requires the client's authorized policy owner and must remain in
the legal-hold history.

## Audit and asset licenses

Use `exportRedactedCmsPrivacyAudit()` for handover or review exports. It removes
actor/document identities, configured PII fields, common secret/contact keys,
email values, and bearer credentials. Treat the result as sensitive despite
redaction; custom application metadata may require an additional client rule.

Run `inspectCmsAssetLicenseExpiry()` before publication and handover. Missing or
expired rights block publication; expiring rights create a review task. The
earliest license or usage deadline wins.

## Handover

Select `client-basic`, `client-standard`, or `client-regulated` with the client
policy owner. Complete every required artifact in the generated checklist,
including consent/request/hold registers, a redacted audit export where
required, and the asset-license report. Transfer personal-data exports through
client-approved encrypted storage, separately from the content repository and
CMS release bundle.

Local verification:

```bash
bun --cwd packages/cms-collaboration check-types
bun --cwd packages/cms-collaboration test
bun --cwd packages/cms-module-privacy check-types
bun --cwd packages/cms-module-privacy test
bun test scripts/cms-kit-boundaries.test.ts scripts/cms-kit-release-lib.test.ts
```

Still-required external evidence: concurrent authenticated editors on staging,
transport reconnect/partition behavior, a client-approved policy version, an
observed export/erase/hold drill using non-production test subjects, and signed
handover acceptance.
