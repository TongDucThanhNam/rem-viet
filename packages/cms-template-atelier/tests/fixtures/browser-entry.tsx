import {
  applyCmsVisualCommand,
  commitCmsDraftHistory,
  createCmsDraftHistory,
  undoCmsDraftHistory,
  type CmsVisualDocument,
} from "../../../cms-visual-editor/src/index";
import {
  arrayField,
  blocksField,
  booleanField,
  codeField,
  colorField,
  computedField,
  createCollectionRegistry,
  dateField,
  defineCollection,
  emailField,
  groupField,
  joinField,
  jsonField,
  mediaField,
  numberField,
  pointField,
  polymorphicRelationshipField,
  relationshipField,
  richTextField,
  selectField,
  slugField,
  textField,
  urlField,
  virtualField,
} from "@agency/cms-core";
import { CmsCollectionAdminShell } from "@agency/cms-admin";
import {
  createAtelierDefaultDocument,
  atelierTemplateFactory,
} from "../../src/visual-authoring";
import { AtelierEditorShell } from "../../src/admin";
import { AtelierDocument, type AtelierPublicNode } from "../../src/index";
import { useState, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";

const grants = new Set([
  "content.compose.insert",
  "content.component.edit",
  "content.compose.move",
  "content.compose.duplicate",
  "content.compose.remove",
]);

const collectionAccess = {
  read: [] as const,
  create: ["content.write"] as const,
  update: ["content.write"] as const,
  delete: ["content.delete"] as const,
  publish: ["content.publish"] as const,
};
const collectionLifecycle = {
  drafts: true,
  revisions: true,
  scheduling: true,
} as const;
const fieldAuthors = defineCollection({
  slug: "atelier-field-authors",
  labels: { singular: "Author", plural: "Authors" },
  schemaVersion: 1,
  lifecycle: collectionLifecycle,
  access: collectionAccess,
  fields: [
    textField({ name: "name", label: "Name", required: true }),
    relationshipField({
      name: "featuredRecord",
      label: "Featured record",
      relationTo: "atelier-field-records",
      hasMany: false,
      onDelete: "nullify",
      localeBehavior: "any",
    }),
  ],
  admin: { useAsTitle: "name", defaultColumns: ["name"] },
});
const fieldTopics = defineCollection({
  slug: "atelier-field-topics",
  labels: { singular: "Topic", plural: "Topics" },
  schemaVersion: 1,
  lifecycle: collectionLifecycle,
  access: collectionAccess,
  fields: [textField({ name: "name", label: "Name", required: true })],
  admin: { useAsTitle: "name", defaultColumns: ["name"] },
});
const fieldV2Records = defineCollection({
  slug: "atelier-field-records",
  labels: { singular: "Field v2 record", plural: "Field v2 records" },
  schemaVersion: 1,
  lifecycle: collectionLifecycle,
  access: collectionAccess,
  localization: {
    locales: ["en-US", "vi-VN"],
    defaultLocale: "en-US",
  },
  fields: [
    textField({
      name: "title",
      label: "Title",
      required: true,
      localized: true,
    }),
    emailField({ name: "email", label: "Email", required: true }),
    slugField({ name: "slug", label: "Slug", required: true }),
    numberField({ name: "priority", label: "Priority", defaultValue: 0 }),
    booleanField({ name: "featured", label: "Featured", defaultValue: false }),
    dateField({ name: "publishedOn", label: "Published on", mode: "date" }),
    urlField({ name: "website", label: "Website" }),
    selectField({
      name: "category",
      label: "Category",
      multiple: false,
      required: true,
      defaultValue: "editorial",
      options: [
        { label: "Editorial", value: "editorial" },
        { label: "Campaign", value: "campaign" },
      ] as const,
    }),
    relationshipField({
      name: "author",
      label: "Author",
      relationTo: fieldAuthors.slug,
      hasMany: false,
      required: true,
      onDelete: "restrict",
    }),
    polymorphicRelationshipField({
      name: "related",
      label: "Related content",
      relationTo: [fieldAuthors.slug, fieldTopics.slug],
      hasMany: true,
      onDelete: "nullify",
      defaultValue: [],
    }),
    pointField({ name: "location", label: "Location" }),
    colorField({
      name: "brandColor",
      label: "Brand color",
      defaultValue: "#234567",
    }),
    codeField({ name: "snippet", label: "Snippet", language: "typescript" }),
    jsonField({ name: "metadata", label: "Metadata", defaultValue: {} }),
    richTextField({
      name: "body",
      label: "Body",
      defaultValue: { version: 1, blocks: [] },
    }),
    blocksField({
      name: "sections",
      label: "Sections",
      allowedBlocks: ["paragraph"],
      defaultValue: [],
    }),
    mediaField({
      name: "gallery",
      label: "Gallery",
      multiple: true,
      defaultValue: [],
      acceptedMimeTypes: ["image/*"],
    }),
    groupField({
      name: "contact",
      label: "Contact",
      fields: [
        textField({ name: "name", label: "Contact name", required: true }),
        emailField({ name: "email", label: "Contact email" }),
      ],
    }),
    arrayField({
      name: "contributors",
      label: "Contributors",
      validation: { maxItems: 3 },
      fields: [
        textField({ name: "name", label: "Contributor name", required: true }),
        emailField({ name: "email", label: "Contributor email" }),
      ],
    }),
    computedField({
      name: "searchLabel",
      label: "Search label",
      valueKind: "text",
      compute: async ({ data }) => String(data.title ?? ""),
    }),
    virtualField({
      name: "deliveryState",
      label: "Delivery state",
      valueKind: "text",
      resolve: async () => "Ready",
    }),
    joinField({
      name: "backlinks",
      label: "Backlinks",
      relationTo: fieldAuthors.slug,
      foreignField: "featuredRecord",
      hasMany: true,
      resolve: async () => [],
    }),
  ],
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "email", "category"],
    layout: [
      {
        id: "identity",
        type: "tab",
        label: "Identity",
        fields: ["title", "email", "slug"],
      },
      {
        id: "publishing",
        type: "tab",
        label: "Publishing",
        fields: [
          "priority",
          "featured",
          "publishedOn",
          "website",
          "category",
          "author",
          "related",
        ],
      },
      {
        id: "coordinates",
        type: "row",
        label: "Coordinates and color",
        fields: ["location", "brandColor"],
      },
      {
        id: "structured",
        type: "collapsible",
        label: "Structured content",
        fields: ["snippet", "metadata", "body", "sections", "gallery"],
        collapsed: true,
      },
    ],
  },
});
const fieldV2Registry = createCollectionRegistry([
  fieldAuthors,
  fieldTopics,
  fieldV2Records,
] as const);

function FieldV2BrowserFixture() {
  const [data, setData] = useState<Readonly<Record<string, unknown>>>({
    priority: 0,
    featured: false,
    category: "editorial",
    brandColor: "#234567",
    metadata: {},
    body: { version: 1, blocks: [] },
    sections: [],
    gallery: [],
    related: [],
    searchLabel: "Generated from title",
    deliveryState: "Ready",
    backlinks: [],
  });
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [status, setStatus] = useState("Not saved");
  return (
    <main data-field-v2-browser-fixture>
      <CmsCollectionAdminShell
        registry={fieldV2Registry}
        collection={fieldV2Records.slug}
        mode="create"
        collectionHref={(slug) => `/collections/${slug}`}
        createHref="/fields"
        editHref={(id) => `/fields/${id}`}
        cancelHref="/"
        data={data}
        errors={errors}
        relationshipOptions={{
          [fieldAuthors.slug]: [{ id: "author-ada", label: "Ada Lovelace" }],
          [fieldTopics.slug]: [
            { id: "topic-systems", label: "Design systems" },
          ],
        }}
        onChange={setData}
        onValidationError={(nextErrors) => {
          setErrors(nextErrors);
          setStatus(
            `Validation failed: ${Object.entries(nextErrors)
              .map(([field, message]) => `${field} (${message})`)
              .join(", ")}`,
          );
        }}
        onSubmit={(value) => {
          setErrors({});
          setStatus(`Saved ${String(value.title)}`);
        }}
      />
      <output data-field-v2-save-status aria-live="polite">
        {status}
      </output>
    </main>
  );
}

function AtelierBrowserFixture() {
  const [history, setHistory] = useState(() =>
    createCmsDraftHistory(createAtelierDefaultDocument("atelier-browser")),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const document = history.present;

  const editMasthead = () => {
    setHistory((current) => {
      const next = applyCmsVisualCommand({
        document: current.present,
        registry: atelierTemplateFactory.registry,
        grants,
        command: {
          type: "update-field",
          nodeId: "home-masthead",
          fieldPath: "title",
          value: "Atelier Browser Edition",
        },
      });
      return commitCmsDraftHistory(current, next as typeof current.present, {
        limit: 10,
      });
    });
  };

  const selectBlock = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const block = target.closest<HTMLElement>("[data-atelier-block]");
    setSelected(block?.dataset.atelierId ?? null);
  };

  return (
    <AtelierEditorShell
      data-document-version={document.version}
      documentId={document.id}
      documentType="homepage"
      label="Atelier visual editor"
      onClickCapture={selectBlock}
    >
      <nav aria-label="Atelier authoring controls">
        <button type="button" onClick={editMasthead}>
          Edit masthead
        </button>
        <button
          disabled={history.past.length === 0}
          type="button"
          onClick={() => setHistory((current) => undoCmsDraftHistory(current))}
        >
          Undo
        </button>
        <output aria-live="polite">
          {selected ? `Selected ${selected}` : "Nothing selected"}
        </output>
      </nav>
      <AtelierDocument
        nodes={
          (document as CmsVisualDocument).nodes as readonly AtelierPublicNode[]
        }
      />
    </AtelierEditorShell>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Atelier browser fixture root is missing.");
createRoot(root).render(
  new URLSearchParams(window.location.search).get("fixture") === "fields" ? (
    <FieldV2BrowserFixture />
  ) : (
    <AtelierBrowserFixture />
  ),
);
