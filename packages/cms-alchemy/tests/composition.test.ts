import { describe, expect, test } from "bun:test";

import {
  composeCmsAlchemyResources,
  createCmsAlchemyResourcePlan,
} from "../src";

const manifest = {
  id: "acme-demo",
  siteUrl: "https://acme.example.com",
  infrastructure: {
    alchemyApp: "acme-demo",
    workerName: "acme-web",
    d1Name: "acme-db",
    r2BucketName: "acme-media",
    backupBucketName: "acme-backups",
  },
};

describe("CMS Alchemy composition", () => {
  test("creates isolated names and invokes injected resource factories", () => {
    const plan = createCmsAlchemyResourcePlan({
      manifest,
      stage: "staging",
      origin: "https://staging.acme.example.com",
      bindings: {
        CORS_ORIGIN: "https://staging.acme.example.com",
        BETTER_AUTH_URL: "https://staging.acme.example.com",
        BETTER_AUTH_SECRET: "secret",
        ADMIN_EMAILS: "owner@example.com",
      },
    });
    const events: string[] = [];
    const resources = composeCmsAlchemyResources(plan, {
      database: ({ name }) => (events.push(`d1:${name}`), { name }),
      mediaBucket: ({ name }) => (events.push(`r2:${name}`), { name }),
      website: ({ name, database, mediaBucket }) => (
        events.push(`worker:${name}`),
        { name, database, mediaBucket }
      ),
    });

    expect(events).toEqual([
      "d1:acme-db-staging",
      "r2:acme-media-staging",
      "worker:acme-web-staging",
    ]);
    expect(resources.website.database).toBe(resources.database);
    expect(plan.backupBucket).toEqual({
      name: "acme-backups",
      managedByStack: false,
    });
  });

  test("fails closed for missing bindings and mismatched production origins", () => {
    expect(() =>
      createCmsAlchemyResourcePlan({
        manifest,
        stage: "staging",
        origin: "https://staging.acme.example.com",
        bindings: {},
      }),
    ).toThrow(/Missing required deployment bindings/);
    expect(() =>
      createCmsAlchemyResourcePlan({
        manifest,
        stage: "production",
        origin: "https://other.example.com",
        bindings: {},
        allowMissingBindings: true,
      }),
    ).toThrow(/Production origin/);
  });
});
