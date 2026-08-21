import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const runRoot = join(repositoryRoot, ".tmp", `cms-kit-consumer-${Date.now()}`);
const artifactDirectory = join(runRoot, "artifacts");
const consumerDirectory = join(runRoot, "consumer");

mkdirSync(artifactDirectory, { recursive: true });
cpSync(
  join(repositoryRoot, "fixtures", "cms-kit-clean-consumer"),
  consumerDirectory,
  { recursive: true },
);

const packages = [
  ["cms-core", "agency-cms-core-0.1.0.tgz"],
  ["cms-agency", "agency-cms-agency-0.1.0.tgz"],
  ["cms-collaboration", "agency-cms-collaboration-0.1.0.tgz"],
  ["cms-runtime", "agency-cms-runtime-0.1.0.tgz"],
  [
    "cms-module-cache-cloudflare",
    "agency-cms-module-cache-cloudflare-0.1.0.tgz",
  ],
  ["cms-module-forms", "agency-cms-module-forms-0.1.0.tgz"],
  ["cms-module-import", "agency-cms-module-import-0.1.0.tgz"],
  ["cms-module-observability", "agency-cms-module-observability-0.1.0.tgz"],
  ["cms-module-privacy", "agency-cms-module-privacy-0.1.0.tgz"],
  ["cms-module-redirects", "agency-cms-module-redirects-0.1.0.tgz"],
  ["cms-module-search", "agency-cms-module-search-0.1.0.tgz"],
  ["cms-module-seo", "agency-cms-module-seo-0.1.0.tgz"],
  ["cms-module-taxonomy", "agency-cms-module-taxonomy-0.1.0.tgz"],
  ["cms-provider-cloudflare", "agency-cms-provider-cloudflare-0.1.0.tgz"],
  ["cms-provider-postgres", "agency-cms-provider-postgres-0.1.0.tgz"],
  ["cms-react", "agency-cms-react-0.1.0.tgz"],
  ["cms-admin", "agency-cms-admin-0.1.0.tgz"],
  ["cms-alchemy", "agency-cms-alchemy-0.1.0.tgz"],
  ["cms-cli", "agency-cms-cli-0.1.0.tgz"],
  ["cms-template-atelier", "agency-cms-template-atelier-0.1.0.tgz"],
  ["cms-template-factory", "agency-cms-template-factory-0.1.0.tgz"],
  ["cms-template-rem-viet", "agency-cms-template-rem-viet-0.1.0.tgz"],
  ["cms-visual-editor", "agency-cms-visual-editor-0.1.0.tgz"],
  ["cms-provider-local", "agency-cms-provider-local-0.1.0.tgz"],
] as const;

function run(command: string[], cwd: string) {
  const result = Bun.spawnSync(command, {
    cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  if (!result.success) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
}

function runJson(
  command: string[],
  cwd: string,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: environment,
    stderr: "inherit",
    stdout: "pipe",
  });
  const output = result.stdout.toString();
  process.stdout.write(output);
  if (!result.success) {
    throw new Error(
      `Command failed (${result.exitCode}): ${command.join(" ")}`,
    );
  }
  const value: unknown = JSON.parse(output);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `Command did not return a JSON object: ${command.join(" ")}`,
    );
  }
  return value as Record<string, unknown>;
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

function assertPackedBundleBoundary(
  directory: string,
  unselectedProviders: readonly ("cloudflare" | "local" | "postgres")[],
) {
  const dist = join(directory, "dist");
  const files = filesBelow(dist);
  const allOutput = files.map((path) => readFileSync(path, "utf8")).join("\n");
  for (const forbidden of [
    ...unselectedProviders.map(
      (provider) => `@agency/cms-provider-${provider}`,
    ),
    "@sanity/",
    "SANITY_",
  ]) {
    if (allOutput.includes(forbidden)) {
      throw new Error(
        `Packed output contains unused provider code: ${forbidden}.`,
      );
    }
  }

  const publicEntry = files
    .filter(
      (path) =>
        path.includes(`${join("dist", "client", "assets")}`) &&
        /^index-[^.]+\.js$/.test(basename(path)),
    )
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  if (!publicEntry) {
    throw new Error("Packed output did not contain a public client entry.");
  }
  for (const forbidden of [
    "Content management",
    "CMS_ADMIN_TOKEN",
    "CMS_LOCAL_DATABASE_URL",
    "CMS_POSTGRES_URL",
    "CMS_S3_SECRET_ACCESS_KEY",
    "CMS_DB",
  ]) {
    if (publicEntry.includes(forbidden)) {
      throw new Error(
        `Public client entry contains CMS server/admin code: ${forbidden}.`,
      );
    }
  }
}

for (const [directory] of packages) {
  run(
    ["bun", "pm", "pack", `--destination=${artifactDirectory}`],
    join(repositoryRoot, "packages", directory),
  );
}

const artifactPathFor = (directory: string, filename: string) =>
  `file:${relative(directory, join(artifactDirectory, filename)).replaceAll("\\", "/")}`;
const artifactPath = (filename: string) =>
  artifactPathFor(consumerDirectory, filename);
const artifactFilename = (packageDirectory: (typeof packages)[number][0]) =>
  packages.find(([directory]) => directory === packageDirectory)![1];
const packedArtifact = (packageDirectory: (typeof packages)[number][0]) =>
  artifactPath(artifactFilename(packageDirectory));

function integrationPackageJson(
  directory: string,
  input: {
    name: string;
    provider: "cloudflare" | "local" | "postgres";
    withAuth: boolean;
  },
) {
  const providerDirectory = `cms-provider-${input.provider}` as
    "cms-provider-cloudflare" | "cms-provider-local" | "cms-provider-postgres";
  const packed = (packageDirectory: (typeof packages)[number][0]) =>
    artifactPathFor(directory, artifactFilename(packageDirectory));
  return {
    name: input.name,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite dev",
      build: "vite build",
      "check-types": "tsc --noEmit",
    },
    dependencies: {
      "@agency/cms-cli": packed("cms-cli"),
      "@agency/cms-core": packed("cms-core"),
      [`@agency/cms-provider-${input.provider}`]: packed(providerDirectory),
      "@tanstack/react-router": "^1.168.22",
      "@tanstack/react-start": "^1.167.41",
      ...(input.withAuth ? { "better-auth": "1.6.27" } : {}),
      react: "^19.2.3",
      "react-dom": "^19.2.3",
    },
    devDependencies: {
      "@types/react": "^19.2.14",
      "@types/react-dom": "^19.2.3",
      "@vitejs/plugin-react": "^6.0.1",
      typescript: "^6.0.0",
      vite: "^8.2.1",
    },
    overrides: {
      "@agency/cms-admin": packed("cms-admin"),
      "@agency/cms-core": packed("cms-core"),
      "@agency/cms-runtime": packed("cms-runtime"),
      "@agency/cms-visual-editor": packed("cms-visual-editor"),
    },
  };
}

function verifyTanStackIntegrationFixture(input: {
  fixture: "cms-plugin-clean-tanstack" | "cms-plugin-existing-tanstack";
  expectedReady: boolean;
  preservedFiles: readonly string[];
}) {
  const directory = join(runRoot, input.fixture);
  cpSync(join(repositoryRoot, "fixtures", input.fixture), directory, {
    recursive: true,
  });
  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify(
      {
        ...integrationPackageJson(directory, {
          name: input.fixture,
          provider: "cloudflare",
          withAuth: input.expectedReady,
        }),
      },
      null,
      2,
    )}\n`,
  );
  const preserved = new Map(
    input.preservedFiles.map((path) => [
      path,
      readFileSync(join(directory, path), "utf8"),
    ]),
  );
  run(["bun", "install"], directory);
  const addCommand = [
    "bunx",
    "--bun",
    "agency-cms",
    "add",
    "--framework=tanstack-start",
    "--provider=cloudflare",
  ];
  const dryRun = runJson([...addCommand, "--dry-run"], directory, process.env);
  if (
    dryRun.packageJson !== "would-update" ||
    existsSync(join(directory, ".agency-cms", "integration.receipt.json"))
  ) {
    throw new Error(`${input.fixture} add dry-run mutated the fixture.`);
  }
  const added = runJson(addCommand, directory, process.env);
  const repeated = runJson(addCommand, directory, process.env);
  if (added.packageJson !== "updated" || repeated.packageJson !== "unchanged") {
    throw new Error(`${input.fixture} integration was not idempotent.`);
  }
  for (const [path, source] of preserved) {
    if (readFileSync(join(directory, path), "utf8") !== source) {
      throw new Error(`${input.fixture} replaced consumer file ${path}.`);
    }
  }
  const diagnosis = runJson(
    ["bunx", "--bun", "agency-cms", "diagnose"],
    directory,
    process.env,
  );
  if (diagnosis.ok !== true || diagnosis.ready !== input.expectedReady) {
    throw new Error(`${input.fixture} diagnostics did not match readiness.`);
  }
  run(["bun", "run", "build"], directory);
  assertPackedBundleBoundary(directory, ["local", "postgres"]);
  run(["bun", "run", "check-types"], directory);
  const removeDryRun = runJson(
    ["bunx", "--bun", "agency-cms", "remove", "--dry-run"],
    directory,
    process.env,
  );
  if (
    removeDryRun.packageJson !== "would-update" ||
    !existsSync(join(directory, "src", "cms", "collections.ts"))
  ) {
    throw new Error(`${input.fixture} remove dry-run mutated the fixture.`);
  }
  runJson(["bunx", "--bun", "agency-cms", "remove"], directory, process.env);
  if (
    existsSync(join(directory, ".agency-cms", "integration.receipt.json")) ||
    existsSync(join(directory, "src", "cms", "collections.ts"))
  ) {
    throw new Error(`${input.fixture} uninstall left managed files behind.`);
  }
  for (const [path, source] of preserved) {
    if (readFileSync(join(directory, path), "utf8") !== source) {
      throw new Error(
        `${input.fixture} uninstall changed consumer file ${path}.`,
      );
    }
  }
  run(["bun", "run", "build"], directory);
  assertPackedBundleBoundary(directory, ["cloudflare", "postgres"]);
  run(["bun", "run", "check-types"], directory);
}

const serverOutputLimit = 16_384;

type LocalDevServer = {
  process: ReturnType<typeof Bun.spawn>;
  output: () => string;
  outputDrained: Promise<void>;
  stopOutputMirroring: () => void;
};

function appendServerOutput(current: string, chunk: string) {
  const combined = current + chunk;
  return combined.length <= serverOutputLimit
    ? combined
    : combined.slice(-serverOutputLimit);
}

function serverDiagnostics(server: LocalDevServer) {
  const output = server.output().trim();
  return output || "<the Vite process emitted no output>";
}

async function mirrorServerOutput(
  stream: ReadableStream<Uint8Array>,
  destination: NodeJS.WriteStream,
  capture: (chunk: string) => void,
  shouldMirror: () => boolean,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    const chunk = decoder.decode(result.value, { stream: true });
    if (shouldMirror()) destination.write(chunk);
    capture(chunk);
  }
  const remainder = decoder.decode();
  if (remainder) {
    if (shouldMirror()) destination.write(remainder);
    capture(remainder);
  }
}

function startLocalServer(directory: string, token: string): LocalDevServer {
  let output = "";
  let mirrorOutput = true;
  const server = Bun.spawn(
    [
      "bun",
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "0",
      "--strictPort",
    ],
    {
      cwd: directory,
      env: {
        ...process.env,
        CMS_ADMIN_TOKEN: token,
        CMS_LOCAL_DATABASE_URL: "file:.agency-cms/content.db",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const capture = (chunk: string) => {
    output = appendServerOutput(output, chunk);
  };
  const shouldMirror = () => mirrorOutput;
  const outputDrained = Promise.all([
    mirrorServerOutput(server.stdout, process.stdout, capture, shouldMirror),
    mirrorServerOutput(server.stderr, process.stderr, capture, shouldMirror),
  ]).then(() => undefined);
  return {
    process: server,
    output: () => output,
    outputDrained,
    stopOutputMirroring: () => {
      mirrorOutput = false;
    },
  };
}

async function waitForServer(server: LocalDevServer) {
  const deadline = Date.now() + 30_000;
  let healthUrl: string | undefined;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (server.process.exitCode !== null) {
      await server.outputDrained;
      throw new Error(
        `Local TanStack dev server exited with ${server.process.exitCode}.\n${serverDiagnostics(server)}`,
      );
    }
    const port = server.output().match(/http:\/\/127\.0\.0\.1:(\d+)\//)?.[1];
    healthUrl ??= port ? `http://127.0.0.1:${port}/api/cms/health` : undefined;
    if (!healthUrl) {
      await Bun.sleep(100);
      continue;
    }
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return healthUrl.slice(0, -"/api/cms/health".length);
      lastError = new Error(`Health endpoint returned ${response.status}.`);
    } catch (error) {
      lastError = error;
      // Vite has not opened the listener yet.
    }
    await Bun.sleep(100);
  }
  throw new Error(
    `Timed out waiting for the local TanStack dev server.\n${serverDiagnostics(server)}`,
    { cause: lastError },
  );
}

async function stopServer(server: LocalDevServer) {
  server.stopOutputMirroring();
  server.process.kill();
  await Promise.race([server.process.exited, Bun.sleep(5_000)]);
  if (server.process.exitCode === null) {
    if (process.platform === "win32") {
      Bun.spawnSync(
        ["taskkill", "/PID", String(server.process.pid), "/T", "/F"],
        {
          stdout: "ignore",
          stderr: "ignore",
        },
      );
    } else {
      server.process.kill(9);
    }
    await Promise.race([server.process.exited, Bun.sleep(1_000)]);
  }
  await Promise.race([server.outputDrained, Bun.sleep(1_000)]);
  server.process.unref();
}

async function startReadyLocalServer(directory: string, token: string) {
  const failures: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const server = startLocalServer(directory, token);
    try {
      const origin = await waitForServer(server);
      return { origin, server };
    } catch (error) {
      failures.push(
        `Attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await stopServer(server);
      if (attempt < 2) {
        process.stderr.write(
          `[cms-kit] Local fixture server attempt ${attempt} failed; retrying once.\n`,
        );
      }
    }
  }
  throw new Error(
    `Local TanStack dev server failed after two bounded attempts.\n${failures.join("\n")}`,
  );
}

async function cmsJson(
  origin: string,
  path: string,
  token: string,
  input?: { method?: string; body?: unknown },
) {
  const response = await fetch(`${origin}${path}`, {
    method: input?.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(input?.body === undefined
        ? {}
        : { "content-type": "application/json" }),
    },
    body: input?.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `CMS request failed (${response.status}) ${path}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function verifyLocalTanStackLifecycle() {
  const directory = join(runRoot, "cms-plugin-local-tanstack");
  cpSync(
    join(repositoryRoot, "fixtures", "cms-plugin-clean-tanstack"),
    directory,
    { recursive: true },
  );
  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify(
      integrationPackageJson(directory, {
        name: "cms-plugin-local-tanstack",
        provider: "local",
        withAuth: false,
      }),
      null,
      2,
    )}\n`,
  );
  run(["bun", "install"], directory);
  const added = runJson(
    [
      "bunx",
      "--bun",
      "agency-cms",
      "add",
      "--framework=tanstack-start",
      "--provider=local",
    ],
    directory,
    process.env,
  );
  if (added.install !== "completed") {
    throw new Error(
      "Local integration did not install its packed dependencies.",
    );
  }
  const token = "packed-local-proof-token-32-characters";
  const diagnosis = runJson(
    ["bunx", "--bun", "agency-cms", "diagnose"],
    directory,
    { ...process.env, CMS_ADMIN_TOKEN: token },
  );
  if (diagnosis.ready !== true) {
    throw new Error("Local integration diagnostics did not become ready.");
  }
  run(["bun", "run", "build"], directory);
  assertPackedBundleBoundary(directory, ["cloudflare", "postgres"]);
  run(["bun", "run", "check-types"], directory);

  const { origin, server } = await startReadyLocalServer(directory, token);
  try {
    const created = await cmsJson(
      origin,
      "/api/cms/collections/pages/documents",
      token,
      {
        method: "POST",
        body: {
          id: "packed-page",
          data: { title: "Packed page", slug: "packed-page" },
        },
      },
    );
    if (created.version !== 1 || created.status !== "draft") {
      throw new Error("Local packed fixture did not create a private draft.");
    }
    const preview = await cmsJson(
      origin,
      "/api/cms/collections/pages/documents/packed-page",
      token,
    );
    if ((preview.data as Record<string, unknown>)?.title !== "Packed page") {
      throw new Error("Local packed fixture draft preview was incorrect.");
    }
    const published = await cmsJson(
      origin,
      "/api/cms/collections/pages/documents/packed-page/actions/publish",
      token,
      {
        method: "POST",
        body: { expectedVersion: created.version },
      },
    );
    const publishedDocument = published.document as
      Record<string, unknown> | undefined;
    if (publishedDocument?.status !== "published") {
      throw new Error("Local packed fixture did not publish the draft.");
    }
    const publicRead = await cmsJson(
      origin,
      "/api/cms/collections/pages/documents/packed-page?view=published",
      token,
    );
    if (publicRead.status !== "published") {
      throw new Error("Local packed fixture published read was unavailable.");
    }
  } finally {
    await stopServer(server);
  }

  const databasePath = join(directory, ".agency-cms", "content.db");
  if (!existsSync(databasePath)) {
    throw new Error(
      "Local packed fixture did not persist its SQLite database.",
    );
  }
  const removed = runJson(
    ["bunx", "--bun", "agency-cms", "remove"],
    directory,
    process.env,
  );
  if (removed.install !== "completed") {
    throw new Error(
      "Local integration uninstall did not refresh dependencies.",
    );
  }
  if (
    existsSync(join(directory, ".agency-cms", "integration.receipt.json")) ||
    existsSync(join(directory, "src", "cms", "collections.ts")) ||
    !existsSync(databasePath)
  ) {
    throw new Error(
      "Local integration uninstall did not remove code while preserving content data.",
    );
  }
  run(["bun", "run", "build"], directory);
  assertPackedBundleBoundary(directory, ["local", "postgres"]);
  run(["bun", "run", "check-types"], directory);
}

async function verifyPostgresTanStackLifecycle() {
  const directory = join(runRoot, "cms-plugin-postgres-tanstack");
  cpSync(
    join(repositoryRoot, "fixtures", "cms-plugin-clean-tanstack"),
    directory,
    { recursive: true },
  );
  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify(
      integrationPackageJson(directory, {
        name: "cms-plugin-postgres-tanstack",
        provider: "postgres",
        withAuth: false,
      }),
      null,
      2,
    )}\n`,
  );
  run(["bun", "install"], directory);
  const addCommand = [
    "bunx",
    "--bun",
    "agency-cms",
    "add",
    "--framework=tanstack-start",
    "--provider=postgres",
  ];
  const added = runJson(addCommand, directory, process.env);
  const repeated = runJson(addCommand, directory, process.env);
  if (added.install !== "completed" || repeated.packageJson !== "unchanged") {
    throw new Error(
      "PostgreSQL integration was not installable and idempotent.",
    );
  }
  const diagnosis = runJson(
    ["bunx", "--bun", "agency-cms", "diagnose"],
    directory,
    {
      ...process.env,
      CMS_ADMIN_TOKEN: "packed-postgres-proof-token-32-characters",
      CMS_POSTGRES_URL: "postgresql://agency:proof@127.0.0.1:5432/agency_cms",
    },
  );
  if (diagnosis.ready !== true) {
    throw new Error("PostgreSQL integration diagnostics did not become ready.");
  }
  run(["bun", "run", "build"], directory);
  assertPackedBundleBoundary(directory, ["cloudflare", "local"]);
  run(["bun", "run", "check-types"], directory);

  const removed = runJson(
    ["bunx", "--bun", "agency-cms", "remove"],
    directory,
    process.env,
  );
  if (
    removed.install !== "completed" ||
    existsSync(join(directory, ".agency-cms", "integration.receipt.json")) ||
    existsSync(join(directory, "src", "cms", "collections.ts"))
  ) {
    throw new Error(
      "PostgreSQL integration uninstall left managed code behind.",
    );
  }
  run(["bun", "run", "build"], directory);
  assertPackedBundleBoundary(directory, ["cloudflare", "local", "postgres"]);
  run(["bun", "run", "check-types"], directory);
}

verifyTanStackIntegrationFixture({
  fixture: "cms-plugin-clean-tanstack",
  expectedReady: false,
  preservedFiles: ["src/routes/__root.tsx", "src/routes/index.tsx"],
});
verifyTanStackIntegrationFixture({
  fixture: "cms-plugin-existing-tanstack",
  expectedReady: true,
  preservedFiles: [
    "src/routes/__root.tsx",
    "src/routes/index.tsx",
    "src/routes/account.tsx",
    "src/routes/api/auth/$.ts",
    "src/styles.css",
  ],
});
await verifyLocalTanStackLifecycle();
await verifyPostgresTanStackLifecycle();

writeFileSync(
  join(consumerDirectory, "package.json"),
  `${JSON.stringify(
    {
      name: "cms-kit-clean-consumer",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        build: "vite build",
        "check-types": "tsc --noEmit",
        "verify-provider": "bun src/provider-smoke.tsx",
      },
      dependencies: {
        "@agency/cms-core": packedArtifact("cms-core"),
        "@agency/cms-agency": packedArtifact("cms-agency"),
        "@agency/cms-collaboration": packedArtifact("cms-collaboration"),
        "@agency/cms-runtime": packedArtifact("cms-runtime"),
        "@agency/cms-module-cache-cloudflare": packedArtifact(
          "cms-module-cache-cloudflare",
        ),
        "@agency/cms-module-forms": packedArtifact("cms-module-forms"),
        "@agency/cms-module-import": packedArtifact("cms-module-import"),
        "@agency/cms-module-observability": packedArtifact(
          "cms-module-observability",
        ),
        "@agency/cms-module-privacy": packedArtifact("cms-module-privacy"),
        "@agency/cms-module-redirects": packedArtifact("cms-module-redirects"),
        "@agency/cms-module-search": packedArtifact("cms-module-search"),
        "@agency/cms-module-seo": packedArtifact("cms-module-seo"),
        "@agency/cms-module-taxonomy": packedArtifact("cms-module-taxonomy"),
        "@agency/cms-provider-cloudflare": packedArtifact(
          "cms-provider-cloudflare",
        ),
        "@agency/cms-provider-postgres": packedArtifact(
          "cms-provider-postgres",
        ),
        "@agency/cms-react": packedArtifact("cms-react"),
        "@agency/cms-admin": packedArtifact("cms-admin"),
        "@agency/cms-alchemy": packedArtifact("cms-alchemy"),
        "@agency/cms-cli": packedArtifact("cms-cli"),
        "@agency/cms-template-atelier": packedArtifact("cms-template-atelier"),
        "@agency/cms-template-factory": packedArtifact("cms-template-factory"),
        "@agency/cms-template-rem-viet": packedArtifact(
          "cms-template-rem-viet",
        ),
        "@agency/cms-visual-editor": packedArtifact("cms-visual-editor"),
        "@libsql/client": "0.15.15",
        react: "^19.2.3",
        "react-dom": "^19.2.3",
        zod: "^4.3.5",
      },
      devDependencies: {
        "@types/react": "^19.2.14",
        "@types/react-dom": "^19.2.3",
        typescript: "^6.0.0",
        vite: "^8.2.1",
      },
    },
    null,
    2,
  )}\n`,
);

run(["bun", "install"], consumerDirectory);
writeFileSync(
  join(consumerDirectory, "src", "official-modules-smoke.ts"),
  `import { cmsAgencyHandoverItemIds } from "@agency/cms-agency";
import { cmsCollaborationExtensionManifest, cmsCollaborationModule, mergeCmsCollaborationFields } from "@agency/cms-collaboration";
import { assertCmsFeatureModuleCompatibility, createCmsExtensionCatalog } from "@agency/cms-core";
import { cmsCloudflareCacheExtensionManifest, normalizeCmsCacheInvalidation } from "@agency/cms-module-cache-cloudflare";
import { cmsFormsExtensionManifest, cmsFormsModule, validateCmsFormSubmission } from "@agency/cms-module-forms";
import { cmsImportExtensionManifest, parseCmsWordPressWxr } from "@agency/cms-module-import";
import { cmsObservabilityExtensionManifest, sanitizeCmsTelemetryValue } from "@agency/cms-module-observability";
import { cmsPrivacyExtensionManifest, cmsPrivacyModule, inspectCmsAssetLicenseExpiry } from "@agency/cms-module-privacy";
import { cmsRedirectsExtensionManifest, cmsRedirectsModule, validateCmsRedirectGraph } from "@agency/cms-module-redirects";
import { cmsSearchExtensionManifest, cmsSearchModule, createMemoryCmsSearchIndex } from "@agency/cms-module-search";
import { cmsSeoExtensionManifest, cmsSeoModule, createCmsSeoSitemap } from "@agency/cms-module-seo";
import { cmsTaxonomyExtensionManifest, createCmsTaxonomyIndex } from "@agency/cms-module-taxonomy";
import { postgresCmsCapabilities } from "@agency/cms-provider-postgres";

for (const module of [cmsCollaborationModule, cmsFormsModule, cmsPrivacyModule, cmsRedirectsModule, cmsSearchModule, cmsSeoModule]) {
  assertCmsFeatureModuleCompatibility(module, "0.1.0");
}
const catalog = createCmsExtensionCatalog([
  cmsCloudflareCacheExtensionManifest,
  cmsCollaborationExtensionManifest,
  cmsFormsExtensionManifest,
  cmsImportExtensionManifest,
  cmsObservabilityExtensionManifest,
  cmsPrivacyExtensionManifest,
  cmsRedirectsExtensionManifest,
  cmsSearchExtensionManifest,
  cmsSeoExtensionManifest,
  cmsTaxonomyExtensionManifest,
]);
if (catalog.entries.length !== 10 || catalog.get("official/search")?.classification !== "official") {
  throw new Error("Packed official extension catalog is incomplete.");
}
validateCmsFormSubmission({ key: "contact", fields: [{ name: "email", label: "Email", type: "email", required: true }] }, { email: "packed@example.com" });
validateCmsRedirectGraph([]);
await createMemoryCmsSearchIndex().search({ query: "packed" });
createCmsSeoSitemap("https://packed.example", [{ path: "/" }]);
normalizeCmsCacheInvalidation("https://packed.example", { event: "content.published", paths: ["/"] });
parseCmsWordPressWxr("<rss><channel></channel></rss>");
sanitizeCmsTelemetryValue({ authorization: "secret" });
mergeCmsCollaborationFields({ base: { title: "A" }, current: { title: "A" }, incoming: { title: "B" } });
inspectCmsAssetLicenseExpiry({ assets: [], now: "2026-08-21T00:00:00.000Z" });
createCmsTaxonomyIndex([{ id: "root", taxonomy: "pages", label: "Root", slug: "root", parentId: null, order: 0 }]);
if (!postgresCmsCapabilities.supported.includes("content.publish")) {
  throw new Error("Packed PostgreSQL provider capabilities are incomplete.");
}
if (cmsAgencyHandoverItemIds.length !== 8) {
  throw new Error("Packed agency control-plane contract is incomplete.");
}
console.log("Packed official extensions and agency control plane verified.");
`,
);
run(["bun", "src/official-modules-smoke.ts"], consumerDirectory);
const officialModules = [
  "cms-collaboration",
  "cms-module-cache-cloudflare",
  "cms-module-forms",
  "cms-module-import",
  "cms-module-observability",
  "cms-module-privacy",
  "cms-module-redirects",
  "cms-module-search",
  "cms-module-seo",
  "cms-module-taxonomy",
] as const;
for (const moduleDirectory of officialModules) {
  const packageName = `@agency/${moduleDirectory}`;
  run(["bun", "remove", packageName], consumerDirectory);
  if (
    existsSync(
      join(consumerDirectory, "node_modules", "@agency", moduleDirectory),
    )
  ) {
    throw new Error(
      `${packageName} remained installed after independent removal.`,
    );
  }
  run(
    [
      "bun",
      "-e",
      'import { defineFeatureModule } from "@agency/cms-core"; defineFeatureModule({ id: "consumer-core" });',
    ],
    consumerDirectory,
  );
  run(["bun", "add", packedArtifact(moduleDirectory)], consumerDirectory);
}
run(["bun", "src/official-modules-smoke.ts"], consumerDirectory);
const cliVerification = {
  schemaVersion: 1,
  operation: "verify",
  siteId: "consumer-site",
  requiredFiles: [
    "site.manifest.json",
    ".env.example",
    "content.seed.json",
    "HANDOVER.md",
    "public/assets/consumer-site-logo.svg",
    "public/assets/consumer-site-placeholder.svg",
    "src/blocks/testimonialGrid/contract.ts",
    "src/blocks/testimonialGrid/defaults.ts",
    "src/blocks/testimonialGrid/migrations.ts",
    "src/blocks/testimonialGrid/seed.ts",
    "src/blocks/testimonialGrid/renderer.tsx",
    "src/blocks/testimonialGrid/editor.tsx",
    "src/blocks/testimonialGrid/registry.ts",
    "src/blocks/testimonialGrid/block.manifest.json",
  ],
  resources: {
    worker: "consumer-site-web-staging",
    database: "consumer-site-db-staging",
  },
  forbiddenLiterals: ["Rèm Việt"],
};
const cliMigration = {
  schemaVersion: 1,
  operation: "migrate",
  siteId: "consumer-site",
  stage: "staging",
  target: "consumer-site-db-staging",
  currentVersion: 1,
  targetVersion: 2,
  steps: [{ id: "0002-consumer", from: 1, to: 2 }],
  applyConfirmation:
    "APPLY CMS MIGRATION consumer-site staging consumer-site-db-staging 1->2",
  rollbackConfirmation:
    "ROLLBACK CMS MIGRATION consumer-site staging consumer-site-db-staging 1->2",
};
writeFileSync(
  join(consumerDirectory, "cms-cli-verify.spec.json"),
  `${JSON.stringify(cliVerification, null, 2)}\n`,
);
writeFileSync(
  join(consumerDirectory, "cms-cli-migration.plan.json"),
  `${JSON.stringify(cliMigration, null, 2)}\n`,
);
writeFileSync(
  join(consumerDirectory, "cms-cli-migration-driver.ts"),
  `let version = 1;

export const migrationDriver = {
  inspectVersion: async () => version,
  createBackup: async () => ({
    locator: "memory:consumer-db-v1",
    sha256: "${"c".repeat(64)}",
    bytes: 64,
  }),
  applyStep: async (step: { to: number }) => {
    version = step.to;
  },
  restoreBackup: async () => {
    version = 1;
  },
};
`,
);
run(["bunx", "--bun", "agency-cms", "--help"], consumerDirectory);
const planInitCommand = [
  "bunx",
  "--bun",
  "agency-cms",
  "plan-init",
  "--template=@agency/cms-template-rem-viet/bootstrap",
  "--site=consumer-site",
  "--name=Independent Consumer",
  "--site-url=https://consumer.example",
  "--preset=showcase",
  "--provider=cloudflare",
  "--features=blog,leads,media",
  "--output=cms-cli-init.plan.json",
];
const planDryRun = runJson(
  [...planInitCommand, "--dry-run"],
  consumerDirectory,
  process.env,
);
if (
  planDryRun.status !== "would-create" ||
  existsSync(join(consumerDirectory, "cms-cli-init.plan.json"))
) {
  throw new Error("Packaged CMS CLI plan-init dry-run wrote its plan.");
}
const planCreated = runJson(planInitCommand, consumerDirectory, process.env);
const planRepeated = runJson(planInitCommand, consumerDirectory, process.env);
if (planCreated.status !== "created" || planRepeated.status !== "unchanged") {
  throw new Error("Packaged CMS CLI plan generation is not idempotent.");
}
const cliPlan = JSON.parse(
  readFileSync(join(consumerDirectory, "cms-cli-init.plan.json"), "utf8"),
) as { requiredSecrets: string[] };
const initEnvironment = {
  ...process.env,
  ...Object.fromEntries(cliPlan.requiredSecrets.map((name) => [name, ""])),
};
const initDryRun = runJson(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "init",
    "--plan=cms-cli-init.plan.json",
    "--dry-run",
  ],
  consumerDirectory,
  initEnvironment,
);
if (
  JSON.stringify(initDryRun.missingSecrets) !==
  JSON.stringify(cliPlan.requiredSecrets)
) {
  throw new Error(
    "Packaged CMS CLI did not report the missing-secret checklist.",
  );
}
if (existsSync(join(consumerDirectory, "site.manifest.json"))) {
  throw new Error("Packaged CMS CLI init dry-run wrote files.");
}
runJson(
  ["bunx", "--bun", "agency-cms", "init", "--plan=cms-cli-init.plan.json"],
  consumerDirectory,
  initEnvironment,
);
writeFileSync(
  join(consumerDirectory, "src", "bootstrap-plan-smoke.ts"),
  `import { createCmsAlchemyResourcePlan } from "@agency/cms-alchemy";
import { cmsSiteManifestSchema } from "@agency/cms-core";
import { remVietTemplateBlockSchema } from "@agency/cms-template-rem-viet";

const manifest = cmsSiteManifestSchema.parse(${readFileSync(
    join(consumerDirectory, "site.manifest.json"),
    "utf8",
  ).trim()});
const seed = ${readFileSync(
    join(consumerDirectory, "content.seed.json"),
    "utf8",
  ).trim()};
const blocks = remVietTemplateBlockSchema.array().parse(seed.documents[0]?.blocks);
if (blocks.length !== 10) {
  throw new Error("Generated template seed did not contain all ten blocks.");
}
const resources = createCmsAlchemyResourcePlan({
  manifest,
  stage: "staging",
  origin: "https://consumer-staging.example",
  bindings: {},
  allowMissingBindings: true,
});
if (
  resources.siteId !== "consumer-site" ||
  resources.website.name !== "consumer-site-web-staging" ||
  resources.database.name !== "consumer-site-db-staging" ||
  resources.mediaBucket.name !== "consumer-site-media-staging"
) {
  throw new Error("Canonical bootstrap manifest did not drive resource names.");
}
console.log("Canonical bootstrap manifest and Alchemy resource plan verified.");
`,
);
run(["bun", "src/bootstrap-plan-smoke.ts"], consumerDirectory);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "add-block",
    "--site=consumer-site",
    "--type=testimonialGrid",
    "--directory=src/blocks",
    "--dry-run",
  ],
  consumerDirectory,
);
if (existsSync(join(consumerDirectory, "src", "blocks", "testimonialGrid"))) {
  throw new Error("Packaged CMS CLI add-block dry-run wrote files.");
}
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "add-block",
    "--site=consumer-site",
    "--type=testimonialGrid",
    "--directory=src/blocks",
  ],
  consumerDirectory,
);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "add-block",
    "--site=consumer-site",
    "--type=testimonialGrid",
    "--directory=src/blocks",
  ],
  consumerDirectory,
);
writeFileSync(
  join(consumerDirectory, "src", "block-scaffold-smoke.tsx"),
  `import { createBlockEditorRegistry } from "@agency/cms-admin";
import { CmsBlockRenderer, createBlockRegistry } from "@agency/cms-react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createTestimonialGridSeedBlock,
  migrateTestimonialGridBlockData,
  testimonialGridBlockDefinition,
  testimonialGridBlockEditorDefinition,
  testimonialGridBlockSchema,
  type TestimonialGridBlock,
} from "./blocks/testimonialGrid";

const block = createTestimonialGridSeedBlock({
  id: "testimonial-grid-consumer",
  title: "Independent testimonial proof",
});
testimonialGridBlockSchema.parse(block);
if (migrateTestimonialGridBlockData(block.data, 1).title !== block.data.title) {
  throw new Error("Generated block migration entry point changed v1 data.");
}
const renderers = createBlockRegistry<TestimonialGridBlock, unknown>({
  testimonialGrid: testimonialGridBlockDefinition,
});
createBlockEditorRegistry<TestimonialGridBlock, unknown>({
  testimonialGrid: testimonialGridBlockEditorDefinition,
});
const html = renderToStaticMarkup(
  <CmsBlockRenderer block={block} context={undefined} registry={renderers} />,
);
if (!html.includes("Independent testimonial proof")) {
  throw new Error("Generated block did not render through the neutral registry.");
}
console.log("Generated block contract/editor/renderer/seed/migration registry verified.");
`,
);
run(
  ["bunx", "--bun", "agency-cms", "verify", "--spec=cms-cli-verify.spec.json"],
  consumerDirectory,
);
run(["bun", "src/block-scaffold-smoke.tsx"], consumerDirectory);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "migrate",
    "--plan=cms-cli-migration.plan.json",
    "--driver=cms-cli-migration-driver.ts",
    "--receipt=cli-proof/migration.receipt.json",
    "--recovery=cli-proof/migration.recovery.json",
    `--confirm=${cliMigration.applyConfirmation}`,
  ],
  consumerDirectory,
);
run(
  [
    "bunx",
    "--bun",
    "agency-cms",
    "rollback",
    "--plan=cms-cli-migration.plan.json",
    "--driver=cms-cli-migration-driver.ts",
    "--recovery=cli-proof/migration.receipt.json",
    "--receipt=cli-proof/rollback.receipt.json",
    `--confirm=${cliMigration.rollbackConfirmation}`,
  ],
  consumerDirectory,
);
run(["bun", "run", "check-types"], consumerDirectory);
run(["bun", "run", "build"], consumerDirectory);
run(["bun", "run", "verify-provider"], consumerDirectory);

console.log(`Clean consumer verified at ${consumerDirectory}`);
