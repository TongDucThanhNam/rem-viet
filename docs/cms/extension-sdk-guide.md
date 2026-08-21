# Agency CMS extension SDK guide

Status: public `0.1.x` contract; extension execution remains developer-owned.

The extension SDK is exported from `@agency/cms-core`. It adds a signed package
and lifecycle boundary around the lower-level `defineFeatureModule()` registry.
The feature registry composes hooks, collections, permissions, migrations, and
admin contributions at runtime. The package lifecycle decides whether a
specific artifact may be installed, enabled, upgraded, rolled back, or removed.

Editors cannot upload or execute extension code. An agency engineer selects a
reviewed package, verifies its provenance, and runs lifecycle operations through
a provider transaction after server-side authorization.

## 1. Declare the complete boundary

Create one `CmsExtensionPackageManifest` in the extension package. The manifest
must declare:

- exact extension ID, package name, version, and CMS compatibility interval;
- `official`, `private`, or `community` classification;
- every requested CMS capability and permission rationale;
- server-only secret _names_—never values;
- routes, HTTP methods, authorization mode, and mutation protection;
- admin slots and their required capabilities;
- every public entrypoint as `server`, `client`, or `shared`;
- contiguous data migrations from schema zero to the current schema; and
- one uninstall policy: `retain`, `delete`, or `export-then-delete`.

```ts
import { defineCmsExtensionPackageManifest } from "@agency/cms-core";

export const exampleManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/example",
  packageName: "@agency/cms-extension-example",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/example/manage",
      capability: "settings.manage",
      description: "Manage example settings.",
    },
  ],
  secrets: [
    {
      name: "CMS_EXAMPLE_SECRET",
      required: true,
      exposure: "server-only",
      description: "Sign outbound example deliveries.",
    },
  ],
  routes: [
    {
      id: "official/example/webhook",
      path: "/api/cms/example/webhook",
      methods: ["POST"],
      authorization: "signature",
      mutationProtection: "signature",
    },
  ],
  admin: [
    {
      id: "official/example/settings",
      slot: "root",
      label: "Example",
      requiredCapability: "settings.manage",
    },
  ],
  entrypoints: [
    {
      id: "official/example/client",
      export: "./client",
      runtime: "client",
      capabilities: [],
    },
    {
      id: "official/example/server",
      export: "./server",
      runtime: "server",
      capabilities: ["settings.manage"],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      {
        id: "official/example/v1",
        from: 0,
        to: 1,
        reversible: true,
      },
    ],
    uninstall: {
      policy: "retain",
      description: "Retain settings until an explicit purge migration.",
    },
  },
});
```

Manifest validation rejects duplicate IDs, duplicate methods, unprotected
mutation routes, invalid compatibility ranges, non-contiguous migrations, and a
declared schema version that does not match the migration chain.

## 2. Verify artifact provenance before loading code

`verifyCmsExtensionPackage()` binds four inputs:

1. the canonical manifest SHA-256;
2. the packed artifact SHA-256;
3. an SPDX or CycloneDX JSON SBOM SHA-256 that identifies the exact package and
   version; and
4. an Ed25519 signature from a host-trusted key ID over the canonical unsigned
   provenance envelope.

The host may use `createCmsExtensionEd25519Verifier()` with a map of trusted key
IDs to Web Crypto public keys (or raw Ed25519 public-key bytes), or supply its
own `verifySignature` adapter. Key discovery and rotation belong to the private
registry or deployment platform. Do not trust a public key bundled inside the
extension it is supposed to authenticate. Do not import the package entrypoint
before verification returns a `CmsVerifiedExtensionPackage`.

Preparation hashes are not signatures. A release may be installed only after
the publisher or registry has emitted an SBOM and signed envelope, and the host
has verified the signer against its own trust policy.

## 3. Diagnose compatibility and client boundaries

Call `inspectCmsExtensionCompatibility()` with the running CMS version, provider
capabilities, and configured server-secret names. It returns explicit missing
capabilities, missing secrets, and version reasons. A missing requirement must
hide or disable the feature; it must not silently fall back.

Call `assertCmsExtensionClientBoundary()` during every client build. Supply the
extension entrypoint IDs included by the bundle audit, environment names found
in the public output, and capabilities requested by those entrypoints. The gate
rejects:

- undeclared entrypoints;
- server entrypoints in a client bundle;
- any declared server-secret name in public output; and
- client capability use not declared by the selected client/shared entrypoint.

This is a metadata and bundle-evidence boundary, not a JavaScript sandbox.
Arbitrary third-party code still executes with the permissions of its runtime.
Community packages therefore require source review, pinned hashes, restricted
credentials, and an isolated staging rehearsal before approval.

## 4. Execute lifecycle operations transactionally

Create a provider `CmsExtensionLifecycleDriver`. Its `transaction()` must lock
one extension ID and atomically cover lifecycle state plus all migration/data
effects exposed through its context. If a migration throws, the provider must
roll back both extension data and installation state.

Use `createCmsExtensionLifecycleManager()` for:

- idempotent first install;
- forward-only normal upgrades;
- enable and disable without losing data;
- receipt-bound rollback of a specific upgrade using reversible `down` steps;
- exact-artifact uninstall; and
- enforced retain/delete/export-then-delete policy.

An ordinary install cannot downgrade a version or schema. Rollback requires the
original upgrade receipt and refuses to run if the installed version, manifest
hash, or schema has drifted. `export-then-delete` must produce a non-empty export
receipt before deletion and state removal.

Lifecycle methods do not authorize the caller. The server route or CLI invoking
them must require an agency operator/owner capability, confirmation for
destructive operations, and an audit event containing only redacted metadata.

## 5. Run the compatibility test kit

Use `runCmsExtensionLifecycleConformance()` with a disposable provider driver.
When `previous` is supplied, it proves:

```text
install previous → upgrade candidate → rollback candidate
→ reinstall candidate → repeat idempotently → disable → enable → uninstall
```

The driver must point to isolated test storage. The runner is intentionally
destructive and must never receive production state. Retain the test report,
packed artifact/SBOM hashes, and provider identity in release evidence.

Also test the extension's feature-module hooks, admin contribution rendering,
route authorization, migrations against representative data, client boundary,
and uninstall data policy. Passing core lifecycle conformance does not prove the
extension's own business behavior.

## 6. Catalog and security policy

`createCmsExtensionCatalog()` provides a deterministic, duplicate-safe catalog
and compatible-entry filter. The initial official registry should contain only
agency-reviewed packages and their signed immutable versions. A community
marketplace is outside the v1 trust boundary.

The coordinated `0.1.0` official catalog contains the eight P1 modules—SEO,
redirects, search, forms, taxonomy/nested documents, import/WordPress,
observability (Sentry/OpenTelemetry bridges), and Cloudflare cache
invalidation—plus the P2 collaboration and privacy/compliance extensions.
Every package declares its permission, runtime boundary, migration, admin
contribution, and uninstall data policy; the packed consumer removes and
reinstalls each package independently before rebuilding the ten-entry catalog.

Required registry policy:

- immutable package versions and SHA-256 values;
- SPDX or CycloneDX SBOM per artifact;
- Ed25519 signer key ID, rotation, revocation, and incident history;
- supported CMS range and deprecation date;
- declared permissions, secrets, routes, and entrypoints;
- migration/rollback and uninstall policy;
- vulnerability-reporting contact and response target; and
- last successful packed-consumer and disposable-driver conformance receipts.

Disabling an extension is the first containment action. Uninstall only after
the declared data policy and rollback impact are understood. A copied source
patch, deep import, unsigned repack, or edited manifest creates a new untrusted
artifact and invalidates the original provenance.
