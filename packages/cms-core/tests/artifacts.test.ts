import { describe, expect, test } from "bun:test";

import {
  arrayField,
  colorField,
  computedField,
  createCmsCollectionJsonSchema,
  createCmsCollectionOpenApiSchema,
  defineCollection,
  emailField,
  groupField,
  joinField,
  pointField,
  polymorphicRelationshipField,
  selectField,
  slugField,
  textField,
  urlField,
  virtualField,
} from "../src";

const collection = defineCollection({
  slug: "artifact-records",
  labels: { singular: "Artifact record", plural: "Artifact records" },
  schemaVersion: 2,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access: { read: [], create: [], update: [], delete: [], publish: [] },
  fields: [
    emailField({ name: "email", label: "Email", required: true }),
    urlField({ name: "website", label: "Website" }),
    slugField({ name: "slug", label: "Slug", required: true, unique: true }),
    colorField({ name: "color", label: "Color" }),
    pointField({ name: "location", label: "Location" }),
    selectField({
      name: "audience",
      label: "Audience",
      multiple: false,
      options: [
        { label: "Public", value: "public" },
        { label: "Members", value: "members" },
      ] as const,
    }),
    textField({
      name: "memberNote",
      label: "Member note",
      required: true,
      visibleWhen: { field: "audience", equals: "members" },
    }),
    groupField({
      name: "address",
      label: "Address",
      fields: [textField({ name: "street", label: "Street", required: true })],
    }),
    arrayField({
      name: "credits",
      label: "Credits",
      validation: { maxItems: 5 },
      fields: [textField({ name: "name", label: "Name", required: true })],
    }),
    polymorphicRelationshipField({
      name: "related",
      label: "Related",
      relationTo: ["articles", "authors"],
      hasMany: true,
      onDelete: "nullify",
      defaultValue: [],
    }),
    computedField({
      name: "searchLabel",
      label: "Search label",
      valueKind: "text",
      compute: async () => "record",
    }),
    virtualField({
      name: "viewerLabel",
      label: "Viewer label",
      valueKind: "text",
      resolve: async () => "viewer",
    }),
    joinField({
      name: "backlinks",
      label: "Backlinks",
      relationTo: "articles",
      foreignField: "artifact",
      hasMany: true,
      resolve: async () => [],
    }),
  ],
  migrations: [{ from: 1, to: 2, migrate: (value) => value }],
});

describe("generated collection artifacts", () => {
  test("emits deterministic JSON Schema and OpenAPI 3.1 field metadata", () => {
    const schema = createCmsCollectionJsonSchema(collection);
    expect(schema).toMatchObject({
      $id: "urn:agency-cms:collection:artifact-records:v2",
      type: "object",
      additionalProperties: false,
      required: ["email", "slug", "searchLabel"],
      properties: {
        email: { type: "string", format: "email" },
        website: {
          type: "string",
          format: "uri",
          "x-cms-allowed-protocols": ["http:", "https:"],
        },
        slug: {
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          "x-cms-unique": true,
        },
        color: { pattern: "^#[0-9a-fA-F]{6}$" },
        location: {
          required: ["latitude", "longitude"],
        },
        address: {
          type: "object",
          required: ["street"],
        },
        credits: {
          type: "array",
          maxItems: 5,
          items: { required: ["name"] },
        },
        related: {
          type: "array",
          items: {
            required: ["relationTo", "id"],
            "x-cms-relation-to": ["articles", "authors"],
          },
        },
        searchLabel: { readOnly: true, "x-cms-derived": "computed" },
        viewerLabel: { readOnly: true, "x-cms-derived": "virtual" },
        backlinks: {
          readOnly: true,
          "x-cms-derived": "join",
          "x-cms-foreign-field": "artifact",
        },
      },
      allOf: [
        {
          if: {
            required: ["audience"],
            properties: { audience: { const: "members" } },
          },
          then: { required: ["memberNote"] },
        },
      ],
    });
    expect(createCmsCollectionOpenApiSchema(collection)).toEqual(schema);
    expect(JSON.stringify(schema)).not.toContain("migrate");
  });
});
