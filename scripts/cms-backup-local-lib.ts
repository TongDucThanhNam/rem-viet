import { verifyBackupArtifact } from "./cms-backup-lib";

export type LocalCmsDatabaseCandidate = {
  path: string;
  modifiedAt: number;
};

export async function selectNewestRestorableCmsDatabase(
  candidates: LocalCmsDatabaseCandidate[],
): Promise<LocalCmsDatabaseCandidate | undefined> {
  const verified = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await verifyBackupArtifact(candidate.path);
        return candidate;
      } catch {
        return undefined;
      }
    }),
  );

  return verified
    .filter(
      (candidate): candidate is LocalCmsDatabaseCandidate =>
        candidate !== undefined,
    )
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0];
}
