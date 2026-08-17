# ADR 0003: Preview security

- Status: Accepted for implementation in M4
- Date: 2026-08-13

## Decision

- Preview is a dedicated server route, not `?draft=true` on a public loader.
- Same-origin admin preview uses the authenticated staff session.
- Shareable preview, when implemented, uses a single-purpose signed token with
  document id, revision/version, audience and short expiry.
- Preview responses always include `X-Robots-Tag: noindex, nofollow` and
  `Cache-Control: private, no-store`.
- Preview and public render through the same theme components; only the content
  source differs.
- Logout, token expiry, role removal or document deletion immediately prevents
  subsequent preview reads.

Long-lived secrets, draft payloads and capability names must not appear in a
preview URL or client bundle.
