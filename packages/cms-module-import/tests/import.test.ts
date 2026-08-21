import { describe, expect, test } from "bun:test";

import {
  cmsImportExtensionManifest,
  cmsImportModule,
  createCmsImportPlan,
  executeCmsImportPlan,
  exportCmsImportPlanJson,
  parseCmsWordPressWxr,
} from "../src";

const wxr = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Launch & guide]]></title><wp:post_id>9</wp:post_id><wp:post_type>post</wp:post_type><wp:post_name>launch-guide</wp:post_name><wp:status>publish</wp:status><wp:post_date_gmt>2026-08-20 01:02:03</wp:post_date_gmt><dc:creator><![CDATA[editor]]></dc:creator><content:encoded><![CDATA[<p>Hello</p>]]></content:encoded><excerpt:encoded><![CDATA[Hello]]></excerpt:encoded><category domain="category" nicename="news"><![CDATA[News]]></category><category domain="post_tag" nicename="launch"><![CDATA[Launch]]></category></item>
<item><title>Media</title><wp:post_id>10</wp:post_id><wp:post_type>attachment</wp:post_type></item>
</channel></rss>`;

describe("official import module", () => {
  test("owns lifecycle metadata and parses bounded WordPress WXR without entity expansion", () => {
    expect(cmsImportModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-import",
      uninstall: { dataPolicy: "retain" },
    });
    expect(cmsImportExtensionManifest).toMatchObject({
      id: "official/import",
      routes: [{ mutationProtection: "same-origin" }],
      entrypoints: [{ runtime: "server" }],
    });
    const source = parseCmsWordPressWxr(wxr);
    expect(source.documents[0]).toMatchObject({
      sourceId: "wordpress:9",
      documentType: "post",
      status: "published",
      categories: ["news"],
      tags: ["launch"],
    });
    expect(source.warnings[0]).toContain("attachment");
    expect(() =>
      parseCmsWordPressWxr('<!DOCTYPE x [<!ENTITY a "boom">]><rss/>'),
    ).toThrow("forbidden");
  });

  test("plans conflicts, dry-runs, checkpoints, and resumes deterministic batches", async () => {
    const source = parseCmsWordPressWxr(wxr);
    const skipped = await createCmsImportPlan({
      planId: "import-plan-1",
      source,
      existingSourceIds: ["wordpress:9"],
      conflictPolicy: "skip",
    });
    expect(skipped.actions[0]?.operation).toBe("skip");
    const dryRun = await executeCmsImportPlan({
      plan: skipped,
      dryRun: true,
      applyBatch: () => {
        throw new Error("dry-run must not mutate");
      },
    });
    expect(dryRun).toMatchObject({ applied: 0, skipped: 1 });

    const plan = await createCmsImportPlan({
      planId: "import-plan-2",
      source,
      existingSourceIds: ["wordpress:9"],
      conflictPolicy: "overwrite",
    });
    const applied: string[] = [];
    const checkpoints: number[] = [];
    const receipt = await executeCmsImportPlan({
      plan,
      dryRun: false,
      batchSize: 1,
      applyBatch: (actions) =>
        applied.push(...actions.map(({ document }) => document.sourceId)),
      onCheckpoint: ({ nextActionIndex }) => checkpoints.push(nextActionIndex),
    });
    expect(applied).toEqual(["wordpress:9"]);
    expect(checkpoints).toEqual([1]);
    expect(receipt.checkpoint.nextActionIndex).toBe(1);
    expect(exportCmsImportPlanJson(plan)).toContain('"sourceSha256"');
    await expect(
      executeCmsImportPlan({
        plan,
        dryRun: false,
        checkpoint: { ...receipt.checkpoint, sourceSha256: "0".repeat(64) },
        applyBatch: () => {},
      }),
    ).rejects.toThrow("does not match");
  });
});
