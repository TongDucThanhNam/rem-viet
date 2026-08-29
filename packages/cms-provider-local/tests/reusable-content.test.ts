import { describe, expect, test } from "bun:test";

import {
  CmsError,
  cmsReusableContentReferenceSchema,
  createCollectionRegistry,
} from "@agency/cms-core";
import {
  cmsReusableContentCollection,
  createCmsReusableContentRuntime,
} from "@agency/cms-runtime";

import {
  applyLocalCmsMigrations,
  createLocalCmsCollectionProvider,
  createLocalCmsDatabase,
} from "../src";

const reference = (fragmentId: string, title?: string) =>
  cmsReusableContentReferenceSchema.parse({
    kind: "cms.reusable-reference",
    fragmentId,
    contentType: "standard-page-block",
    overrides: title ? [{ op: "set", path: "/title", value: title }] : [],
  });

const reusableDatabase = () =>
  createLocalCmsDatabase({ url: "file::memory:?cache=shared" });

describe("local reusable-content lifecycle", () => {
  test("persists, publishes, resolves, graphs, and safely deletes fragments", async () => {
    const database = reusableDatabase();
    await applyLocalCmsMigrations(database);
    let sequence = 0;
    const provider = createLocalCmsCollectionProvider({
      database,
      registry: createCollectionRegistry([cmsReusableContentCollection]),
      namespace: "reusable-content-lifecycle",
      createId: () => `reusable-${++sequence}`,
      now: () => new Date("2026-08-30T04:00:00.000Z"),
    });
    const runtime = createCmsReusableContentRuntime(provider);

    const child = await runtime.createDraft({
      id: "shared-cta",
      actorId: "editor",
      data: {
        title: "Shared CTA",
        key: "shared-cta",
        description: "Site-wide contact action",
        contentType: "standard-page-block",
        value: { type: "cta", title: "Contact", href: "/contact" },
      },
    });
    const childPublished = await runtime.publish({
      id: child.id,
      expectedVersion: child.version,
      actorId: "publisher",
      note: "Ready for reuse",
    });
    const parent = await runtime.createDraft({
      id: "campaign-slot",
      actorId: "editor",
      data: {
        title: "Campaign slot",
        key: "campaign-slot",
        description: "Nested reusable example",
        contentType: "standard-page-block",
        value: { type: "slot", child: reference(child.id) },
      },
    });
    const parentPublished = await runtime.publish({
      id: parent.id,
      expectedVersion: parent.version,
      actorId: "publisher",
    });

    const resolution = await runtime.resolve({
      value: reference(parent.id, "Local campaign"),
      mode: "published",
    });
    expect(resolution.value).toEqual({
      type: "slot",
      title: "Local campaign",
      child: { type: "cta", title: "Contact", href: "/contact" },
    });
    expect(resolution.usages.map((usage) => usage.fragmentId)).toEqual([
      parent.id,
      child.id,
    ]);
    expect(childPublished.revision.id).toBeTruthy();
    expect(parentPublished.revision.id).toBeTruthy();

    const graph = await runtime.usageGraph({
      mode: "draft",
      sources: [
        {
          sourceType: "standard-page",
          sourceId: "about",
          value: { blocks: [reference(parent.id)] },
        },
      ],
    });
    expect(graph.byFragment[parent.id]).toHaveLength(1);
    expect(graph.byFragment[child.id]).toHaveLength(1);
    await expect(
      runtime.unpublish({
        id: parent.id,
        expectedVersion: parentPublished.document.version,
        actorId: "publisher",
        sources: [
          {
            sourceType: "standard-page",
            sourceId: "about",
            value: { blocks: [reference(parent.id)] },
          },
        ],
      }),
    ).rejects.toMatchObject<CmsError>({ code: "CONFLICT" });
    await expect(
      runtime.delete({
        id: parent.id,
        expectedVersion: parentPublished.document.version,
        actorId: "editor",
        sources: [
          {
            sourceType: "standard-page",
            sourceId: "about",
            value: { blocks: [reference(parent.id)] },
          },
        ],
      }),
    ).rejects.toMatchObject<CmsError>({ code: "CONFLICT" });
  });

  test("rejects draft cycles and publication through private dependencies", async () => {
    const database = reusableDatabase();
    await applyLocalCmsMigrations(database);
    const provider = createLocalCmsCollectionProvider({
      database,
      registry: createCollectionRegistry([cmsReusableContentCollection]),
      namespace: "reusable-content-validation",
      createId: () => crypto.randomUUID(),
    });
    const runtime = createCmsReusableContentRuntime(provider);
    const privateChild = await runtime.createDraft({
      id: "private-child",
      actorId: "editor",
      data: {
        title: "Private child",
        key: "private-child",
        description: "",
        contentType: "standard-page-block",
        value: { type: "cta", title: "Private", href: "/private" },
      },
    });
    const parent = await runtime.createDraft({
      id: "parent",
      actorId: "editor",
      data: {
        title: "Parent",
        key: "parent",
        description: "",
        contentType: "standard-page-block",
        value: reference(privateChild.id),
      },
    });

    await expect(
      runtime.publish({
        id: parent.id,
        expectedVersion: parent.version,
        actorId: "publisher",
      }),
    ).rejects.toMatchObject<CmsError>({ code: "VALIDATION_FAILED" });

    const publishedChild = await runtime.publish({
      id: privateChild.id,
      expectedVersion: privateChild.version,
      actorId: "publisher",
    });
    const publishedParent = await runtime.publish({
      id: parent.id,
      expectedVersion: parent.version,
      actorId: "publisher",
    });
    await expect(
      runtime.saveDraft({
        id: privateChild.id,
        expectedVersion: publishedChild.document.version,
        actorId: "editor",
        data: {
          ...publishedChild.document.data,
          value: reference(publishedParent.document.id),
        },
      }),
    ).rejects.toMatchObject<CmsError>({ code: "VALIDATION_FAILED" });
  });

  test("rejects restoring a historical revision after its dependency was deleted", async () => {
    const database = reusableDatabase();
    await applyLocalCmsMigrations(database);
    const provider = createLocalCmsCollectionProvider({
      database,
      registry: createCollectionRegistry([cmsReusableContentCollection]),
      namespace: "reusable-content-restore",
      createId: () => crypto.randomUUID(),
    });
    const runtime = createCmsReusableContentRuntime(provider);
    const child = await runtime.createDraft({
      id: "restore-child",
      actorId: "editor",
      data: {
        title: "Restore child",
        key: "restore-child",
        description: "",
        contentType: "standard-page-block",
        value: { type: "cta", title: "Child", href: "/child" },
      },
    });
    const childPublished = await runtime.publish({
      id: child.id,
      expectedVersion: child.version,
      actorId: "publisher",
    });
    const parent = await runtime.createDraft({
      id: "restore-parent",
      actorId: "editor",
      data: {
        title: "Restore parent",
        key: "restore-parent",
        description: "",
        contentType: "standard-page-block",
        value: reference(child.id),
      },
    });
    const parentPublished = await runtime.publish({
      id: parent.id,
      expectedVersion: parent.version,
      actorId: "publisher",
    });
    const parentDetached = await runtime.saveDraft({
      id: parent.id,
      expectedVersion: parentPublished.document.version,
      actorId: "editor",
      data: {
        ...parentPublished.document.data,
        value: { type: "cta", title: "Detached", href: "/detached" },
      },
    });
    await expect(
      runtime.delete({
        id: child.id,
        expectedVersion: childPublished.document.version,
        actorId: "editor",
      }),
    ).rejects.toMatchObject<CmsError>({ code: "CONFLICT" });
    await provider.delete({
      collection: cmsReusableContentCollection.slug,
      id: child.id,
      expectedVersion: childPublished.document.version,
      actorId: "external-repair",
    });

    await expect(
      runtime.restore({
        id: parent.id,
        revisionId: parentPublished.revision.id,
        expectedVersion: parentDetached.version,
        actorId: "editor",
      }),
    ).rejects.toMatchObject<CmsError>({ code: "VALIDATION_FAILED" });
  });
});
