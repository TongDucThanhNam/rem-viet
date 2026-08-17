import { readFile } from "node:fs/promises";

import {
  rollbackCmsMigration,
  type CmsCliMigrationReceipt,
} from "@agency/cms-cli";

import {
  contentMigrationPlan,
  createContentMigrationDriver,
  receiptPath,
} from "./content-migration";

const receipt = JSON.parse(
  await readFile(receiptPath, "utf8"),
) as CmsCliMigrationReceipt;
const rollback = await rollbackCmsMigration(
  contentMigrationPlan,
  receipt,
  createContentMigrationDriver(),
  { confirmation: contentMigrationPlan.rollbackConfirmation },
);
console.log(
  JSON.stringify({
    ok: true,
    restoredSchemaVersion: rollback.restoredVersion,
    backupSha256: rollback.backup.sha256,
  }),
);
