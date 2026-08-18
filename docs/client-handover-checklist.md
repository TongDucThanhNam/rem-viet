# Rèm Việt client handover checklist

Use this checklist only after the exact clean staging commit has passed root
quality and the post-deploy plan is fully converged. It prepares a handover; it
does not replace the non-developer pilot or final release verifier.

## Before the session

- [ ] Confirm the staging origin, site ID, full deployment commit, deploy-input
      SHA-256, and `sourceState=clean` from `/api/health`.
- [ ] Confirm `release:readiness` names no unknown local technical gap. Keep all
      external gaps visible; do not present the site as client-ready yet.
- [ ] Verify the Owner, Admin, and Editor accounts are stored in the client's
      password manager. Remove every bootstrap password from private env files.
- [ ] Verify public signup is disabled and each person has only the intended
      server-issued role.
- [ ] Confirm a current staging backup restores in isolation and identify the
      agency operator responsible for production backup/restore.
- [ ] Prepare unique, non-personal pilot copy and images. Do not use real lead
      details or customer personal data in the exercise.
- [ ] Open `docs/client-manual-vi.md`; the observer may point to the manual but
      must not coach the pilot tasks.

## Client capabilities to demonstrate

- [ ] Sign in, identify the active role, and find dashboard help/search.
- [ ] Edit homepage copy, select media with reviewed alt text, add an FAQ, and
      reorder an allowed section without JSON or code.
- [ ] Compare desktop/mobile working-copy previews and confirm the public page
      remains on the immutable published revision.
- [ ] Save/request review, approve with an Admin/Owner, publish, inspect history,
      restore to draft, and republish.
- [ ] Create a standard page, change a published slug with a 301 redirect, and
      verify both old and new URLs.
- [ ] Create a structured post using heading, list, safe link, image, and video;
      confirm pasted rich text contains no uncontrolled styling.
- [ ] Submit a synthetic contact lead once, update its inbox state/note, and
      export CSV without exposing the row publicly.
- [ ] Attempt to delete referenced media and confirm normal deletion is blocked.
- [ ] Show where performance/readiness, audit, staff, backup responsibility, and
      incident escalation live; explain which actions require Owner/agency help.

## Acceptance and evidence

- [ ] Run the bounded script in `docs/pilot-handover-script.md` with a
      non-developer. Total elapsed time is at most 30 minutes; revision restore
      is at most 5 minutes; no developer intervention is allowed.
- [ ] Record only task durations, browser/device, issue IDs, bounded confusion
      notes, deployment commit/hash, and approval timestamps in
      `docs/releases/pilot-evidence.template.json`.
- [ ] Exclude credentials, emails, phone numbers, form content, private URLs,
      database/resource IDs, tokens, cookies, and raw provider/browser logs.
- [ ] Tester approval occurs after the run; observer recording occurs after the
      approval. The agency owner must be a different person and approves only
      after every release gate exists.
- [ ] `release:pilot:verify` passes against the live deployment. A failed or
      interrupted pilot remains an open gate and is not edited into a pass.

## Operational handoff

- [ ] Provide the client with the Vietnamese manual and named agency support
      contacts, support hours, incident severity rules, and escalation channel.
- [ ] Confirm who owns domain/DNS, Cloudflare, email delivery, billing, backups,
      monitoring, content approval, and staff access reviews.
- [ ] Confirm 365-day immutable backup policy, weekly schedule, restore drill
      cadence, lead-retention policy, and security/dependency review cadence.
- [ ] Record the production maintenance window, rollback decision owner, and the
      exact stop conditions from the Track A staging release procedure.
- [ ] Do not create `v1.0.0-client-ready` until `release:readiness` and
      `release:verify` both pass from the exact clean release commit.
