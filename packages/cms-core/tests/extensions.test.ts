import { describe, expect, test } from "bun:test";

import {
  assertCmsFeatureModuleCompatibility,
  createCmsExtensionRegistry,
  defineCollection,
  defineCmsLifecycleHook,
  defineFeatureModule,
  defineCmsFeatureModuleManifest,
  textField,
} from "../src";

const collection = defineCollection({
  slug: "extension-articles",
  labels: { singular: "Article", plural: "Articles" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: {
    read: [],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
  fields: [textField({ name: "title", label: "Title", required: true })],
});

describe("CMS extension registry", () => {
  test("validates compatibility and explicit uninstall data policy", () => {
    const module = defineFeatureModule({
      id: "official-seo",
      manifest: defineCmsFeatureModuleManifest({
        schemaVersion: 1,
        packageName: "@agency/cms-module-seo",
        version: "0.1.0",
        cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
        uninstall: {
          dataPolicy: "retain",
          description: "Retain SEO fields until an explicit purge migration.",
        },
      }),
    });
    expect(assertCmsFeatureModuleCompatibility(module, "0.1.0")).toBe(true);
    expect(() => assertCmsFeatureModuleCompatibility(module, "1.0.0")).toThrow(
      "incompatible",
    );
    expect(() =>
      defineCmsFeatureModuleManifest({
        ...module.manifest!,
        cmsCompatibility: {
          minimum: "2.0.0",
          maximumExclusive: "1.0.0",
        },
      }),
    ).toThrow("maximum must exceed");
  });

  test("orders dependencies and hooks deterministically while transforming data", async () => {
    const execution: string[] = [];
    const base = defineFeatureModule({
      id: "base-content",
      collections: [collection],
      hooks: [
        defineCmsLifecycleHook({
          id: "base-content/normalize",
          event: "validate",
          collection: collection.slug,
          order: 20,
          run(context) {
            execution.push("normalize");
            return {
              data: {
                ...context.data,
                title: String(context.data?.title).trim(),
              },
            };
          },
        }),
        defineCmsLifecycleHook({
          id: "base-content/first",
          event: "validate",
          collection: collection.slug,
          order: 10,
          run() {
            execution.push("first");
          },
        }),
      ],
      permissions: [
        {
          id: "base-content/editor",
          capability: "content.write",
          collection: collection.slug,
          operations: ["create", "update"],
          description: "Editors may mutate article drafts.",
        },
      ],
      migrations: [
        {
          id: "base-content/v1",
          from: 0,
          to: 1,
          migrate: (state) => state,
        },
      ],
      admin: [
        {
          id: "base-content/navigation",
          collection: collection.slug,
          placement: "navigation",
          label: "Articles",
        },
      ],
    });
    const dependent = defineFeatureModule({
      id: "editorial-policy",
      dependsOn: [base.id],
      hooks: [
        defineCmsLifecycleHook({
          id: "editorial-policy/create",
          event: "create",
          collection: collection.slug,
          run(context) {
            execution.push("create");
            return {
              data: { ...context.data, title: `${context.data?.title}!` },
            };
          },
        }),
      ],
    });
    const registry = createCmsExtensionRegistry({
      modules: [dependent, base],
    });

    let data = await registry.runHooks("validate", {
      operation: "create",
      collection,
      actorId: "editor",
      documentId: "article-1",
      locale: null,
      data: { title: "  Hello  " },
      previousData: null,
    });
    data = await registry.runHooks("create", {
      operation: "create",
      collection,
      actorId: "editor",
      documentId: "article-1",
      locale: null,
      data,
      previousData: null,
    });

    expect(registry.modules.map(({ id }) => id)).toEqual([
      "base-content",
      "editorial-policy",
    ]);
    expect(execution).toEqual(["first", "normalize", "create"]);
    expect(data).toEqual({ title: "Hello!" });
    expect(registry.collections.get(collection.slug)).toBe(collection);
    expect(registry.permissions).toHaveLength(1);
    expect(registry.migrations).toHaveLength(1);
    expect(registry.admin).toHaveLength(1);
  });

  test("rejects duplicate ids, missing dependencies, cycles, and unknown collection targets", () => {
    expect(() =>
      createCmsExtensionRegistry({
        modules: [
          defineFeatureModule({ id: "duplicate-module" }),
          defineFeatureModule({ id: "duplicate-module" }),
        ],
      }),
    ).toThrow("Duplicate feature module id");
    expect(() =>
      createCmsExtensionRegistry({
        modules: [
          defineFeatureModule({
            id: "missing-dependency",
            dependsOn: ["not-installed"],
          }),
        ],
      }),
    ).toThrow("depends on missing module");
    expect(() =>
      createCmsExtensionRegistry({
        modules: [
          defineFeatureModule({ id: "cycle-one", dependsOn: ["cycle-two"] }),
          defineFeatureModule({ id: "cycle-two", dependsOn: ["cycle-one"] }),
        ],
      }),
    ).toThrow("contains a cycle");
    expect(() =>
      createCmsExtensionRegistry({
        modules: [
          defineFeatureModule({
            id: "unknown-target",
            hooks: [
              defineCmsLifecycleHook({
                id: "unknown-target/create",
                event: "create",
                collection: "not-registered",
                run() {},
              }),
            ],
          }),
        ],
      }),
    ).toThrow("targets unregistered collection");
  });

  test("keeps registry instances isolated", async () => {
    let firstRuns = 0;
    const first = createCmsExtensionRegistry({
      collections: [collection],
      modules: [
        defineFeatureModule({
          id: "first-instance",
          hooks: [
            defineCmsLifecycleHook({
              id: "first-instance/create",
              event: "create",
              run() {
                firstRuns += 1;
              },
            }),
          ],
        }),
      ],
    });
    const second = createCmsExtensionRegistry({ collections: [collection] });
    const context = {
      operation: "create" as const,
      collection,
      actorId: "editor",
      documentId: "article-1",
      locale: null,
      data: { title: "Isolated" },
      previousData: null,
    };

    await second.runHooks("create", context);
    expect(firstRuns).toBe(0);
    await first.runHooks("create", context);
    expect(firstRuns).toBe(1);
    expect(second.hooks).toEqual([]);
  });
});
