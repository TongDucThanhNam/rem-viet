import { z } from "zod";

export const postStatusSchema = z.enum(["draft", "published"]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const pageBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    image: z.string().optional(),
  }),
  z.object({
    type: z.literal("richText"),
    content: z.string().default(""),
  }),
  z.object({
    type: z.literal("productGrid"),
    categoryId: z.string().optional(),
    limit: z.coerce.number().int().positive().max(24).optional(),
  }),
  z.object({
    type: z.literal("cta"),
    title: z.string().min(1),
    href: z.string().min(1),
  }),
]);
export type PageBlock = z.infer<typeof pageBlockSchema>;

export const pageBlocksSchema = z.array(pageBlockSchema).default([]);

export const menuItemSchema: z.ZodType<{
  label: string;
  href: string;
  order?: number;
  children?: Array<{
    label: string;
    href: string;
    order?: number;
  }>;
}> = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  order: z.coerce.number().int().optional(),
  children: z
    .array(
      z.object({
        label: z.string().min(1),
        href: z.string().min(1),
        order: z.coerce.number().int().optional(),
      }),
    )
    .optional(),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuLocationSchema = z.enum(["header", "footer"]);
export type MenuLocation = z.infer<typeof menuLocationSchema>;

export const defaultSocials = {
  facebook: "",
  instagram: "",
  shopee: "",
  youtube: "",
  tiktok: "",
  zalo: "",
} satisfies Record<string, string>;

export const socialsSchema = z
  .object({
    facebook: z.string().default(""),
    instagram: z.string().default(""),
    shopee: z.string().default(""),
    youtube: z.string().default(""),
    tiktok: z.string().default(""),
    zalo: z.string().default(""),
  })
  .catchall(z.string())
  .default(defaultSocials);
export type SiteSocials = z.infer<typeof socialsSchema>;

export const homepageSectionSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().default(true),
  title: z.string().optional(),
});
export type HomepageSection = z.infer<typeof homepageSectionSchema>;

export const allowedMediaTypes = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const allowedMediaTypeSchema = z.enum(allowedMediaTypes);
export type AllowedMediaType = z.infer<typeof allowedMediaTypeSchema>;

export const extensionByMediaType: Record<AllowedMediaType, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const maxMediaFiles = 12;
export const maxMediaBytes = 5 * 1024 * 1024;
export const maxMediaBatchBytes = 30 * 1024 * 1024;
export const mediaKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$/i;

export function slugifyContent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
