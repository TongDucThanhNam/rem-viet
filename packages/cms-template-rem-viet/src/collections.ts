import {
  blocksField,
  booleanField,
  CmsError,
  defineCollection,
  defineCmsLifecycleHook,
  defineFeatureModule,
  parseCmsCollectionData,
  selectField,
  textField,
  type CmsCollectionData,
} from "@agency/cms-core";

import {
  toRemVietStandardBlock,
  type RemVietStandardBlock,
} from "./standard-blocks";

export const REM_VIET_STANDARD_PAGES_COLLECTION = "standard-pages";
export const REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION =
  "rem-viet-localized-campaigns";

/** Independent locale fixture installed by the Rèm Việt module. */
export const remVietLocalizedCampaignsCollection = defineCollection({
  slug: REM_VIET_LOCALIZED_CAMPAIGNS_COLLECTION,
  labels: { singular: "Localized campaign", plural: "Localized campaigns" },
  schemaVersion: 1,
  localization: {
    locales: ["vi-VN", "en-US"],
    defaultLocale: "vi-VN",
  },
  fields: [
    textField({ name: "code", label: "Campaign code", required: true }),
    textField({
      name: "headline",
      label: "Headline",
      required: true,
      localized: true,
    }),
  ],
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: {
    read: ["content.readDraft"],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
  admin: { useAsTitle: "headline", defaultColumns: ["headline", "code"] },
});

export const remVietStandardPagesCollection = defineCollection({
  slug: REM_VIET_STANDARD_PAGES_COLLECTION,
  labels: { singular: "Standard page", plural: "Standard pages" },
  schemaVersion: 1,
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      indexed: true,
      validation: { minLength: 1, maxLength: 200 },
    }),
    textField({
      name: "slug",
      label: "Slug",
      required: true,
      indexed: true,
      unique: true,
      validation: {
        minLength: 1,
        maxLength: 200,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
    }),
    selectField({
      name: "template",
      label: "Template",
      required: true,
      multiple: false,
      defaultValue: "standard",
      options: [{ label: "Standard", value: "standard" }],
      admin: { readOnly: true },
    }),
    blocksField({
      name: "blocks",
      label: "Content blocks",
      required: true,
      defaultValue: [],
      allowedBlocks: ["richText", "productGrid", "cta"],
    }),
    textField({
      name: "seoTitle",
      label: "SEO title",
      required: true,
      defaultValue: "",
      validation: { maxLength: 200 },
    }),
    textField({
      name: "seoDescription",
      label: "SEO description",
      required: true,
      defaultValue: "",
      multiline: true,
      validation: { maxLength: 500 },
    }),
    textField({
      name: "canonicalUrl",
      label: "Canonical URL",
      required: true,
      defaultValue: "",
      validation: { maxLength: 2_048 },
    }),
    textField({
      name: "ogImage",
      label: "Social image",
      required: true,
      defaultValue: "",
      validation: { maxLength: 2_048 },
    }),
    booleanField({
      name: "robotsIndex",
      label: "Allow indexing",
      required: true,
      defaultValue: true,
    }),
    booleanField({
      name: "robotsFollow",
      label: "Allow link following",
      required: true,
      defaultValue: true,
    }),
  ],
  lifecycle: { drafts: true, revisions: true, scheduling: true },
  access: {
    read: ["content.readDraft"],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "template"],
  },
});

/** Installable Rèm Việt collection surface, consumed through the same API as fixtures. */
export const remVietStandardPagesModule = defineFeatureModule({
  id: "rem-viet-standard-pages",
  collections: [
    remVietStandardPagesCollection,
    remVietLocalizedCampaignsCollection,
  ],
  hooks: [
    defineCmsLifecycleHook({
      id: "rem-viet-standard-pages/validate-template",
      event: "validate",
      collection: REM_VIET_STANDARD_PAGES_COLLECTION,
      order: -100,
      run({ data }) {
        if (data?.template !== "standard") {
          throw new CmsError({
            code: "VALIDATION_FAILED",
            message: "Rèm Việt standard pages require the standard template.",
            retryable: false,
          });
        }
      },
    }),
  ],
  permissions: [
    {
      id: "rem-viet-standard-pages/edit",
      capability: "content.write",
      collection: REM_VIET_STANDARD_PAGES_COLLECTION,
      operations: ["create", "update", "restore"],
      description: "Editors may author Rèm Việt standard pages.",
    },
    {
      id: "rem-viet-standard-pages/publish",
      capability: "content.publish",
      collection: REM_VIET_STANDARD_PAGES_COLLECTION,
      operations: ["publish", "unpublish"],
    },
  ],
  migrations: [
    {
      id: "rem-viet-standard-pages/v1",
      from: 0,
      to: 1,
      migrate: (state) => state,
    },
  ],
  admin: [
    {
      id: "rem-viet-standard-pages/navigation",
      collection: REM_VIET_STANDARD_PAGES_COLLECTION,
      placement: "navigation",
      label: "Standard pages",
    },
  ],
});

export type RemVietStandardPageCollectionData = CmsCollectionData<
  typeof remVietStandardPagesCollection
>;

export type RemVietStandardPageCollectionContent = {
  readonly title: string;
  readonly slug: string;
  readonly template: "standard";
  readonly blocks: RemVietStandardBlock[];
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly canonicalUrl: string;
    readonly ogImage: string;
    readonly robotsIndex: boolean;
    readonly robotsFollow: boolean;
  };
};

export function toRemVietStandardPageCollectionData(
  content: RemVietStandardPageCollectionContent,
): RemVietStandardPageCollectionData {
  return parseCmsCollectionData(remVietStandardPagesCollection, {
    title: content.title,
    slug: content.slug,
    template: content.template,
    blocks: content.blocks,
    seoTitle: content.seo.title,
    seoDescription: content.seo.description,
    canonicalUrl: content.seo.canonicalUrl,
    ogImage: content.seo.ogImage,
    robotsIndex: content.seo.robotsIndex,
    robotsFollow: content.seo.robotsFollow,
  });
}

export function fromRemVietStandardPageCollectionData(
  value: Readonly<Record<string, unknown>>,
): RemVietStandardPageCollectionContent {
  const data = parseCmsCollectionData(remVietStandardPagesCollection, value);
  const blocks = data.blocks.map((block, index) => {
    const parsed = toRemVietStandardBlock(block, index);
    if (!parsed.success) throw parsed.error;
    return parsed.data;
  });
  return {
    title: data.title,
    slug: data.slug,
    template: "standard",
    blocks,
    seo: {
      title: data.seoTitle,
      description: data.seoDescription,
      canonicalUrl: data.canonicalUrl,
      ogImage: data.ogImage,
      robotsIndex: data.robotsIndex,
      robotsFollow: data.robotsFollow,
    },
  };
}
