import {
  createCloudflareCmsGlobalContentProvider,
  type CloudflareD1Database,
} from "@agency/cms-provider-cloudflare";
import {
  homepageSectionSchema,
  menuItemSchema,
  menuLocationSchema,
  safeMediaSourceSchema,
  socialsSchema,
} from "@rem-viet/cms";
import { env } from "@rem-viet/env/server";
import { z } from "zod";

export const SITE_SETTINGS_GLOBAL_KEY = "site-settings";
export const navigationGlobalKey = (location: "header" | "footer") =>
  `navigation:${location}` as const;

export const remVietSiteSettingsGlobalSchema = z.object({
  kind: z.literal("site-settings"),
  logo: z.literal("").or(safeMediaSourceSchema),
  phone: z.string(),
  address: z.string(),
  socials: socialsSchema,
  homepageSections: z.array(homepageSectionSchema),
});

export const remVietNavigationGlobalSchema = z.object({
  kind: z.literal("navigation"),
  location: menuLocationSchema,
  title: z.string(),
  items: z.array(menuItemSchema),
});

export const remVietGlobalContentSchema = z.discriminatedUnion("kind", [
  remVietSiteSettingsGlobalSchema,
  remVietNavigationGlobalSchema,
]);

export type RemVietGlobalContent = z.infer<typeof remVietGlobalContentSchema>;
export type RemVietSiteSettingsGlobal = z.infer<
  typeof remVietSiteSettingsGlobalSchema
>;
export type RemVietNavigationGlobal = z.infer<
  typeof remVietNavigationGlobalSchema
>;

function databaseBinding() {
  return env.DB as unknown as CloudflareD1Database;
}

export function createRemVietGlobalContentProvider() {
  return createCloudflareCmsGlobalContentProvider<RemVietGlobalContent>({
    database: databaseBinding(),
    parseContent(value) {
      return remVietGlobalContentSchema.parse(value);
    },
  });
}
