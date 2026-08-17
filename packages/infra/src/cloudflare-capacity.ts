export type CapacityDatabase = {
  id: string;
  name: string;
  createdAt?: string;
  fileSize?: number;
  numTables?: number;
};

export type CapacityManifest = {
  id: string;
  d1Name: string;
};

export type ClassifiedDatabase = CapacityDatabase & {
  classification: "managed" | "unrecognized";
  manifestId?: string;
  stage?: "staging" | "production";
};

export type CapacityReport = {
  used: number;
  limit: number;
  remaining: number;
  requiredSlots: number;
  slotDeficit: number;
  databases: ClassifiedDatabase[];
  unrecognized: number;
};

const managedStages = ["staging", "production"] as const;

export function buildCapacityReport(input: {
  databases: CapacityDatabase[];
  manifests: CapacityManifest[];
  limit?: number;
  requiredSlots?: number;
}): CapacityReport {
  const limit = input.limit ?? 10;
  const requiredSlots = input.requiredSlots ?? 2;
  const expected = new Map<
    string,
    { manifestId: string; stage: (typeof managedStages)[number] }
  >();

  for (const manifest of input.manifests) {
    for (const stage of managedStages) {
      expected.set(`${manifest.d1Name}-${stage}`, {
        manifestId: manifest.id,
        stage,
      });
    }
  }

  const databases = input.databases
    .map((database): ClassifiedDatabase => {
      const match = expected.get(database.name);
      return match
        ? {
            ...database,
            classification: "managed",
            manifestId: match.manifestId,
            stage: match.stage,
          }
        : { ...database, classification: "unrecognized" };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const remaining = Math.max(0, limit - databases.length);

  return {
    used: databases.length,
    limit,
    remaining,
    requiredSlots,
    slotDeficit: Math.max(0, requiredSlots - remaining),
    databases,
    unrecognized: databases.filter(
      (database) => database.classification === "unrecognized",
    ).length,
  };
}
