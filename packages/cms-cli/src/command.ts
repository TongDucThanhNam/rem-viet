import {
  applyCmsFilePlan,
  CmsCliMigrationExecutionError,
  createCmsBlockScaffoldPlan,
  executeCmsMigrationPlan,
  normalizeCmsCliRelativePath,
  parseCmsMigrationPlan,
  parseCmsSiteInitPlan,
  parseCmsVerificationSpec,
  rollbackCmsMigration,
  verifyCmsSiteArtifacts,
  type CmsCliMigrationDriver,
  type CmsCliMigrationRecoveryPoint,
} from "./index";
import {
  CMS_INTEGRATION_RECEIPT_PATH,
  applyCmsIntegrationPackageEntries,
  assertTanStackStartPackage,
  cmsIntegrationRequiredPackages,
  cmsIntegrationSha256,
  createCmsIntegration,
  parseCmsIntegrationPackageJson,
  parseCmsIntegrationProvider,
  parseCmsIntegrationReceipt,
  removeCmsIntegrationPackageEntries,
  type CmsIntegrationReceipt,
} from "./integration";

export type CmsCliCommandPorts = Readonly<{
  read: (path: string) => Promise<string | null>;
  write: (path: string, content: string) => Promise<void>;
  replace?: (path: string, content: string) => Promise<void>;
  remove?: (path: string) => Promise<void>;
  install?: () => Promise<void>;
  importIntegrationProvider?: (provider: string) => Promise<unknown>;
  importTemplateInitializer: (specifier: string) => Promise<unknown>;
  importMigrationDriver: (path: string) => Promise<unknown>;
  environment?: Readonly<Record<string, string | undefined>>;
  output: (value: string) => void;
}>;

export const cmsCliHelp = `agency-cms <command> [options]

Commands:
  add        --framework=tanstack-start --provider=<id> [--dry-run] [--skip-install]
  diagnose   [--receipt=.agency-cms/integration.receipt.json]
  remove     [--receipt=.agency-cms/integration.receipt.json] [--dry-run] [--skip-install]
  plan-init  --template=<package|./module> --site=<slug> --name=<name> --site-url=<https-origin>
             --preset=<id> --provider=<id> --output=<file> [--locale=<tag>]
             [--features=<comma-list>] [--dry-run]
  init       --plan=<schema-v2-file> [--dry-run]
  add-block  --site=<slug> --type=<lowerCamel> [--directory=src/blocks] [--dry-run]
  verify     --spec=<file>
  migrate    --plan=<file> --driver=<module> --receipt=<file> --recovery=<file> --confirm=<text>
  rollback   --plan=<file> --driver=<module> --recovery=<file> --receipt=<file> --confirm=<text>

All paths are repository-relative. Existing divergent files and receipts are
never overwritten. Migration drivers are project-owned modules that export
"migrationDriver" or a default CmsCliMigrationDriver.`;

export async function runCmsCli(
  argv: readonly string[],
  ports: CmsCliCommandPorts,
) {
  const [command, ...rawOptions] = argv;
  if (!command || command === "help" || command === "--help") {
    ports.output(cmsCliHelp);
    return Object.freeze({ ok: true as const, command: "help" as const });
  }
  const options = parseOptions(rawOptions);
  if (command === "add") return runAdd(options, ports);
  if (command === "diagnose") return runDiagnose(options, ports);
  if (command === "remove") return runRemove(options, ports);
  if (command === "plan-init") return runPlanInit(options, ports);
  if (command === "init") return runInit(options, ports);
  if (command === "add-block") return runAddBlock(options, ports);
  if (command === "verify") return runVerify(options, ports);
  if (command === "migrate") return runMigration(options, ports);
  if (command === "rollback") return runRollback(options, ports);
  throw new Error(`Unknown CMS CLI command: ${command}.`);
}

async function integrationReceipt(path: string, ports: CmsCliCommandPorts) {
  return parseCmsIntegrationReceipt(await readJson(path, ports));
}

function packageHas(manifest: Record<string, unknown>, name: string) {
  const dependencies = manifest.dependencies as
    Record<string, unknown> | undefined;
  const devDependencies = manifest.devDependencies as
    Record<string, unknown> | undefined;
  return (
    typeof dependencies?.[name] === "string" ||
    typeof devDependencies?.[name] === "string"
  );
}

async function preflightManagedFiles(
  receipt: CmsIntegrationReceipt,
  generated: ReturnType<typeof createCmsIntegration>["managedFiles"],
  ports: CmsCliCommandPorts,
) {
  const generatedByPath = new Map(generated.map((file) => [file.path, file]));
  const results: Array<{
    path: string;
    status: "unchanged" | "would-create";
  }> = [];
  for (const expected of receipt.managedFiles) {
    const file = generatedByPath.get(expected.path);
    if (!file || file.sha256 !== expected.sha256) {
      throw new Error(
        `CMS integration generator does not match receipt for ${expected.path}.`,
      );
    }
    const existing = await ports.read(expected.path);
    if (existing === null) {
      results.push({ path: expected.path, status: "would-create" });
      continue;
    }
    if (cmsIntegrationSha256(existing) !== expected.sha256) {
      throw new Error(`Refusing to overwrite divergent file: ${expected.path}`);
    }
    results.push({ path: expected.path, status: "unchanged" });
  }
  return results;
}

async function runAdd(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["framework", "provider", "dry-run", "skip-install"]);
  const framework = requiredValue(options, "framework");
  const provider = requiredValue(options, "provider");
  if (framework !== "tanstack-start") {
    throw new Error("Only --framework=tanstack-start is currently supported.");
  }
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(provider)) {
    throw new Error("CMS provider id must be a safe package suffix.");
  }
  if (!ports.importIntegrationProvider) {
    throw new Error("CMS integration provider loader is unavailable.");
  }
  if ((await ports.read("src/routes/__root.tsx")) === null) {
    throw new Error(
      "TanStack Start route root src/routes/__root.tsx was not found.",
    );
  }
  const packageJsonSource = await ports.read("package.json");
  if (packageJsonSource === null) {
    throw new Error("package.json was not found.");
  }
  const providerDefinition = parseCmsIntegrationProvider(
    await ports.importIntegrationProvider(provider),
  );
  if (providerDefinition.id !== provider) {
    throw new Error(
      "CMS integration provider identity does not match --provider.",
    );
  }
  const desired = createCmsIntegration({
    packageJsonSource,
    framework,
    provider: providerDefinition,
  });
  const existingReceiptSource = await ports.read(CMS_INTEGRATION_RECEIPT_PATH);
  const receipt = existingReceiptSource
    ? parseCmsIntegrationReceipt(JSON.parse(existingReceiptSource))
    : desired.receipt;
  if (receipt.framework !== framework || receipt.provider !== provider) {
    throw new Error("Existing CMS integration receipt targets another setup.");
  }
  const fileResults = await preflightManagedFiles(
    receipt,
    desired.managedFiles,
    ports,
  );
  const packageJson = applyCmsIntegrationPackageEntries(
    desired.manifest,
    receipt.packageEntries,
  );
  const packageChanged = packageJson !== packageJsonSource;
  const dryRun = options.get("dry-run") === true;
  const dependencyInstallRequired = (
    await Promise.all(
      cmsIntegrationRequiredPackages(receipt.providerPackage.name).map((name) =>
        ports.read(`node_modules/${name}/package.json`),
      ),
    )
  ).some((source) => source === null);
  const skipInstall = options.get("skip-install") === true;
  if (!dryRun) {
    if (!ports.replace) {
      throw new Error("CMS CLI replace filesystem port is unavailable.");
    }
    if (!existingReceiptSource) {
      await ports.write(
        CMS_INTEGRATION_RECEIPT_PATH,
        `${JSON.stringify(receipt, null, 2)}\n`,
      );
    }
    if (packageChanged) await ports.replace("package.json", packageJson);
    const generatedByPath = new Map(
      desired.managedFiles.map((file) => [file.path, file]),
    );
    for (const result of fileResults) {
      if (result.status === "would-create") {
        await ports.write(
          result.path,
          generatedByPath.get(result.path)!.content,
        );
      }
    }
    if (dependencyInstallRequired && !skipInstall) {
      if (!ports.install) {
        throw new Error("CMS CLI package install port is unavailable.");
      }
      await ports.install();
    }
  }
  return emit(ports, {
    ok: true,
    command: "add",
    framework,
    provider,
    dryRun,
    receipt: CMS_INTEGRATION_RECEIPT_PATH,
    packageJson: packageChanged
      ? dryRun
        ? "would-update"
        : "updated"
      : "unchanged",
    install: dependencyInstallRequired
      ? dryRun
        ? "would-run"
        : skipInstall
          ? "skipped"
          : "completed"
      : "not-needed",
    files: fileResults.map((result) => ({
      ...result,
      status:
        result.status === "would-create" && !dryRun
          ? ("created" as const)
          : result.status,
    })),
  });
}

async function runDiagnose(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["receipt"]);
  const receiptPath = optionalValue(options, "receipt")
    ? requiredPath(options, "receipt")
    : CMS_INTEGRATION_RECEIPT_PATH;
  const receipt = await integrationReceipt(receiptPath, ports);
  const packageSource = await ports.read(receipt.packageJsonPath);
  if (packageSource === null) throw new Error("package.json was not found.");
  const manifest = parseCmsIntegrationPackageJson(packageSource);
  const checks: Array<{
    id: string;
    status: "pass" | "fail" | "attention";
    message: string;
  }> = [];
  try {
    assertTanStackStartPackage(manifest);
    checks.push({
      id: "framework",
      status: "pass",
      message: "TanStack Start and Router dependencies are present.",
    });
  } catch (error) {
    checks.push({
      id: "framework",
      status: "fail",
      message:
        error instanceof Error ? error.message : "Framework check failed.",
    });
  }
  const missingPackages = cmsIntegrationRequiredPackages(
    receipt.providerPackage.name,
  ).filter((name) => !packageHas(manifest, name));
  checks.push({
    id: "packages",
    status: missingPackages.length ? "fail" : "pass",
    message: missingPackages.length
      ? `Missing packages: ${missingPackages.join(", ")}.`
      : "All selected CMS packages are declared.",
  });
  const divergentFiles: string[] = [];
  const missingFiles: string[] = [];
  for (const file of receipt.managedFiles) {
    const source = await ports.read(file.path);
    if (source === null) missingFiles.push(file.path);
    else if (cmsIntegrationSha256(source) !== file.sha256)
      divergentFiles.push(file.path);
  }
  checks.push({
    id: "managed-files",
    status: missingFiles.length || divergentFiles.length ? "fail" : "pass",
    message:
      missingFiles.length || divergentFiles.length
        ? `Missing: ${missingFiles.join(", ") || "none"}; modified: ${divergentFiles.join(", ") || "none"}.`
        : "All generated integration files match the receipt.",
  });
  const authenticationEnvironment =
    receipt.diagnostics.authenticationEnvironment;
  const providerAuthPresent = authenticationEnvironment
    ? Boolean(ports.environment?.[authenticationEnvironment]?.trim())
    : false;
  const applicationAuthPresent =
    packageHas(manifest, "better-auth") ||
    (await ports.read("src/routes/api/auth/$.ts")) !== null ||
    (await ports.read("src/lib/auth.server.ts")) !== null;
  const authPresent = providerAuthPresent || applicationAuthPresent;
  checks.push({
    id: "authentication",
    status: authPresent ? "pass" : "attention",
    message: authPresent
      ? providerAuthPresent
        ? `Provider authentication secret ${authenticationEnvironment} is configured.`
        : "An application authentication surface was detected."
      : authenticationEnvironment
        ? `Provider authentication secret ${authenticationEnvironment} is not configured.`
        : "No authentication surface was detected; configure actorFor before enabling CMS data access.",
  });
  const databaseSources = await Promise.all(
    receipt.diagnostics.databaseConfigFiles.map((path) => ports.read(path)),
  );
  const databaseBinding = receipt.diagnostics.databaseBinding;
  const databasePresent =
    databaseBinding === null ||
    databaseSources.some((source) => source?.includes(databaseBinding));
  checks.push({
    id: "database-binding",
    status: databasePresent ? "pass" : "attention",
    message: databasePresent
      ? databaseBinding === null
        ? "The selected provider does not require a database binding."
        : `Provider database binding ${databaseBinding} was detected.`
      : `Provider database binding ${databaseBinding} was not detected.`,
  });
  checks.push({
    id: "provider-capabilities",
    status: "pass",
    message: Object.entries(receipt.capabilities)
      .map(
        ([name, supported]) =>
          `${name}:${supported ? "supported" : "unavailable"}`,
      )
      .join(", "),
  });
  const failed = checks.some(({ status }) => status === "fail");
  const attention = checks.some(({ status }) => status === "attention");
  return emit(ports, {
    ok: !failed,
    ready: !failed && !attention,
    command: "diagnose",
    framework: receipt.framework,
    provider: receipt.provider,
    capabilities: receipt.capabilities,
    checks,
  });
}

async function runRemove(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["receipt", "dry-run", "skip-install"]);
  const receiptPath = optionalValue(options, "receipt")
    ? requiredPath(options, "receipt")
    : CMS_INTEGRATION_RECEIPT_PATH;
  const receipt = await integrationReceipt(receiptPath, ports);
  const packageSource = await ports.read(receipt.packageJsonPath);
  if (packageSource === null) throw new Error("package.json was not found.");
  const manifest = parseCmsIntegrationPackageJson(packageSource);
  const packageJson = removeCmsIntegrationPackageEntries(
    manifest,
    receipt.packageEntries,
  );
  for (const file of receipt.managedFiles) {
    const source = await ports.read(file.path);
    if (source !== null && cmsIntegrationSha256(source) !== file.sha256) {
      throw new Error(`Refusing to remove modified CMS file: ${file.path}.`);
    }
  }
  const dryRun = options.get("dry-run") === true;
  const skipInstall = options.get("skip-install") === true;
  const dependencyInstallRequired = receipt.packageEntries.some(
    ({ section }) =>
      section === "dependencies" || section === "devDependencies",
  );
  if (!dryRun) {
    if (!ports.replace || !ports.remove) {
      throw new Error("CMS CLI mutation filesystem ports are unavailable.");
    }
    if (packageJson !== packageSource) {
      await ports.replace(receipt.packageJsonPath, packageJson);
    }
    if (dependencyInstallRequired && !skipInstall) {
      if (!ports.install) {
        throw new Error("CMS CLI package install port is unavailable.");
      }
      await ports.install();
    }
    for (const file of receipt.managedFiles) {
      if ((await ports.read(file.path)) !== null) await ports.remove(file.path);
    }
    await ports.remove(receiptPath);
  }
  return emit(ports, {
    ok: true,
    command: "remove",
    dryRun,
    receipt: receiptPath,
    packageJson:
      packageJson === packageSource
        ? "unchanged"
        : dryRun
          ? "would-update"
          : "updated",
    install: dependencyInstallRequired
      ? dryRun
        ? "would-run"
        : skipInstall
          ? "skipped"
          : "completed"
      : "not-needed",
    files: receipt.managedFiles.map(({ path }) => ({
      path,
      status: dryRun ? "would-remove" : "removed",
    })),
  });
}

async function runPlanInit(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, [
    "template",
    "site",
    "name",
    "site-url",
    "preset",
    "provider",
    "output",
    "locale",
    "features",
    "dry-run",
  ]);
  const templateSpecifier = requiredValue(options, "template");
  const siteId = requiredValue(options, "site");
  const name = requiredValue(options, "name").trim();
  const siteUrl = requiredValue(options, "site-url");
  const preset = requiredValue(options, "preset");
  const provider = requiredValue(options, "provider");
  const defaultLocale = optionalValue(options, "locale") ?? "vi-VN";
  const features = parseFeatureList(optionalValue(options, "features"));
  const outputPath = requiredPath(options, "output");
  const initializer = parseTemplateInitializer(
    await ports.importTemplateInitializer(templateSpecifier),
  );
  const plan = parseCmsSiteInitPlan(
    await initializer.createPlan({
      siteId,
      name,
      siteUrl,
      preset,
      provider,
      defaultLocale,
      features,
    }),
  );
  if (plan.schemaVersion !== 2) {
    throw new Error("Template initializers must return a schema-v2 init plan.");
  }
  assertTemplatePlanMatchesRequest(plan, initializer.id, initializer.version, {
    siteId,
    name,
    siteUrl,
    preset,
    provider,
    defaultLocale,
    features,
  });
  if (plan.files.some((file) => file.path === outputPath)) {
    throw new Error("Init plan output cannot also be a generated site file.");
  }

  const content = `${JSON.stringify(plan, null, 2)}\n`;
  const existing = await ports.read(outputPath);
  let status: "created" | "unchanged" | "would-create";
  if (existing !== null) {
    let parsedExisting;
    try {
      parsedExisting = parseCmsSiteInitPlan(JSON.parse(existing));
    } catch {
      throw new Error(`Refusing to overwrite divergent file: ${outputPath}`);
    }
    if (JSON.stringify(parsedExisting) !== JSON.stringify(plan)) {
      throw new Error(`Refusing to overwrite divergent file: ${outputPath}`);
    }
    status = "unchanged";
  } else if (options.get("dry-run") === true) {
    status = "would-create";
  } else {
    await ports.write(outputPath, content);
    status = "created";
  }
  return emit(ports, {
    ok: true,
    command: "plan-init",
    siteId: plan.siteId,
    template: initializer.id,
    templateVersion: initializer.version,
    output: outputPath,
    status,
    fileCount: plan.files.length,
    requiredSecrets: plan.requiredSecrets,
    ...(options.get("dry-run") === true ? { plan } : {}),
  });
}

async function runInit(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["plan", "dry-run"]);
  const planPath = requiredValue(options, "plan");
  const plan = parseCmsSiteInitPlan(await readJson(planPath, ports));
  const results = await applyCmsFilePlan(plan, fileSystem(ports), {
    dryRun: options.get("dry-run") === true,
  });
  const requiredSecrets =
    plan.schemaVersion === 2 ? plan.requiredSecrets : ([] as const);
  const missingSecrets = requiredSecrets.filter(
    (name) => !ports.environment?.[name]?.trim(),
  );
  return emit(ports, {
    ok: true,
    command: "init",
    siteId: plan.siteId,
    planSchemaVersion: plan.schemaVersion,
    requiredSecrets,
    missingSecrets,
    results,
  });
}

async function runAddBlock(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["site", "type", "directory", "dry-run"]);
  const plan = createCmsBlockScaffoldPlan({
    siteId: requiredValue(options, "site"),
    type: requiredValue(options, "type"),
    directory: optionalValue(options, "directory") ?? "src/blocks",
  });
  const results = await applyCmsFilePlan(plan, fileSystem(ports), {
    dryRun: options.get("dry-run") === true,
  });
  return emit(ports, {
    ok: true,
    command: "add-block",
    siteId: plan.siteId,
    results,
  });
}

async function runVerify(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["spec"]);
  const spec = parseCmsVerificationSpec(
    await readJson(requiredValue(options, "spec"), ports),
  );
  const availableFiles: string[] = [];
  const content: string[] = [];
  for (const path of spec.requiredFiles) {
    const value = await ports.read(path);
    if (value !== null) {
      availableFiles.push(path);
      content.push(value);
    }
  }
  const result = verifyCmsSiteArtifacts({
    siteId: spec.siteId,
    files: availableFiles,
    requiredFiles: spec.requiredFiles,
    resources: spec.resources,
    forbiddenContent: spec.forbiddenLiterals.map(
      (literal) => new RegExp(escapeRegExp(literal), "i"),
    ),
    content: content.join("\n"),
  });
  return emit(ports, { command: "verify", ...result });
}

async function runMigration(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["plan", "driver", "receipt", "recovery", "confirm"]);
  const plan = parseCmsMigrationPlan(
    await readJson(requiredValue(options, "plan"), ports),
  );
  const receiptPath = requiredPath(options, "receipt");
  const recoveryPath = requiredPath(options, "recovery");
  if (receiptPath === recoveryPath) {
    throw new Error("CMS migration receipt and recovery paths must differ.");
  }
  await assertMissing(receiptPath, ports);
  await assertMissing(recoveryPath, ports);
  const driver = await loadDriver(requiredPath(options, "driver"), ports);
  try {
    const receipt = await executeCmsMigrationPlan(plan, driver, {
      confirmation: requiredValue(options, "confirm"),
    });
    await ports.write(receiptPath, json(receipt));
    return emit(ports, {
      ok: true,
      command: "migrate",
      status: receipt.status,
      receipt: receiptPath,
      targetVersion: receipt.targetVersion,
    });
  } catch (error) {
    if (error instanceof CmsCliMigrationExecutionError) {
      await ports.write(recoveryPath, json(error.recovery));
      throw new Error(
        `CMS migration requires rollback; recovery saved at ${recoveryPath}.`,
        { cause: error },
      );
    }
    throw error;
  }
}

async function runRollback(
  options: Map<string, string | true>,
  ports: CmsCliCommandPorts,
) {
  assertOptions(options, ["plan", "driver", "recovery", "receipt", "confirm"]);
  const plan = parseCmsMigrationPlan(
    await readJson(requiredValue(options, "plan"), ports),
  );
  const recovery = parseRecovery(
    await readJson(requiredValue(options, "recovery"), ports),
  );
  const receiptPath = requiredPath(options, "receipt");
  await assertMissing(receiptPath, ports);
  const driver = await loadDriver(requiredPath(options, "driver"), ports);
  const receipt = await rollbackCmsMigration(plan, recovery, driver, {
    confirmation: requiredValue(options, "confirm"),
  });
  await ports.write(receiptPath, json(receipt));
  return emit(ports, {
    ok: true,
    command: "rollback",
    status: receipt.status,
    receipt: receiptPath,
    restoredVersion: receipt.restoredVersion,
  });
}

function parseOptions(values: readonly string[]) {
  const options = new Map<string, string | true>();
  for (const value of values) {
    if (!value.startsWith("--") || value === "--") {
      throw new Error(`CMS CLI arguments must use --name=value: ${value}.`);
    }
    const separator = value.indexOf("=");
    const key = value.slice(2, separator < 0 ? undefined : separator);
    const optionValue = separator < 0 ? true : value.slice(separator + 1);
    if (!/^[a-z][a-z0-9-]*$/.test(key) || options.has(key)) {
      throw new Error(`Invalid or duplicate CMS CLI option: ${key}.`);
    }
    if (optionValue === "") throw new Error(`CMS CLI option ${key} is empty.`);
    options.set(key, optionValue);
  }
  return options;
}

function parseFeatureList(value: string | undefined) {
  if (value === undefined) return undefined;
  const features = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (
    !features.length ||
    features.some((feature) => !/^[a-z][a-zA-Z0-9-]{0,63}$/.test(feature)) ||
    new Set(features).size !== features.length
  ) {
    throw new Error(
      "Features must be a unique comma-separated identifier list.",
    );
  }
  return Object.freeze(features);
}

type TemplateInitRequest = Readonly<{
  siteId: string;
  name: string;
  siteUrl: string;
  preset: string;
  provider: string;
  defaultLocale: string;
  features: readonly string[] | undefined;
}>;

function parseTemplateInitializer(value: unknown) {
  const module = objectRecord(value, "CMS template initializer module");
  const candidate = objectRecord(
    module.cmsTemplateInitializer ?? module.default,
    "CMS template initializer",
  );
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.id !== "string" ||
    !/^[0-9A-Za-z@][0-9A-Za-z@/._-]{0,127}$/.test(candidate.id) ||
    typeof candidate.version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
      candidate.version,
    ) ||
    typeof candidate.createPlan !== "function"
  ) {
    throw new Error("CMS template initializer shape is invalid.");
  }
  return {
    id: candidate.id,
    version: candidate.version,
    createPlan: candidate.createPlan as (
      input: TemplateInitRequest,
    ) => unknown | Promise<unknown>,
  };
}

function assertTemplatePlanMatchesRequest(
  plan: Extract<ReturnType<typeof parseCmsSiteInitPlan>, { schemaVersion: 2 }>,
  templateId: string,
  templateVersion: string,
  request: TemplateInitRequest,
) {
  const manifest = plan.manifest;
  let requestedOrigin: string;
  try {
    requestedOrigin = new URL(request.siteUrl).origin;
  } catch {
    throw new Error("Requested site URL must be an HTTPS origin.");
  }
  if (
    plan.siteId !== request.siteId ||
    manifest.id !== request.siteId ||
    manifest.name !== request.name ||
    new URL(manifest.siteUrl).origin !== requestedOrigin ||
    manifest.kit.template !== templateId ||
    manifest.kit.version !== templateVersion ||
    manifest.kit.provider !== request.provider ||
    manifest.preset !== request.preset ||
    manifest.defaultLocale !== request.defaultLocale
  ) {
    throw new Error(
      "Template init plan does not match the requested bootstrap inputs.",
    );
  }
  if (
    request.features?.some((feature) => manifest.features[feature] !== true)
  ) {
    throw new Error(
      "Template init plan omitted an explicitly requested feature.",
    );
  }
}

function assertOptions(
  options: ReadonlyMap<string, string | true>,
  allowed: readonly string[],
) {
  const invalid = [...options.keys()].find((key) => !allowed.includes(key));
  if (invalid) throw new Error(`Unknown CMS CLI option: --${invalid}.`);
  for (const [key, value] of options) {
    if (value === true && key !== "dry-run" && key !== "skip-install") {
      throw new Error(`CMS CLI option --${key} requires a value.`);
    }
  }
}

function requiredValue(
  options: ReadonlyMap<string, string | true>,
  key: string,
) {
  const value = options.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing --${key}=<value>.`);
  }
  return value;
}

function optionalValue(
  options: ReadonlyMap<string, string | true>,
  key: string,
) {
  const value = options.get(key);
  return typeof value === "string" ? value : undefined;
}

function requiredPath(
  options: ReadonlyMap<string, string | true>,
  key: string,
) {
  return normalizeCmsCliRelativePath(requiredValue(options, key));
}

async function readJson(path: string, ports: CmsCliCommandPorts) {
  const safePath = normalizeCmsCliRelativePath(path);
  const source = await ports.read(safePath);
  if (source === null)
    throw new Error(`CMS CLI file does not exist: ${safePath}.`);
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`CMS CLI file is not valid JSON: ${safePath}.`, {
      cause: error,
    });
  }
}

function fileSystem(ports: CmsCliCommandPorts) {
  return { read: ports.read, write: ports.write };
}

async function assertMissing(path: string, ports: CmsCliCommandPorts) {
  if ((await ports.read(path)) !== null) {
    throw new Error(`Refusing to overwrite existing CMS receipt: ${path}.`);
  }
}

async function loadDriver(path: string, ports: CmsCliCommandPorts) {
  const value = await ports.importMigrationDriver(path);
  const module = objectRecord(value, "CMS migration driver module");
  const driver = (module.migrationDriver ?? module.default) as unknown;
  const candidate = objectRecord(driver, "CMS migration driver");
  for (const method of [
    "inspectVersion",
    "createBackup",
    "applyStep",
    "restoreBackup",
  ] as const) {
    if (typeof candidate[method] !== "function") {
      throw new Error(`CMS migration driver is missing ${method}.`);
    }
  }
  return candidate as CmsCliMigrationDriver;
}

function parseRecovery(value: unknown): CmsCliMigrationRecoveryPoint {
  const input = objectRecord(value, "CMS migration recovery");
  const backup = objectRecord(input.backup, "CMS migration recovery backup");
  if (
    typeof input.siteId !== "string" ||
    (input.stage !== "staging" && input.stage !== "production") ||
    typeof input.target !== "string" ||
    typeof input.currentVersion !== "number" ||
    typeof input.targetVersion !== "number" ||
    !Array.isArray(input.appliedStepIds) ||
    input.appliedStepIds.some((id) => typeof id !== "string") ||
    typeof backup.locator !== "string" ||
    typeof backup.sha256 !== "string" ||
    typeof backup.bytes !== "number"
  ) {
    throw new Error("CMS migration recovery shape is invalid.");
  }
  return {
    siteId: input.siteId,
    stage: input.stage,
    target: input.target,
    currentVersion: input.currentVersion,
    targetVersion: input.targetVersion,
    appliedStepIds: input.appliedStepIds as string[],
    backup: {
      locator: backup.locator,
      sha256: backup.sha256,
      bytes: backup.bytes,
    },
  };
}

function objectRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function emit<T extends object>(ports: CmsCliCommandPorts, value: T) {
  const result = Object.freeze(value);
  ports.output(JSON.stringify(result, null, 2));
  return result;
}
