export type D1InventoryDatabase = {
  id: string;
  name: string;
  numTables?: number;
  createdAt?: string;
};

export type D1WorkerReference = {
  worker: string;
  binding: string;
  databaseId: string;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseD1Inventory(result: unknown): D1InventoryDatabase[] {
  if (!Array.isArray(result)) {
    throw new Error("Cloudflare D1 inventory result must be an array.");
  }

  return result.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Cloudflare D1 inventory contains an invalid entry.");
    }
    const id = typeof entry.uuid === "string" ? entry.uuid.trim() : "";
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!id || !name) {
      throw new Error(
        "Cloudflare D1 inventory entry is missing its ID or name.",
      );
    }

    const rawNumTables = entry.numTables ?? entry.num_tables;
    const numTables =
      typeof rawNumTables === "number" &&
      Number.isSafeInteger(rawNumTables) &&
      rawNumTables >= 0
        ? rawNumTables
        : undefined;
    const rawCreatedAt = entry.createdAt ?? entry.created_at;
    const createdAt =
      typeof rawCreatedAt === "string" && rawCreatedAt.trim()
        ? rawCreatedAt
        : undefined;

    return { id, name, numTables, createdAt };
  });
}

export function parseWorkerNames(result: unknown): string[] {
  if (!Array.isArray(result)) {
    throw new Error("Cloudflare Worker inventory result must be an array.");
  }

  const names = result.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id.trim()) {
      throw new Error("Cloudflare Worker inventory contains an invalid entry.");
    }
    return entry.id.trim();
  });
  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

export function parseWorkerD1References(
  worker: string,
  result: unknown,
): D1WorkerReference[] {
  if (!isRecord(result)) {
    throw new Error(
      `Cloudflare Worker settings for ${worker} must be an object.`,
    );
  }
  if (result.bindings === undefined) return [];
  if (!Array.isArray(result.bindings)) {
    throw new Error(
      `Cloudflare Worker bindings for ${worker} must be an array.`,
    );
  }

  const references: D1WorkerReference[] = [];
  for (const binding of result.bindings) {
    if (!isRecord(binding) || binding.type !== "d1") continue;
    const databaseId =
      typeof binding.databaseId === "string" && binding.databaseId.trim()
        ? binding.databaseId.trim()
        : typeof binding.database_id === "string" && binding.database_id.trim()
          ? binding.database_id.trim()
          : typeof binding.id === "string" && binding.id.trim()
            ? binding.id.trim()
            : "";
    const name =
      typeof binding.name === "string" && binding.name.trim()
        ? binding.name.trim()
        : "UNKNOWN_BINDING";
    if (!databaseId) {
      throw new Error(
        `Cloudflare Worker ${worker} has a D1 binding without a database ID.`,
      );
    }
    references.push({ worker, binding: name, databaseId });
  }

  return references.sort(
    (left, right) =>
      left.worker.localeCompare(right.worker) ||
      left.binding.localeCompare(right.binding),
  );
}

export function buildD1ReferenceReport(input: {
  databases: D1InventoryDatabase[];
  references: D1WorkerReference[];
}) {
  return input.databases
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((database) => {
      const workerBindings = input.references
        .filter((reference) => reference.databaseId === database.id)
        .map(({ worker, binding }) => ({ worker, binding }));
      return {
        name: database.name,
        idPrefix: database.id.slice(0, 8),
        numTables: database.numTables ?? null,
        createdAt: database.createdAt ?? null,
        workerBindings,
        reviewState:
          workerBindings.length > 0
            ? ("BLOCKED_ACTIVE_WORKER_BINDING" as const)
            : database.numTables === 0
              ? ("UNBOUND_OWNER_REVIEW_REQUIRED" as const)
              : ("UNBOUND_DATA_BACKUP_REQUIRED" as const),
        deletionAuthorized: false as const,
      };
    });
}

export function buildZeroTableReferenceReport(input: {
  databases: D1InventoryDatabase[];
  references: D1WorkerReference[];
}) {
  return buildD1ReferenceReport(input).filter(
    (database) => database.numTables === 0,
  );
}

export function selectEmptyUnboundD1ForDeletion(input: {
  requestedName: string;
  confirmation: string;
  databases: D1InventoryDatabase[];
  references: D1WorkerReference[];
}) {
  const requestedName = input.requestedName.trim();
  if (!requestedName) {
    throw new Error("A non-empty D1 database name is required.");
  }
  if (input.confirmation !== requestedName) {
    throw new Error(
      `Deletion confirmation must exactly match the database name: ${requestedName}`,
    );
  }

  const matches = input.databases.filter(
    (database) => database.name === requestedName,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one D1 database named ${requestedName}; found ${matches.length}.`,
    );
  }

  const database = matches[0]!;
  if (database.numTables !== 0) {
    throw new Error(
      `D1 database ${requestedName} is not proven empty; observed table count: ${database.numTables ?? "unknown"}.`,
    );
  }
  const activeReferences = input.references.filter(
    (reference) => reference.databaseId === database.id,
  );
  if (activeReferences.length > 0) {
    throw new Error(
      `D1 database ${requestedName} is still bound to ${activeReferences.length} Worker binding(s).`,
    );
  }

  return database;
}
