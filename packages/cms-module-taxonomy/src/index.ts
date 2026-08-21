import {
  defineCmsExtensionPackageManifest,
  defineCmsFeatureModuleManifest,
  defineCollection,
  defineFeatureModule,
  numberField,
  textField,
} from "@agency/cms-core";

export const cmsTaxonomyExtensionManifest = defineCmsExtensionPackageManifest({
  schemaVersion: 1,
  id: "official/taxonomy",
  packageName: "@agency/cms-module-taxonomy",
  version: "0.1.0",
  classification: "official",
  cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
  permissions: [
    {
      id: "official/taxonomy/manage",
      capability: "settings.manage",
      description: "Manage nested documents, terms, order, and breadcrumbs.",
    },
  ],
  secrets: [],
  routes: [],
  admin: [
    {
      id: "official/taxonomy/navigation",
      slot: "navigation",
      label: "Taxonomies",
      requiredCapability: "settings.manage",
    },
    {
      id: "official/taxonomy/list",
      slot: "list",
      label: "Hierarchy tree",
      requiredCapability: "settings.manage",
    },
  ],
  entrypoints: [
    {
      id: "official/taxonomy/shared",
      export: ".",
      runtime: "shared",
      capabilities: [],
    },
  ],
  data: {
    schemaVersion: 1,
    migrations: [
      { id: "official/taxonomy/v1", from: 0, to: 1, reversible: false },
    ],
    uninstall: {
      policy: "retain",
      description:
        "Retain canonical hierarchy and term assignments until an explicit export and purge.",
    },
  },
});

const access = {
  read: [] as const,
  create: ["settings.manage"] as const,
  update: ["settings.manage"] as const,
  delete: ["settings.manage"] as const,
  publish: ["settings.manage"] as const,
};

export const cmsTaxonomyTermsCollection = defineCollection({
  slug: "cms-taxonomy-terms",
  labels: { singular: "Taxonomy term", plural: "Taxonomy terms" },
  schemaVersion: 1,
  lifecycle: { drafts: true, revisions: true, scheduling: false },
  access,
  fields: [
    textField({ name: "taxonomy", label: "Taxonomy", required: true }),
    textField({ name: "label", label: "Label", required: true }),
    textField({ name: "slug", label: "Slug", required: true, indexed: true }),
    textField({ name: "parentId", label: "Parent id" }),
    numberField({
      name: "order",
      label: "Order",
      required: true,
      defaultValue: 0,
      validation: { min: 0, integer: true },
    }),
  ],
  admin: {
    useAsTitle: "label",
    defaultColumns: ["taxonomy", "label", "slug", "parentId", "order"],
  },
});

export const cmsTaxonomyModule = defineFeatureModule({
  id: "official-taxonomy",
  manifest: defineCmsFeatureModuleManifest({
    schemaVersion: 1,
    packageName: "@agency/cms-module-taxonomy",
    version: "0.1.0",
    cmsCompatibility: { minimum: "0.1.0", maximumExclusive: "1.0.0" },
    uninstall: {
      dataPolicy: "retain",
      description:
        "Retain canonical hierarchy and term assignments until an explicit export and purge.",
    },
  }),
  collections: [cmsTaxonomyTermsCollection],
  permissions: [
    {
      id: "official-taxonomy/manage",
      capability: "settings.manage",
      collection: cmsTaxonomyTermsCollection.slug,
      operations: ["create", "update", "delete"],
    },
  ],
  migrations: [
    {
      id: "official-taxonomy/v1",
      from: 0,
      to: 1,
      migrate: (state) => state ?? [],
    },
  ],
  admin: [
    {
      id: "official-taxonomy/navigation",
      collection: cmsTaxonomyTermsCollection.slug,
      placement: "navigation",
      label: "Taxonomies",
    },
    {
      id: "official-taxonomy/list",
      collection: cmsTaxonomyTermsCollection.slug,
      placement: "list",
      label: "Hierarchy tree",
    },
  ],
});

export type CmsTaxonomyNode = Readonly<{
  id: string;
  taxonomy: string;
  label: string;
  slug: string;
  parentId: string | null;
  order: number;
}>;

const keyPattern = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanNode(input: CmsTaxonomyNode): CmsTaxonomyNode {
  const id = input.id.trim();
  const taxonomy = input.taxonomy.trim();
  const label = input.label.trim();
  const slug = input.slug.trim().toLowerCase();
  const parentId = input.parentId?.trim() || null;
  if (!keyPattern.test(id)) throw new Error(`Invalid taxonomy node id: ${id}.`);
  if (!keyPattern.test(taxonomy))
    throw new Error(`Invalid taxonomy key: ${taxonomy}.`);
  if (!label || label.length > 160)
    throw new Error(`Invalid taxonomy label for ${id}.`);
  if (!slugPattern.test(slug) || slug.length > 120)
    throw new Error(`Invalid taxonomy slug for ${id}.`);
  if (!Number.isInteger(input.order) || input.order < 0)
    throw new Error(`Invalid taxonomy order for ${id}.`);
  return Object.freeze({
    id,
    taxonomy,
    label,
    slug,
    parentId,
    order: input.order,
  });
}

export function normalizeCmsTaxonomyTree(
  input: readonly CmsTaxonomyNode[],
  options: { maximumNodes?: number; maximumDepth?: number } = {},
) {
  const maximumNodes = options.maximumNodes ?? 10_000;
  const maximumDepth = options.maximumDepth ?? 32;
  if (input.length > maximumNodes)
    throw new Error(`Taxonomy tree exceeds ${maximumNodes} nodes.`);
  const nodes = input.map(cleanNode);
  const byId = new Map<string, CmsTaxonomyNode>();
  for (const node of nodes) {
    if (byId.has(node.id))
      throw new Error(`Duplicate taxonomy node: ${node.id}.`);
    byId.set(node.id, node);
  }
  for (const node of nodes) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent) throw new Error(`Missing taxonomy parent: ${node.parentId}.`);
    if (parent.taxonomy !== node.taxonomy)
      throw new Error(
        `Taxonomy node ${node.id} cannot cross taxonomy boundaries.`,
      );
  }
  for (const node of nodes) {
    const visited = new Set<string>();
    let current: CmsTaxonomyNode | undefined = node;
    let depth = 0;
    while (current?.parentId) {
      if (visited.has(current.id))
        throw new Error(`Taxonomy cycle includes ${current.id}.`);
      visited.add(current.id);
      depth += 1;
      if (depth > maximumDepth)
        throw new Error(
          `Taxonomy node ${node.id} exceeds depth ${maximumDepth}.`,
        );
      current = byId.get(current.parentId);
    }
  }

  const groups = new Map<string, CmsTaxonomyNode[]>();
  for (const node of nodes) {
    const groupKey = `${node.taxonomy}\u0000${node.parentId ?? ""}`;
    const siblings = groups.get(groupKey) ?? [];
    if (siblings.some(({ slug }) => slug === node.slug))
      throw new Error(`Duplicate sibling taxonomy slug: ${node.slug}.`);
    siblings.push(node);
    groups.set(groupKey, siblings);
  }
  const normalized = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, siblings]) =>
      siblings
        .sort(
          (left, right) =>
            left.order - right.order ||
            left.label.localeCompare(right.label) ||
            left.id.localeCompare(right.id),
        )
        .map((node, order) => Object.freeze({ ...node, order })),
    );
  return Object.freeze(normalized);
}

export function createCmsTaxonomyIndex(input: readonly CmsTaxonomyNode[]) {
  const nodes = normalizeCmsTaxonomyTree(input);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, readonly CmsTaxonomyNode[]>();
  for (const node of nodes) {
    const key = `${node.taxonomy}\u0000${node.parentId ?? ""}`;
    childrenByParent.set(
      key,
      Object.freeze([...(childrenByParent.get(key) ?? []), node]),
    );
  }
  return Object.freeze({
    nodes,
    get(id: string) {
      return byId.get(id) ?? null;
    },
    roots(taxonomy: string) {
      return childrenByParent.get(`${taxonomy}\u0000`) ?? Object.freeze([]);
    },
    children(id: string) {
      const node = byId.get(id);
      if (!node) throw new Error(`Unknown taxonomy node: ${id}.`);
      return (
        childrenByParent.get(`${node.taxonomy}\u0000${id}`) ?? Object.freeze([])
      );
    },
    breadcrumbs(id: string) {
      const path: CmsTaxonomyNode[] = [];
      let node = byId.get(id);
      if (!node) throw new Error(`Unknown taxonomy node: ${id}.`);
      while (node) {
        path.unshift(node);
        node = node.parentId ? byId.get(node.parentId) : undefined;
      }
      return Object.freeze(path);
    },
    descendantIds(id: string) {
      if (!byId.has(id)) throw new Error(`Unknown taxonomy node: ${id}.`);
      const descendants: string[] = [];
      const visit = (parentId: string) => {
        const parent = byId.get(parentId)!;
        for (const child of childrenByParent.get(
          `${parent.taxonomy}\u0000${parentId}`,
        ) ?? []) {
          descendants.push(child.id);
          visit(child.id);
        }
      };
      visit(id);
      return Object.freeze(descendants);
    },
  });
}

export function moveCmsTaxonomyNode(
  input: readonly CmsTaxonomyNode[],
  move: Readonly<{ id: string; parentId: string | null; index: number }>,
) {
  const nodes = normalizeCmsTaxonomyTree(input);
  const index = createCmsTaxonomyIndex(nodes);
  const node = index.get(move.id);
  if (!node) throw new Error(`Unknown taxonomy node: ${move.id}.`);
  const parent = move.parentId ? index.get(move.parentId) : null;
  if (move.parentId && !parent)
    throw new Error(`Unknown taxonomy parent: ${move.parentId}.`);
  if (parent && parent.taxonomy !== node.taxonomy)
    throw new Error("Taxonomy moves cannot cross taxonomy boundaries.");
  if (
    move.parentId === node.id ||
    index.descendantIds(node.id).includes(move.parentId ?? "")
  )
    throw new Error("Taxonomy moves cannot create a cycle.");

  const remaining = nodes.filter(({ id }) => id !== node.id);
  const targetSiblings = remaining
    .filter(
      (candidate) =>
        candidate.taxonomy === node.taxonomy &&
        candidate.parentId === move.parentId,
    )
    .sort((left, right) => left.order - right.order);
  if (
    !Number.isInteger(move.index) ||
    move.index < 0 ||
    move.index > targetSiblings.length
  )
    throw new Error("Taxonomy move index is out of range.");
  targetSiblings.splice(move.index, 0, { ...node, parentId: move.parentId });
  const targetOrder = new Map(
    targetSiblings.map(({ id }, order) => [id, order]),
  );
  const result = [
    ...remaining.map((candidate) =>
      targetOrder.has(candidate.id)
        ? { ...candidate, order: targetOrder.get(candidate.id)! }
        : candidate,
    ),
    {
      ...node,
      parentId: move.parentId,
      order: targetOrder.get(node.id)!,
    },
  ];
  return normalizeCmsTaxonomyTree(result);
}
