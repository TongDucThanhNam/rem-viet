import { z } from "zod";

const short = z.string().trim().min(1).max(160);
const body = z.string().trim().min(1).max(1200);
const link = z
  .string()
  .trim()
  .regex(/^(?:\/|https:\/\/|mailto:)/);
const image = z.object({ src: z.string().startsWith("/assets/"), alt: short });

export const atelierDataSchemas = {
  masthead: z.object({ issue: short, title: short, summary: body }),
  issueIndex: z.object({
    title: short,
    entries: z
      .array(z.object({ number: short, label: short }))
      .min(2)
      .max(12),
  }),
  storyCard: z.object({ kicker: short, title: short, dek: body, href: link }),
  mediaFeature: z.object({ image, caption: body }),
  quotePull: z.object({ quote: body, attribution: short }),
  scheduleGrid: z.object({
    title: short,
    events: z
      .array(z.object({ date: short, title: short, location: short }))
      .min(1)
      .max(12),
  }),
  membershipCta: z.object({ title: short, body, label: short, href: link }),
  siteFooter: z.object({ title: short, email: z.string().email() }),
  columnLayout: z.object({ ratio: z.enum(["wide", "balanced"]) }),
} as const;

export type AtelierBlockType = keyof typeof atelierDataSchemas;
export type AtelierPublicNode = Readonly<{
  id: string;
  type: AtelierBlockType;
  schemaVersion: 1;
  enabled: boolean;
  data: unknown;
  slots?: Readonly<Record<string, readonly AtelierPublicNode[]>>;
}>;

export function parseAtelierPublicNode(value: unknown): AtelierPublicNode {
  if (!value || typeof value !== "object")
    throw new Error("Atelier node is invalid.");
  const node = value as Record<string, unknown>;
  if (
    typeof node.id !== "string" ||
    !(
      node.type &&
      typeof node.type === "string" &&
      node.type in atelierDataSchemas
    ) ||
    node.schemaVersion !== 1 ||
    typeof node.enabled !== "boolean"
  ) {
    throw new Error("Atelier node envelope is invalid.");
  }
  const type = node.type as AtelierBlockType;
  const slots = node.slots
    ? Object.fromEntries(
        Object.entries(node.slots as Record<string, unknown>).map(
          ([slot, children]) => {
            if (!Array.isArray(children))
              throw new Error(`Atelier slot ${slot} is invalid.`);
            return [slot, children.map(parseAtelierPublicNode)];
          },
        ),
      )
    : undefined;
  return Object.freeze({
    id: node.id,
    type,
    schemaVersion: 1 as const,
    enabled: node.enabled,
    data: atelierDataSchemas[type].parse(node.data),
    slots,
  });
}
