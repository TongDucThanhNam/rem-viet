import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  assertSafeE2eStateDirectory,
  e2eStateDirectoryPrefix,
  localE2eResourceNames,
  localE2eWranglerConfig,
  parseLocalE2eInvocation,
} from "./e2e-local-lib";
import { manifestFor } from "./site-lib";

describe("isolated local E2E persistence", () => {
  const temporaryDirectory = join("C:\\", "temporary-fixtures");

  test("accepts only a generated state directory directly under the temp root", () => {
    const directory = join(
      temporaryDirectory,
      `${e2eStateDirectoryPrefix}generated123`,
    );

    expect(assertSafeE2eStateDirectory(directory, temporaryDirectory)).toBe(
      directory,
    );
  });

  test("rejects broad, nested and non-E2E deletion targets", () => {
    for (const directory of [
      temporaryDirectory,
      join(temporaryDirectory, e2eStateDirectoryPrefix),
      join(temporaryDirectory, "ordinary-directory"),
      join(
        temporaryDirectory,
        "nested",
        `${e2eStateDirectoryPrefix}generated123`,
      ),
    ]) {
      expect(() =>
        assertSafeE2eStateDirectory(directory, temporaryDirectory),
      ).toThrow(/unsafe E2E persistence directory/);
    }
  });

  test("separates the harness site argument from Playwright arguments", () => {
    expect(
      parseLocalE2eInvocation([
        "--site=acme-demo",
        "--project=desktop-chrome",
        "--grep",
        "media upload",
      ]),
    ).toEqual({
      site: "acme-demo",
      playwrightArguments: [
        "--project=desktop-chrome",
        "--grep",
        "media upload",
      ],
    });
    expect(parseLocalE2eInvocation([]).site).toBe("rem-viet");
    expect(() =>
      parseLocalE2eInvocation(["--site=acme", "--site=other"]),
    ).toThrow(/at most one/);
    expect(() => parseLocalE2eInvocation(["--site=../unsafe"])).toThrow(
      /safe client slug/,
    );
  });

  test("derives an isolated Worker, D1 and R2 configuration from the manifest", () => {
    const manifest = manifestFor("acme-demo", "showcase");
    const names = localE2eResourceNames(manifest);
    const config = localE2eWranglerConfig(manifest, {
      assets: "C:/repo/apps/web/dist/client",
      main: "C:/repo/apps/web/dist/server/index.js",
      migrations: "C:/repo/packages/db/src/migrations",
    });

    expect(names).toEqual({
      worker: "acme-demo-web-e2e",
      database: "acme-demo-db-e2e",
      bucket: "acme-demo-media-e2e",
    });
    expect(config.name).toBe(names.worker);
    expect(config.vars.RELEASE_SITE_ID).toBe("acme-demo");
    expect(config.d1_databases[0]).toMatchObject({
      binding: "DB",
      database_name: names.database,
    });
    expect(config.r2_buckets[0]).toMatchObject({
      binding: "PRODUCT_IMAGES",
      bucket_name: names.bucket,
    });
    expect(JSON.stringify(config)).not.toContain("rem-viet");
  });
});
