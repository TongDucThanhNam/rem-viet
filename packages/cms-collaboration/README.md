# `@agency/cms-collaboration`

Provider-neutral collaboration primitives for Agency CMS: expiring presence,
field/document soft locks, inline comments and explicit mentions, three-way
field merge, field/block visual diffs, a filtered activity feed, and a realtime
transport contract. The in-memory implementations are deterministic and make
the complete kernel testable without a network or external service.

Presence and locks are ephemeral. Comments and activity are personal/editorial
data: export them before uninstalling, then delete all package-owned data.
