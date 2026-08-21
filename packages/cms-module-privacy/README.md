# `@agency/cms-module-privacy`

The official privacy/compliance module for Agency CMS. It provides bounded PII
field classification, append-only consent records, subject data export and
erasure plans, retention and legal-hold enforcement, redacted audit exports,
asset-license expiry reporting, and client-handover policy templates.

The package is provider-neutral and server-oriented. Storage, erasure, and
delivery are explicit adapters so policy decisions remain deterministic and
offline-testable. Export privacy records before uninstalling, then delete all
package-owned personal data.
