import { rename, writeFile } from "node:fs/promises";

import { executeCmsMigrationPlan } from "@agency/cms-cli";

import {
  contentMigrationPlan,
  createContentMigrationDriver,
  receiptPath,
} from "./content-migration";

const receipt = await executeCmsMigrationPlan(
  contentMigrationPlan,
  createContentMigrationDriver(),
  { confirmation: contentMigrationPlan.applyConfirmation },
);
const temporaryReceiptPath = `${receiptPath}.next`;
await writeFile(temporaryReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
await rename(temporaryReceiptPath, receiptPath);
console.log(
  JSON.stringify({
    ok: true,
    applied: receipt.appliedStepIds,
    backupSha256: receipt.backup.sha256,
    receipt: "migration.receipt.json",
  }),
);
