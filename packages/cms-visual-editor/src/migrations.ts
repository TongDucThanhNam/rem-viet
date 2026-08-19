import type {
  CmsVisualComponentRegistry,
  CmsVisualDocument,
  CmsVisualNode,
} from "./registry.js";
import { parseCmsVisualDocument } from "./registry.js";

export type CmsVisualDocumentMigration = Readonly<{
  id: string;
  from: number;
  to: number;
  migrate: (document: CmsVisualDocument) => CmsVisualDocument;
}>;

export type CmsVisualMigrationRegistry = Readonly<{
  currentVersion: number;
  migrations: readonly CmsVisualDocumentMigration[];
}>;

export function createCmsVisualMigrationRegistry(input: {
  currentVersion: number;
  migrations?: readonly CmsVisualDocumentMigration[];
}): CmsVisualMigrationRegistry {
  if (!Number.isSafeInteger(input.currentVersion) || input.currentVersion < 1) {
    throw new Error(
      "Visual document currentVersion must be a positive integer.",
    );
  }
  const sorted = [...(input.migrations ?? [])].sort(
    (left, right) => left.from - right.from,
  );
  const ids = new Set<string>();
  const fromVersions = new Set<number>();
  for (const migration of sorted) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(migration.id)) {
      throw new Error(`Invalid visual document migration ID: ${migration.id}`);
    }
    if (ids.has(migration.id))
      throw new Error(`Duplicate visual migration ID: ${migration.id}`);
    if (fromVersions.has(migration.from)) {
      throw new Error(
        `Duplicate visual migration from version ${migration.from}.`,
      );
    }
    if (migration.to !== migration.from + 1) {
      throw new Error(
        `Visual migration ${migration.id} must advance exactly one version.`,
      );
    }
    if (migration.from < 1 || migration.to > input.currentVersion) {
      throw new Error(
        `Visual migration ${migration.id} is outside the supported version range.`,
      );
    }
    ids.add(migration.id);
    fromVersions.add(migration.from);
  }
  for (let version = 1; version < input.currentVersion; version += 1) {
    if (!fromVersions.has(version)) {
      throw new Error(
        `Missing visual document migration from version ${version}.`,
      );
    }
  }
  return Object.freeze({
    currentVersion: input.currentVersion,
    migrations: Object.freeze(sorted),
  });
}

export function migrateCmsVisualDocument<TNode extends CmsVisualNode>(input: {
  document: CmsVisualDocument<TNode>;
  migrations: CmsVisualMigrationRegistry;
  components: CmsVisualComponentRegistry;
}): CmsVisualDocument {
  if (input.document.schemaVersion > input.migrations.currentVersion) {
    throw new Error(
      `Visual document schema ${input.document.schemaVersion} is newer than supported ${input.migrations.currentVersion}.`,
    );
  }
  let current: CmsVisualDocument = input.document;
  while (current.schemaVersion < input.migrations.currentVersion) {
    const migration = input.migrations.migrations.find(
      (candidate) => candidate.from === current.schemaVersion,
    );
    if (!migration) {
      throw new Error(
        `Missing visual document migration from ${current.schemaVersion}.`,
      );
    }
    const next = migration.migrate(current);
    if (next.schemaVersion !== migration.to) {
      throw new Error(
        `Visual migration ${migration.id} returned schema ${next.schemaVersion}; expected ${migration.to}.`,
      );
    }
    if (next.id !== current.id || next.siteId !== current.siteId) {
      throw new Error(
        `Visual migration ${migration.id} changed document identity.`,
      );
    }
    current = next;
  }
  return parseCmsVisualDocument(current, input.components);
}
