import { resolve } from "node:path";

import { verifyBackupArtifact } from "./cms-backup-lib";
import { argument, repoRoot } from "./site-lib";

const source = argument("file");
if (!source) throw new Error("Thiếu --file=<backup.sqlite|export.sql>.");
const absoluteSource = resolve(repoRoot, source);
const result = await verifyBackupArtifact(absoluteSource);
console.log(
  JSON.stringify(
    {
      ok: true,
      source: absoluteSource,
      ...result,
    },
    null,
    2,
  ),
);
