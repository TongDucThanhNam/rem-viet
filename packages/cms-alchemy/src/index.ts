import type { CmsSiteManifest } from "@agency/cms-core";

const resourceNamePattern = /^[a-z][a-z0-9-]{1,62}$/;
const stagePattern = /^[a-z][a-z0-9-]{0,31}$/;

export const defaultCmsAlchemyRequiredBindings = [
  "CORS_ORIGIN",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "ADMIN_EMAILS",
] as const;

export type CmsAlchemyManifest = Readonly<
  Pick<CmsSiteManifest, "id" | "siteUrl"> & {
    infrastructure: Readonly<
      Pick<
        CmsSiteManifest["infrastructure"],
        | "alchemyApp"
        | "workerName"
        | "d1Name"
        | "r2BucketName"
        | "backupBucketName"
      >
    >;
  }
>;

export type CmsAlchemyResourcePlan = Readonly<{
  appName: string;
  siteId: string;
  stage: string;
  origin: string;
  productionDomain: string | null;
  requiredBindings: readonly string[];
  missingBindings: readonly string[];
  database: Readonly<{ logicalId: "database"; name: string }>;
  mediaBucket: Readonly<{
    logicalId: "product-images";
    name: string;
    enabled: boolean;
  }>;
  backupBucket: Readonly<{ name: string; managedByStack: false }>;
  website: Readonly<{
    logicalId: "web";
    name: string;
    crons: readonly string[];
  }>;
}>;

export type CreateCmsAlchemyResourcePlanOptions = {
  manifest: CmsAlchemyManifest;
  stage: string;
  origin: string;
  bindings: Readonly<Record<string, string | undefined>>;
  requiredBindings?: readonly string[];
  allowMissingBindings?: boolean;
  mediaEnabled?: boolean;
  crons?: readonly string[];
};

function assertResourceName(value: string, label: string) {
  if (!resourceNamePattern.test(value)) {
    throw new Error(`${label} must be a safe Cloudflare resource name.`);
  }
}

function stageResourceName(base: string, stage: string, label: string) {
  const value = `${base}-${stage}`;
  assertResourceName(value, label);
  return value;
}

function parseOrigin(value: string, label: string) {
  const url = new URL(value);
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "localhost")) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(`${label} must be an HTTPS origin or localhost HTTP.`);
  }
  return url.origin;
}

/** Creates the stable, inspectable input plan consumed by an Alchemy stack. */
export function createCmsAlchemyResourcePlan({
  manifest,
  stage: rawStage,
  origin: rawOrigin,
  bindings,
  requiredBindings = defaultCmsAlchemyRequiredBindings,
  allowMissingBindings = false,
  mediaEnabled = true,
  crons = ["* * * * *"],
}: CreateCmsAlchemyResourcePlanOptions): CmsAlchemyResourcePlan {
  const stage = rawStage.trim().toLowerCase();
  if (!stagePattern.test(stage)) {
    throw new Error("Stage must be a safe deployment slug.");
  }
  assertResourceName(manifest.id, "Site id");
  for (const [key, value] of Object.entries(manifest.infrastructure)) {
    assertResourceName(value, `Infrastructure ${key}`);
  }

  const siteOrigin = parseOrigin(manifest.siteUrl, "Manifest siteUrl");
  const origin = parseOrigin(rawOrigin, "Deployment origin");
  const production = stage === "production" || stage === "prod";
  if (production && origin !== siteOrigin) {
    throw new Error("Production origin must match the manifest siteUrl.");
  }

  const missingBindings = requiredBindings.filter(
    (name) => !bindings[name]?.trim(),
  );
  if (!allowMissingBindings && missingBindings.length) {
    throw new Error(
      `Missing required deployment bindings: ${missingBindings.join(", ")}.`,
    );
  }

  if (!crons.length || crons.some((cron) => !cron.trim())) {
    throw new Error("At least one non-empty scheduler cron is required.");
  }

  return Object.freeze({
    appName: manifest.infrastructure.alchemyApp,
    siteId: manifest.id,
    stage,
    origin,
    productionDomain: production ? new URL(siteOrigin).hostname : null,
    requiredBindings: Object.freeze([...requiredBindings]),
    missingBindings: Object.freeze(missingBindings),
    database: Object.freeze({
      logicalId: "database" as const,
      name: stageResourceName(manifest.infrastructure.d1Name, stage, "D1 name"),
    }),
    mediaBucket: Object.freeze({
      logicalId: "product-images" as const,
      name: stageResourceName(
        manifest.infrastructure.r2BucketName,
        stage,
        "R2 name",
      ),
      enabled: mediaEnabled,
    }),
    backupBucket: Object.freeze({
      name: manifest.infrastructure.backupBucketName,
      managedByStack: false as const,
    }),
    website: Object.freeze({
      logicalId: "web" as const,
      name: stageResourceName(
        manifest.infrastructure.workerName,
        stage,
        "Worker name",
      ),
      crons: Object.freeze([...crons]),
    }),
  });
}

export type CmsAlchemyResourceFactories<TDatabase, TBucket, TWebsite> = {
  database: (input: CmsAlchemyResourcePlan["database"]) => TDatabase;
  mediaBucket: (
    input: Omit<CmsAlchemyResourcePlan["mediaBucket"], "enabled">,
  ) => TBucket;
  website: (
    input: CmsAlchemyResourcePlan["website"] & {
      database: TDatabase;
      mediaBucket: TBucket | undefined;
      domain: string | undefined;
    },
  ) => TWebsite;
};

/** Invokes consumer-pinned resource factories from a validated plan. */
export function composeCmsAlchemyResources<TDatabase, TBucket, TWebsite>(
  plan: CmsAlchemyResourcePlan,
  factories: CmsAlchemyResourceFactories<TDatabase, TBucket, TWebsite>,
) {
  const database = factories.database(plan.database);
  const mediaBucket = plan.mediaBucket.enabled
    ? factories.mediaBucket({
        logicalId: plan.mediaBucket.logicalId,
        name: plan.mediaBucket.name,
      })
    : undefined;
  const website = factories.website({
    ...plan.website,
    database,
    mediaBucket,
    domain: plan.productionDomain ?? undefined,
  });
  return Object.freeze({ database, mediaBucket, website });
}
