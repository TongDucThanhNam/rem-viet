# CMS security review — v1 candidate

Review date: 2026-08-21

Disposition: local controls and automated evidence pass; deployment and human
launch evidence listed below remains open.

## Authentication, authorization, and mutation integrity

- Public sign-up is disabled. Production trusted origins must be explicit HTTPS
  values, and Better Auth owns authentication rate limiting and session cookies.
- Owner and Admin accounts must enroll MFA. Staff creation, role changes,
  revocation, API-key administration, and security-log access are capability
  gated at the server. Self, bootstrap, and last-owner protections prevent
  lockout.
- API keys are stored as digests, have explicit scopes and expiry, support
  overlap-safe rotation and revocation, never appear in list responses, and
  create audit events.
- Every draft/read/write/publish/restore/delete operation is capability gated at
  tRPC or the provider boundary. Editors cannot publish or permanently delete
  media. Destructive actions require UI confirmation and are audited.
- Authenticated unsafe requests are protected by an exact-origin guard. It
  rejects foreign `Origin` values and `Sec-Fetch-Site: cross-site|same-site`
  before tRPC POST, media upload, or legacy session-backed API handlers consume
  the mutation. Cookie-authenticated mutations must also carry an exact
  `Origin`; origin-less server/API-key clients remain supported. Public
  form/order endpoints retain their separate spam, rate, size, and idempotency
  controls.

## Preview, XSS, SSRF, uploads, and secrets

- Preview requires a staff session and a signed, origin-bound preview session.
  Document/version/source claims are checked, tokens are single-use, and stale,
  tampered, replayed, or cross-origin requests fail closed. Preview responses
  are private/no-store and noindex.
- Public loaders resolve immutable published revision pointers only. Optimistic
  version conflicts map to explicit `CONFLICT` responses.
- Rich text is an allowlisted JSON AST rendered through React; arbitrary HTML,
  scripts, CSS, and animation configuration are not persisted. CMS links,
  media sources, and rich-text embeds reject script/data and unsafe
  protocol-relative URLs.
- Outbound webhooks require an exact allowlisted public HTTPS origin. The
  dispatcher rejects loopback, private, link-local, credential-bearing, and
  origin-confused destinations before delivery. Secrets are encrypted at rest;
  delivery signatures include a timestamp and idempotency identity, and stale,
  tampered, or replayed messages are rejected.
- Uploads allow only the configured image MIME types, enforce file and batch
  limits, verify magic bytes, assign server UUID keys, and block deletion while
  referenced. Private DAM delivery uses bounded signed URLs.
- Secrets remain in server bindings/environment only. Integration plans store
  secret _names_, bundle audits reject provider/server code and assigned secret
  values in public output, and logs/audit exports use redacted metadata.
- Lead intake has a 32 KB limit, honeypot, field allowlist, hashed-IP rate
  limit, and idempotency key. Redirects are internal and reject self redirects
  and graph loops.

## Audit and automated evidence

Audit events cover content, settings, menus, media, releases, background jobs,
webhooks, staff governance, API keys, and sensitive authentication outcomes.
Reading or exporting the trail is capability gated.

## Collaboration and privacy boundaries

- Presence and soft locks are advisory and never authorize content access.
  Presence sessions cannot change actors, expire automatically, and are
  bounded. Soft locks use owner/session leases, reject non-owner release, and
  permit takeover only after expiry. The server must bind the authenticated
  actor before calling either store.
- Comments have bounded bodies and explicit actor-ID mentions. A mention is not
  interpreted as authorization. Resolved threads reject replies. Activity uses
  bounded summaries rather than field values or comment bodies.
- Realtime is an adapter, not a trusted state store. The in-memory adapter binds
  each event channel to its normalized document target. Production adapters
  must authenticate subscriptions, reauthorize every mutation, and treat
  reconnect/replay delivery as untrusted input.
- The privacy extension declares a server-only entrypoint. PII policies require
  one subject key per collection plus explicit purpose, lawful basis,
  retention, and erase strategy. Subject exports use exact subject-key matches
  and include only classified fields.
- Erasure execution is bound to the reviewed request, subject, policy version,
  and SHA-256 of the exact reviewed plan. Active legal holds take precedence,
  retention blocks early execution, retained fields prevent whole-document
  deletion, and provider calls receive deterministic idempotency keys. The
  storage adapter must still enforce authorization and append value-free
  receipts.
- Redacted audit exports remove actor/document identities, configured PII,
  common secret/contact keys, email values, and bearer credentials. They remain
  sensitive artifacts and must not be committed. License records with missing
  or expired rights block publication in the module report.

Evidence executed locally on 2026-08-21:

```text
bun run audit:security                                  PASS
  1,332 packages; 0 high/critical; 8 below threshold

Focused auth/API/webhook/preview/upload/Sanity matrix   81 pass / 0 fail
mutation-request-security.test.ts                       4 pass / 0 fail
apps/web: bun run check-types                           PASS
apps/web: bun run build                                 PASS
packed clean-consumer provider/bundle verification     PASS
collaboration/privacy typechecks and contract suites   10 pass / 0 fail
bun run check-types                                     PASS (34 tasks)
bun run test                                            PASS (full aggregate)
```

The same-origin unit suite proves exact-origin acceptance; foreign, opaque,
cross-site, and sibling-site rejection; and compatibility with safe reads and
origin-less server clients. The focused matrix proves API-key digest/scope/
expiry/rotation/revocation, MFA role checks, webhook destination and signature
rules, preview tamper/stale/replay rejection, magic-byte spoof rejection, and
signed Sanity preview/webhook behavior. See
`docs/dependency-security-audit.md` for the dated dependency disposition.

## Open launch evidence

These are not satisfied by local tests and must be retained per deployment:

1. Rotate real secrets; verify Cloudflare access policies, log retention,
   backup access, and redaction on the target account.
2. Confirm auth, lead, API-key, and webhook rate-limit behavior at the real edge
   and exercise signed-webhook retry/deduplication against the deployed origin.
3. Run the authenticated desktop and real mobile Playwright projects, keyboard
   task flows, automated accessibility scan, and manual screen-reader spot
   check on staging.
4. Run preview activation/replay and upload-spoof probes against staging without
   retaining credentials or private payloads in the receipt.
5. Complete an independent security review and record remediation or explicit
   risk acceptance before production launch.
6. Exercise authenticated concurrent editors, transport disconnect/replay, and
   lock-expiry recovery on staging; retain only content-free results.
7. Run a client-approved export/erase/retention/legal-hold drill with synthetic
   subjects and verify that no personal payload reaches logs or evidence.

Until those receipts exist, this document is a local release-candidate review,
not production security approval.
