import { describe, expect, test } from "bun:test";

import {
  assertCmsExtensionClientBoundary,
  canonicalizeCmsExtensionValue,
  createCmsExtensionCatalog,
  createCmsExtensionEd25519Verifier,
  createCmsExtensionLifecycleManager,
  defineCmsExtensionPackageManifest,
  inspectCmsExtensionCompatibility,
  runCmsExtensionLifecycleConformance,
  verifyCmsExtensionPackage,
  type CmsExtensionInstallationState,
  type CmsExtensionLifecycleDriver,
  type CmsExtensionPackage,
  type CmsExtensionPackageManifest,
  type CmsExtensionProvenance,
  type CmsVerifiedExtensionPackage,
} from "../src";

const encoder = new TextEncoder();

async function digest(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString(
    "hex",
  );
}

function manifest(
  input: {
    version?: string;
    schemaVersion?: number;
    uninstall?: "retain" | "delete" | "export-then-delete";
  } = {},
): CmsExtensionPackageManifest {
  const schemaVersion = input.schemaVersion ?? 1;
  return {
    schemaVersion: 1,
    id: "official/example",
    packageName: "@agency/cms-extension-example",
    version: input.version ?? "0.1.0",
    classification: "official",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    permissions: [
      {
        id: "official/example/manage",
        capability: "settings.manage",
        description: "Manage example extension settings.",
      },
    ],
    secrets: [
      {
        name: "CMS_EXAMPLE_SECRET",
        required: true,
        description: "Signs example deliveries.",
        exposure: "server-only",
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
      schemaVersion,
      migrations: Array.from({ length: schemaVersion }, (_, from) => ({
        id: `official/example/v${from + 1}`,
        from,
        to: from + 1,
        reversible: true,
      })),
      uninstall: {
        policy: input.uninstall ?? "retain",
        description: "Follow the declared example data policy.",
      },
    },
  };
}

async function verified(
  value: CmsExtensionPackageManifest,
): Promise<CmsVerifiedExtensionPackage> {
  const parsed = defineCmsExtensionPackageManifest(value);
  const artifact = encoder.encode(`artifact:${parsed.version}`);
  const sbom = encoder.encode(
    JSON.stringify({
      spdxVersion: "SPDX-2.3",
      packages: [{ name: parsed.packageName, versionInfo: parsed.version }],
    }),
  );
  const provenance: CmsExtensionProvenance = {
    schemaVersion: 1,
    subject: {
      packageName: parsed.packageName,
      version: parsed.version,
    },
    manifestSha256: await digest(canonicalizeCmsExtensionValue(parsed)),
    artifactSha256: await digest(artifact),
    sbomSha256: await digest(sbom),
    source: {
      repository: "https://example.test/agency/extensions",
      commit: "a".repeat(40),
    },
    signature: {
      algorithm: "ed25519",
      keyId: "agency-release-2026",
      value: "c2lnbmF0dXJl",
    },
  };
  return verifyCmsExtensionPackage({
    manifest: parsed,
    provenance,
    artifact,
    sbom,
    verifySignature: ({ payload, keyId }) =>
      payload.length > 0 && keyId === "agency-release-2026",
  });
}

type MemoryContext = {
  schema: number;
  dataPresent: boolean;
  exports: string[];
  log: string[];
};

function memoryDriver(initialContext?: Partial<MemoryContext>) {
  let state: CmsExtensionInstallationState | null = null;
  const context: MemoryContext = {
    schema: 0,
    dataPresent: true,
    exports: [],
    log: [],
    ...initialContext,
  };
  const driver: CmsExtensionLifecycleDriver<MemoryContext> = {
    async transaction(_extensionId, run) {
      const stateSnapshot = state ? { ...state } : null;
      const contextSnapshot = structuredClone(context);
      try {
        return await run({
          context,
          getState: () => state,
          setState(next) {
            state = next;
          },
        });
      } catch (error) {
        state = stateSnapshot;
        Object.assign(context, contextSnapshot);
        throw error;
      }
    },
  };
  return { driver, context, state: () => state };
}

function extension(
  verifiedPackage: CmsVerifiedExtensionPackage,
): CmsExtensionPackage<MemoryContext> {
  return {
    verified: verifiedPackage,
    migrations: verifiedPackage.manifest.data.migrations.map((item) => ({
      id: item.id,
      from: item.from,
      to: item.to,
      up({ context }) {
        context.log.push(`up:${item.id}`);
        context.schema = item.to;
      },
      down({ context }) {
        context.log.push(`down:${item.id}`);
        context.schema = item.from;
      },
    })),
    async exportData(context) {
      context.exports.push("export-1");
      return { receiptId: "export-1" };
    },
    deleteData(context) {
      context.dataPresent = false;
    },
  };
}

function manager(driver: CmsExtensionLifecycleDriver<MemoryContext>) {
  let receipt = 0;
  let time = 0;
  return createCmsExtensionLifecycleManager({
    cmsVersion: "0.1.0",
    hostCapabilities: ["settings.manage"],
    configuredSecrets: ["CMS_EXAMPLE_SECRET"],
    driver,
    now: () => new Date(Date.UTC(2026, 7, 21, 0, 0, time++)),
    createReceiptId: () => `receipt-${++receipt}`,
  });
}

describe("CMS extension package manifest and boundary", () => {
  test("validates declarations, protected mutation routes, and contiguous migrations", () => {
    expect(
      defineCmsExtensionPackageManifest(manifest()).data.schemaVersion,
    ).toBe(1);
    expect(() =>
      defineCmsExtensionPackageManifest({
        ...manifest(),
        routes: [
          {
            ...manifest().routes[0]!,
            mutationProtection: "none",
          },
        ],
      }),
    ).toThrow("must declare protection");
    expect(() =>
      defineCmsExtensionPackageManifest({
        ...manifest({ schemaVersion: 2 }),
        data: {
          ...manifest({ schemaVersion: 2 }).data,
          migrations: [
            {
              id: "official/example/v2",
              from: 1,
              to: 2,
              reversible: true,
            },
          ],
        },
      }),
    ).toThrow("not contiguous");
  });

  test("reports host compatibility and enforces client/server/secret boundaries", () => {
    const value = manifest();
    expect(
      inspectCmsExtensionCompatibility({
        manifest: value,
        cmsVersion: "0.1.0",
        hostCapabilities: [],
        configuredSecrets: [],
      }),
    ).toMatchObject({
      compatible: false,
      missingCapabilities: ["settings.manage"],
      missingSecrets: ["CMS_EXAMPLE_SECRET"],
    });
    expect(
      inspectCmsExtensionCompatibility({
        manifest: value,
        cmsVersion: "0.1.0-beta.1",
        hostCapabilities: ["settings.manage"],
        configuredSecrets: ["CMS_EXAMPLE_SECRET"],
      }).compatible,
    ).toBe(false);
    expect(
      assertCmsExtensionClientBoundary({
        manifest: value,
        entrypointIds: ["official/example/client"],
        bundledEnvironmentNames: [],
      }),
    ).toBe(true);
    expect(() =>
      assertCmsExtensionClientBoundary({
        manifest: value,
        entrypointIds: ["official/example/server"],
        bundledEnvironmentNames: [],
      }),
    ).toThrow("Server-only");
    expect(() =>
      assertCmsExtensionClientBoundary({
        manifest: value,
        entrypointIds: ["official/example/client"],
        bundledEnvironmentNames: ["CMS_EXAMPLE_SECRET"],
      }),
    ).toThrow("exposes server-only");
    expect(createCmsExtensionCatalog([value]).get(value.id)?.packageName).toBe(
      value.packageName,
    );
  });
});

describe("CMS extension provenance", () => {
  test("binds a trusted signature to the manifest, artifact, and SBOM", async () => {
    const result = await verified(manifest());
    expect(result.provenance.subject).toEqual({
      packageName: "@agency/cms-extension-example",
      version: "0.1.0",
    });
    const artifact = encoder.encode("tampered");
    const sbom = encoder.encode(
      JSON.stringify({
        packages: [
          {
            name: result.manifest.packageName,
            versionInfo: result.manifest.version,
          },
        ],
      }),
    );
    await expect(
      verifyCmsExtensionPackage({
        manifest: result.manifest,
        provenance: result.provenance,
        artifact,
        sbom,
        verifySignature: () => true,
      }),
    ).rejects.toThrow("does not match");
  });

  test("verifies Ed25519 signatures only against host-trusted key ids", async () => {
    const value = defineCmsExtensionPackageManifest(manifest());
    const artifact = encoder.encode("signed-artifact");
    const sbom = encoder.encode(
      JSON.stringify({
        metadata: {
          component: { name: value.packageName, version: value.version },
        },
      }),
    );
    const unsigned = {
      schemaVersion: 1 as const,
      subject: { packageName: value.packageName, version: value.version },
      manifestSha256: await digest(canonicalizeCmsExtensionValue(value)),
      artifactSha256: await digest(artifact),
      sbomSha256: await digest(sbom),
      source: {
        repository: "https://example.test/agency/extensions",
        commit: "b".repeat(40),
      },
    };
    const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: "Ed25519" },
        keys.privateKey,
        encoder.encode(canonicalizeCmsExtensionValue(unsigned)),
      ),
    ).toString("base64");
    const provenance: CmsExtensionProvenance = {
      ...unsigned,
      signature: {
        algorithm: "ed25519",
        keyId: "trusted-key",
        value: signature,
      },
    };
    const verifier = createCmsExtensionEd25519Verifier({
      trustedKeys: { "trusted-key": keys.publicKey },
    });
    await expect(
      verifyCmsExtensionPackage({
        manifest: value,
        provenance,
        artifact,
        sbom,
        verifySignature: verifier,
      }),
    ).resolves.toMatchObject({ manifestSha256: unsigned.manifestSha256 });
    await expect(
      verifyCmsExtensionPackage({
        manifest: value,
        provenance: {
          ...provenance,
          signature: { ...provenance.signature, keyId: "unknown-key" },
        },
        artifact,
        sbom,
        verifySignature: verifier,
      }),
    ).rejects.toThrow("invalid or untrusted");
  });
});

describe("CMS extension lifecycle", () => {
  test("installs idempotently, upgrades, disables/enables, and rolls back by receipt", async () => {
    const memory = memoryDriver();
    const lifecycle = manager(memory.driver);
    const v1 = extension(await verified(manifest()));
    const installed = await lifecycle.install(v1);
    expect(installed.operation).toBe("install");
    expect(installed.migrationIds).toEqual(["official/example/v1"]);
    expect(memory.state()).toMatchObject({
      version: "0.1.0",
      dataSchemaVersion: 1,
      status: "enabled",
    });
    expect(memory.context.schema).toBe(1);

    const repeated = await lifecycle.install(v1);
    expect(repeated.before).toEqual(repeated.after);
    expect(memory.context.log).toEqual(["up:official/example/v1"]);
    expect(
      (await lifecycle.disable(v1.verified.manifest.id)).after?.status,
    ).toBe("disabled");
    expect(
      (await lifecycle.enable(v1.verified.manifest.id)).after?.status,
    ).toBe("enabled");

    const v2 = extension(
      await verified(manifest({ version: "0.2.0", schemaVersion: 2 })),
    );
    const upgraded = await lifecycle.install(v2);
    expect(upgraded.operation).toBe("upgrade");
    expect(upgraded.migrationIds).toEqual(["official/example/v2"]);
    expect(memory.context.schema).toBe(2);
    expect(memory.state()?.version).toBe("0.2.0");
    await expect(lifecycle.install(v1)).rejects.toThrow(
      "receipt-bound rollback",
    );

    const rolledBack = await lifecycle.rollbackUpgrade(v2, upgraded);
    expect(rolledBack.operation).toBe("rollback");
    expect(rolledBack.migrationIds).toEqual(["official/example/v2"]);
    expect(memory.context.schema).toBe(1);
    expect(memory.state()).toMatchObject({
      version: "0.1.0",
      dataSchemaVersion: 1,
    });
  });

  test("enforces export-then-delete and exact-artifact uninstall", async () => {
    const memory = memoryDriver();
    const lifecycle = manager(memory.driver);
    const candidate = extension(
      await verified(
        manifest({ version: "0.3.0", uninstall: "export-then-delete" }),
      ),
    );
    await lifecycle.install(candidate);
    const receipt = await lifecycle.uninstall(candidate);
    expect(receipt).toMatchObject({
      operation: "uninstall",
      after: null,
      exportReceiptId: "export-1",
    });
    expect(memory.context.exports).toEqual(["export-1"]);
    expect(memory.context.dataPresent).toBe(false);
    expect(memory.state()).toBeNull();
  });

  test("relies on the provider transaction to roll back failed migrations", async () => {
    const memory = memoryDriver();
    const lifecycle = manager(memory.driver);
    const v1 = extension(await verified(manifest()));
    await lifecycle.install(v1);
    const brokenVerified = await verified(
      manifest({ version: "0.2.0", schemaVersion: 2 }),
    );
    const broken = extension(brokenVerified);
    const migrations = broken.migrations.map((item) =>
      item.from === 1
        ? {
            ...item,
            async up({ context }: { context: MemoryContext }) {
              context.schema = 2;
              context.log.push("broken");
              throw new Error("migration crashed");
            },
          }
        : item,
    );
    await expect(lifecycle.install({ ...broken, migrations })).rejects.toThrow(
      "migration crashed",
    );
    expect(memory.state()).toMatchObject({
      version: "0.1.0",
      dataSchemaVersion: 1,
    });
    expect(memory.context.schema).toBe(1);
    expect(memory.context.log).not.toContain("broken");
  });

  test("provides a reusable disposable-driver compatibility kit", async () => {
    const memory = memoryDriver();
    const lifecycle = manager(memory.driver);
    const previous = extension(await verified(manifest()));
    const candidate = extension(
      await verified(
        manifest({
          version: "0.2.0",
          schemaVersion: 2,
          uninstall: "export-then-delete",
        }),
      ),
    );
    const report = await runCmsExtensionLifecycleConformance({
      manager: lifecycle,
      previous,
      candidate,
    });
    expect(report).toMatchObject({
      passed: true,
      extensionId: "official/example",
      version: "0.2.0",
    });
    expect(report.operations).toEqual([
      "install",
      "upgrade",
      "rollback",
      "upgrade",
      "install",
      "disable",
      "enable",
      "uninstall",
    ]);
    expect(memory.state()).toBeNull();
    expect(memory.context.dataPresent).toBe(false);
    expect(memory.context.exports).toEqual(["export-1"]);
  });
});
