import {
  createCmsTemplateFactory,
  defineCmsTemplateBlock,
} from "@agency/cms-template-factory";
import type {
  CmsVisualComponentConstraints,
  CmsVisualFieldDefinition,
  CmsVisualNode,
} from "@agency/cms-visual-editor";
import { defineCmsVisualPattern } from "@agency/cms-visual-editor";

import { atelierDataSchemas, type AtelierBlockType } from "./contracts.js";

const permissions = {
  insert: ["content.compose.insert"],
  edit: ["content.component.edit"],
  move: ["content.compose.move"],
  duplicate: ["content.compose.duplicate"],
  remove: ["content.compose.remove"],
} as const;

function block<TType extends AtelierBlockType>(input: {
  type: TType;
  fields: readonly CmsVisualFieldDefinition[];
  defaults: () => unknown;
  constraints?: CmsVisualComponentConstraints;
}) {
  return defineCmsTemplateBlock({
    type: input.type,
    schemaVersion: 1,
    fields: input.fields,
    defaults: input.defaults,
    parse: (value) => atelierDataSchemas[input.type].parse(value),
    renderer: `@agency/cms-template-atelier/${input.type}/renderer`,
    editor: `@agency/cms-template-atelier/${input.type}/editor`,
    constraints: input.constraints,
    actionCapabilities: permissions,
  });
}

const childParents = [null, "columnLayout"] as const;

export const mastheadBlock = block({
  type: "masthead",
  fields: [
    { path: "issue", label: "Issue", kind: "text" },
    {
      path: "title",
      label: "Title",
      kind: "text",
      required: true,
      inlineText: { maxLength: 160 },
    },
    { path: "summary", label: "Summary", kind: "richText" },
  ],
  defaults: () => ({
    issue: "Issue 07 / New practices",
    title: "Atelier Index",
    summary: "Independent art, design and civic practice.",
  }),
  constraints: { min: 1, max: 1, pinned: "start", allowedParents: [null] },
});

export const issueIndexBlock = block({
  type: "issueIndex",
  fields: [
    { path: "title", label: "Index title", kind: "text" },
    { path: "entries", label: "Entries", kind: "custom" },
  ],
  defaults: () => ({
    title: "In this issue",
    entries: [
      { number: "01", label: "Field notes" },
      { number: "02", label: "Open studios" },
    ],
  }),
  constraints: { max: 4, allowedParents: childParents },
});

export const storyCardBlock = block({
  type: "storyCard",
  fields: [
    { path: "kicker", label: "Kicker", kind: "text" },
    {
      path: "title",
      label: "Title",
      kind: "text",
      required: true,
      inlineText: { maxLength: 160 },
    },
    { path: "dek", label: "Introduction", kind: "richText" },
    { path: "href", label: "Story link", kind: "relationship" },
  ],
  defaults: () => ({
    kicker: "Field note",
    title: "The useful edge",
    dek: "How small studios build durable public work.",
    href: "/stories/useful-edge",
  }),
  constraints: { max: 12, allowedParents: childParents },
});

export const mediaFeatureBlock = block({
  type: "mediaFeature",
  fields: [
    { path: "image.src", label: "Image", kind: "media" },
    {
      path: "image.alt",
      label: "Reviewed alt text",
      kind: "text",
      required: true,
    },
    { path: "caption", label: "Caption", kind: "richText" },
  ],
  defaults: () => ({
    image: {
      src: "/assets/atelier-editorial.svg",
      alt: "Abstract cobalt and red editorial composition",
    },
    caption: "A visual essay on provisional spaces.",
  }),
  constraints: { max: 8, allowedParents: childParents },
});

export const quotePullBlock = block({
  type: "quotePull",
  fields: [
    { path: "quote", label: "Quotation", kind: "richText" },
    { path: "attribution", label: "Attribution", kind: "text" },
  ],
  defaults: () => ({
    quote: "A publication is a room that can travel.",
    attribution: "Mara Voss, editor",
  }),
  constraints: { max: 6, allowedParents: childParents },
});

export const scheduleGridBlock = block({
  type: "scheduleGrid",
  fields: [
    { path: "title", label: "Schedule title", kind: "text" },
    { path: "events", label: "Events", kind: "custom" },
  ],
  defaults: () => ({
    title: "Assembly calendar",
    events: [
      { date: "14 SEP", title: "Open critique", location: "Room 4" },
      { date: "28 SEP", title: "Night press", location: "Print lab" },
    ],
  }),
  constraints: { max: 3, allowedParents: [null] },
});

export const membershipCtaBlock = block({
  type: "membershipCta",
  fields: [
    { path: "title", label: "Title", kind: "text" },
    { path: "body", label: "Body", kind: "richText" },
    { path: "label", label: "Link label", kind: "text" },
    { path: "href", label: "Link", kind: "relationship" },
  ],
  defaults: () => ({
    title: "Keep the press moving",
    body: "Members fund commissions, translations and free public programs.",
    label: "Join the circle",
    href: "/membership",
  }),
  constraints: { max: 2, allowedParents: childParents },
});

export const siteFooterBlock = block({
  type: "siteFooter",
  fields: [
    { path: "title", label: "Publication name", kind: "text" },
    { path: "email", label: "Contact email", kind: "text" },
  ],
  defaults: () => ({ title: "Atelier Index", email: "desk@atelier.example" }),
  constraints: { min: 1, max: 1, pinned: "end", allowedParents: [null] },
});

export const columnLayoutBlock = block({
  type: "columnLayout",
  fields: [{ path: "ratio", label: "Column ratio", kind: "select" }],
  defaults: () => ({ ratio: "wide" }),
  constraints: {
    max: 4,
    allowedParents: [null],
    slots: {
      primary: {
        min: 1,
        max: 6,
        allowedChildren: ["storyCard", "mediaFeature", "quotePull"],
      },
      sidebar: {
        min: 1,
        max: 4,
        allowedChildren: ["issueIndex", "membershipCta"],
      },
    },
  },
});

export const atelierTemplateBlocks = Object.freeze([
  mastheadBlock,
  issueIndexBlock,
  storyCardBlock,
  mediaFeatureBlock,
  quotePullBlock,
  scheduleGridBlock,
  membershipCtaBlock,
  siteFooterBlock,
  columnLayoutBlock,
]);

export const atelierEditorialFeaturePattern = defineCmsVisualPattern({
  id: "editorial-feature",
  label: "Editorial feature",
  description:
    "A two-column feature with story, media, issue index, and membership callout.",
  category: "Editorial",
  keywords: ["feature", "story", "media", "columns"],
  createNodes: ({ createId }) => [
    {
      ...columnLayoutBlock.createSeed({ id: createId("columnLayout") }),
      slots: {
        primary: [
          storyCardBlock.createSeed({ id: createId("storyCard") }),
          mediaFeatureBlock.createSeed({ id: createId("mediaFeature") }),
        ],
        sidebar: [
          issueIndexBlock.createSeed({ id: createId("issueIndex") }),
          membershipCtaBlock.createSeed({ id: createId("membershipCta") }),
        ],
      },
    },
  ],
});

export const atelierQuoteHighlightPattern = defineCmsVisualPattern({
  id: "quote-highlight",
  label: "Quote highlight",
  description: "A standalone editorial quotation with attribution.",
  category: "Editorial",
  keywords: ["quote", "quotation", "pull quote"],
  createNodes: ({ createId }) => [
    quotePullBlock.createSeed({ id: createId("quotePull") }),
  ],
});

export const atelierVisualPatterns = Object.freeze([
  atelierEditorialFeaturePattern,
  atelierQuoteHighlightPattern,
]);

export const atelierTemplateFactory = createCmsTemplateFactory({
  id: "@agency/cms-template-atelier",
  version: "0.1.0",
  schemaVersion: 1,
  blocks: atelierTemplateBlocks,
  patterns: atelierVisualPatterns,
});

export function createAtelierDefaultDocument(
  siteId: string,
  editorialSrc = "/assets/atelier-editorial.svg",
) {
  const layout: CmsVisualNode = {
    ...columnLayoutBlock.createSeed({ id: "home-columns" }),
    slots: {
      primary: [
        storyCardBlock.createSeed({ id: "home-story" }),
        mediaFeatureBlock.createSeed({
          id: "home-media",
          data: {
            image: {
              src: editorialSrc,
              alt: "Abstract cobalt and red editorial composition",
            },
            caption: "A visual essay on provisional spaces.",
          },
        }),
        quotePullBlock.createSeed({ id: "home-quote" }),
      ],
      sidebar: [
        issueIndexBlock.createSeed({ id: "home-index" }),
        membershipCtaBlock.createSeed({ id: "home-membership" }),
      ],
    },
  };
  return atelierTemplateFactory.createDocument({
    id: `${siteId}-home`,
    siteId,
    nodes: [
      mastheadBlock.createSeed({ id: "home-masthead" }),
      layout,
      scheduleGridBlock.createSeed({ id: "home-schedule" }),
      siteFooterBlock.createSeed({ id: "home-footer" }),
    ],
  });
}
