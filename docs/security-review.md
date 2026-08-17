# CMS security review — v1 candidate

- Public sign-up disabled; production trusted origins require HTTPS env values.
- Every draft/read/write/publish/restore/delete mutation is capability-gated at
  tRPC/server. Editor cannot publish or permanently delete media.
- Staff creation, role changes and revocation are Owner-only at the server;
  self, bootstrap and last-owner protections prevent lockout.
- Preview requires staff session, no public query bypass, and sends noindex plus
  private/no-store headers.
- Public loaders resolve immutable revision pointers only.
- Optimistic version conflicts map to explicit `CONFLICT`.
- Upload accepts five image MIME types, limits file/batch size, checks magic
  bytes, uses server UUID keys and blocks referenced deletion.
- Rich text is an allowlisted JSON AST rendered through React; no arbitrary HTML,
  script, CSS or GSAP config.
- Lead endpoint has 32 KB limit, honeypot, field allowlist, hashed IP rate limit
  and idempotency key. Internal notes never appear public.
- Redirect targets are internal; self redirects and graph loops are rejected.
- CMS links, media sources and rich-text embeds reject script/data and unsafe
  protocol-relative URLs before persistence.
- Audit events cover content, settings, menus, media, staff governance and
  sensitive authentication outcomes; reading the audit trail is capability
  gated.
- Secrets live only in Worker bindings/env, never manifest, client bundle or logs.
- Destructive content actions are confirmed in UI and audited.
- Better Auth is pinned to `1.6.27`; Cloudflare's `cf-connecting-ip` is the only
  trusted client-IP header for auth rate limiting.
- `bun run quality` starts with `bun audit --audit-level high`. Direct runtime
  and deploy dependencies were upgraded, safe transitive versions are pinned,
  and unused shadcn/jsdom test toolchains were removed. The dated disposition is
  recorded in `docs/dependency-security-audit.md`.

Open launch checks: rotate real secrets, verify Cloudflare access policies and
log retention, confirm edge rate-limit behavior on the real domain, and run the
authenticated E2E suite on the target staging deployment.
