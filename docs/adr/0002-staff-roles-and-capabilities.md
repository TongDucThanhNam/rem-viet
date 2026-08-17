# ADR 0002: Staff roles and server capabilities

- Status: Accepted
- Date: 2026-08-13

## Context

The current admin guard treats every email in `ADMIN_EMAILS` as an unrestricted
admin. The product needs owner/admin/editor behavior that is enforced by the
server, not only by hidden UI controls.

## Decision

Persist one role per Better Auth user in `staff_roles`:

| Capability                 | Owner | Admin | Editor |
| -------------------------- | :---: | :---: | :----: |
| Read drafts                |  Yes  |  Yes  |  Yes   |
| Create/update content      |  Yes  |  Yes  |  Yes   |
| Request editorial review   |  Yes  |  Yes  |  Yes   |
| Decide editorial review    |  Yes  |  Yes  |   No   |
| Publish/unpublish          |  Yes  |  Yes  |   No   |
| Restore revisions          |  Yes  |  Yes  |   No   |
| Permanently delete content |  Yes  |  Yes  |   No   |
| Manage media               |  Yes  |  Yes  |  Yes   |
| Manage site settings       |  Yes  |  Yes  |   No   |
| Read audit events          |  Yes  |  Yes  |   No   |
| Manage staff roles         |  Yes  |  No   |   No   |

`ADMIN_EMAILS` remains a compatibility/bootstrap mechanism. An authenticated
allowlisted user without a `staff_roles` row is treated as `owner`. A persisted
role takes precedence. This prevents a migration from locking out the existing
operator while making future users database-managed.

Every protected content mutation uses a capability procedure. The legacy
`protectedProcedure` remains a staff-only compatibility guard for existing
commerce routes until those routes receive their own capability model.

Editorial review does not borrow write or publish authority. Request, queue,
approval and change-request procedures use the exact `content.review.request`
or `content.review.decide` capability, and the client renders actions from
server-issued capability claims. Publication remains independently authorized.

## Security properties

- No client-provided role is trusted.
- Role lookup uses the authenticated Better Auth user id.
- A denied capability returns `FORBIDDEN`; a missing staff session returns
  `UNAUTHORIZED`.
- Role changes and destructive content actions are audit events.
