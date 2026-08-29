import { describe, expect, test } from "bun:test";
import {
  arrayField,
  computedField,
  defineCollection,
  groupField,
  textField,
} from "@agency/cms-core";
import { flattenCmsVisualOutline } from "@agency/cms-visual-editor";

import { createCmsCollectionFieldOutline } from "../src";

const collection = defineCollection({
  slug: "outline-records",
  labels: { singular: "Outline record", plural: "Outline records" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access: {
    read: [],
    create: ["content.write"],
    update: ["content.write"],
    delete: ["content.delete"],
    publish: ["content.publish"],
  },
  fields: [
    textField({ name: "title", label: "Title", required: true }),
    textField({
      name: "internalNote",
      label: "Internal note",
      admin: { readOnly: true },
    }),
    groupField({
      name: "address",
      label: "Address",
      fields: [
        textField({ name: "street", label: "Street" }),
        textField({ name: "city", label: "City" }),
      ],
    }),
    arrayField({
      name: "contributors",
      label: "Contributors",
      fields: [
        textField({ name: "name", label: "Name" }),
        textField({ name: "email", label: "Email" }),
      ],
    }),
    textField({
      name: "privateTitle",
      label: "Private title",
      visibleWhen: { field: "title", equals: "private" },
    }),
    computedField({
      name: "summary",
      label: "Summary",
      valueKind: "text",
      compute: async () => "Summary",
    }),
  ],
  admin: { useAsTitle: "title", defaultColumns: ["title"] },
});

const data = {
  title: "Public",
  internalNote: "Readonly",
  address: { street: "1 Main", city: "Saigon" },
  contributors: [
    { name: "Nam", email: "nam@example.com" },
    { name: "Linh", email: "linh@example.com" },
  ],
  summary: "Summary",
};

describe("collection field outline", () => {
  test("maps visible schema fields and array rows to stable nested nodes", () => {
    const model = createCmsCollectionFieldOutline({
      collection,
      data,
      selectedFieldPath: "address.city",
      canWrite: true,
    });
    const flat = flattenCmsVisualOutline(model.items);

    expect(model.items.map(({ label }) => label)).toEqual([
      "Title",
      "Internal note",
      "Address",
      "Contributors",
      "Summary",
    ]);
    expect(model.items[2]?.children.map(({ label }) => label)).toEqual([
      "Street",
      "City",
    ]);
    expect(model.items[3]?.children.map(({ label }) => label)).toEqual([
      "Contributors 1",
      "Contributors 2",
    ]);
    expect(
      model.items[3]?.children[0]?.children.map(({ label }) => label),
    ).toEqual(["Name", "Email"]);
    expect(flat.find(({ selected }) => selected)?.label).toBe("City");
    expect(
      model.fieldPathByNodeId[model.nodeIdByFieldPath["contributors.1.email"]!],
    ).toBe("contributors.1.email");
    expect(flat.some(({ label }) => label === "Private title")).toBe(false);
  });

  test("exposes edit only for writable fields and never schema structure actions", () => {
    const writable = flattenCmsVisualOutline(
      createCmsCollectionFieldOutline({
        collection,
        data,
        selectedFieldPath: null,
        canWrite: true,
      }).items,
    );
    expect(writable.find(({ label }) => label === "Title")?.actions.edit).toBe(
      true,
    );
    expect(
      writable.find(({ label }) => label === "Internal note")?.actions.edit,
    ).toBe(false);
    expect(
      writable.find(({ label }) => label === "Summary")?.actions.edit,
    ).toBe(false);
    expect(
      writable.every(
        ({ actions }) =>
          !actions.insert &&
          !actions.move &&
          !actions.duplicate &&
          !actions.remove,
      ),
    ).toBe(true);

    const readOnly = flattenCmsVisualOutline(
      createCmsCollectionFieldOutline({
        collection,
        data,
        selectedFieldPath: null,
        canWrite: false,
      }).items,
    );
    expect(readOnly.every(({ actions }) => !actions.edit)).toBe(true);
  });
});
