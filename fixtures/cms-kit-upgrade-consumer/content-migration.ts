import { createHash } from "node:crypto";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createCmsMigrationPlan,
  migrateCmsValue,
  type CmsCliMigrationBackup,
  type CmsCliMigrationDriver,
} from "@agency/cms-cli";

export const contentPath = resolve(import.meta.dir, "content.json");
export const backupPath = resolve(import.meta.dir, "content.v1.backup.json");
export const receiptPath = resolve(import.meta.dir, "migration.receipt.json");
const temporaryPath = resolve(import.meta.dir, "content.json.next");
const backupLocator = "file:content.v1.backup.json";

type Content = {
  schemaVersion: number;
  title: string;
  summary?: string;
};

async function readContent(path = contentPath) {
  return JSON.parse(await readFile(path, "utf8")) as Content;
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export const contentMigrationPlan = createCmsMigrationPlan({
  siteId: "independent-upgrade-fixture",
  stage: "production",
  target: "independent-upgrade-content",
  currentVersion: 1,
  targetVersion: 2,
  steps: [{ id: "0002-content-summary", from: 1, to: 2 }],
});

export function createContentMigrationDriver(): CmsCliMigrationDriver {
  return {
    inspectVersion: async () => (await readContent()).schemaVersion,
    createBackup: async () => {
      await copyFile(contentPath, backupPath);
      const bytes = await readFile(backupPath);
      return {
        locator: backupLocator,
        sha256: sha256(bytes),
        bytes: bytes.byteLength,
      };
    },
    applyStep: async (step) => {
      if (step.id !== "0002-content-summary") {
        throw new Error(`Unexpected content migration ${step.id}.`);
      }
      const content = await readContent();
      const migrated = migrateCmsValue({
        value: content,
        currentVersion: content.schemaVersion,
        targetVersion: step.to,
        migrations: [
          {
            from: 1,
            to: 2,
            migrate: (value) => ({
              ...value,
              schemaVersion: 2,
              summary: "Migrated safely",
            }),
          },
        ],
      });
      await writeFile(
        temporaryPath,
        `${JSON.stringify(migrated.value, null, 2)}\n`,
      );
      await rename(temporaryPath, contentPath);
    },
    restoreBackup: async (backup: CmsCliMigrationBackup) => {
      if (backup.locator !== backupLocator) {
        throw new Error("Rollback backup locator does not match the fixture.");
      }
      const bytes = await readFile(backupPath);
      if (
        bytes.byteLength !== backup.bytes ||
        sha256(bytes) !== backup.sha256
      ) {
        throw new Error("Rollback backup bytes do not match the receipt.");
      }
      await copyFile(backupPath, contentPath);
    },
  };
}
