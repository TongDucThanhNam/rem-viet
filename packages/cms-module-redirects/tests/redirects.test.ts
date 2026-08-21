import { describe, expect, test } from "bun:test";
import {
  cmsRedirectsExtensionManifest,
  cmsRedirectsModule,
  exportCmsRedirectsCsv,
  exportCmsRedirectsJson,
  importCmsRedirectsCsv,
  importCmsRedirectsJson,
  normalizeCmsRedirectRule,
  validateCmsRedirectGraph,
} from "../src";

describe("official redirects module", () => {
  test("owns install metadata and rejects unsafe, duplicate, and looping routes", () => {
    expect(cmsRedirectsModule.manifest).toMatchObject({
      packageName: "@agency/cms-module-redirects",
      uninstall: { dataPolicy: "retain" },
    });
    expect(cmsRedirectsExtensionManifest).toMatchObject({
      id: "official/redirects",
      classification: "official",
      data: { uninstall: { policy: "retain" } },
    });
    expect(() =>
      normalizeCmsRedirectRule({
        fromPath: "//evil.test",
        to: "/",
        statusCode: 301,
      }),
    ).toThrow("Unsafe");
    expect(() =>
      normalizeCmsRedirectRule({
        fromPath: "/a",
        to: "javascript:alert(1)",
        statusCode: 301,
      }),
    ).toThrow("Unsafe");
    expect(() =>
      validateCmsRedirectGraph([
        normalizeCmsRedirectRule({ fromPath: "/a", to: "/b", statusCode: 301 }),
        normalizeCmsRedirectRule({ fromPath: "/b", to: "/a", statusCode: 302 }),
      ]),
    ).toThrow("Redirect loop");
  });

  test("round-trips deterministic CSV and JSON", () => {
    const rules = [
      normalizeCmsRedirectRule({
        fromPath: "/old",
        to: "/new?campaign=a,b",
        statusCode: 308,
      }),
      normalizeCmsRedirectRule({
        fromPath: "/external",
        to: "https://example.com/path",
        statusCode: 302,
        enabled: false,
      }),
    ];
    expect(importCmsRedirectsCsv(exportCmsRedirectsCsv(rules))).toEqual(
      validateCmsRedirectGraph(rules),
    );
    expect(importCmsRedirectsJson(exportCmsRedirectsJson(rules))).toEqual(
      validateCmsRedirectGraph(rules),
    );
  });
});
