import { describe, expect, test } from "bun:test";
import type { SiteManifest } from "@rem-viet/cms";

import {
  buildOrganizationStructuredData,
  serializeStructuredData,
} from "./structured-data";

const manifest: SiteManifest = {
  id: "example-site",
  name: "Example Site",
  siteUrl: "https://example.com",
  description: "Example description",
  locale: "vi-VN",
  preset: "showcase",
  brand: { logo: "/logo.svg", colors: {}, fonts: ["sans-serif"] },
  contact: {
    phone: "",
    email: "",
    address: "",
    socials: { facebook: "https://facebook.com/example" },
  },
  features: { blog: true, catalog: false, orders: false, leads: true },
  infrastructure: {
    alchemyApp: "example-site",
    workerName: "example-web",
    d1Name: "example-db",
    r2BucketName: "example-media",
    backupBucketName: "example-backups",
  },
};

describe("structured data serialization", () => {
  test("escapes markup that could terminate the script element", () => {
    const source = { name: "</script><script>alert(1)</script>" };
    const serialized = serializeStructuredData(source);

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(source);
  });

  test("uses CMS contact settings and keeps sameAs web-only", () => {
    expect(
      buildOrganizationStructuredData(manifest, {
        address: "123 Example Street",
        logo: "/api/media/logo.png",
        phone: "0123456789",
        socials: {
          facebook: "https://facebook.com/updated",
          support: "mailto:support@example.com",
        },
      }),
    ).toMatchObject({
      "@type": "Organization",
      address: "123 Example Street",
      logo: "https://example.com/api/media/logo.png",
      sameAs: ["https://facebook.com/updated"],
      telephone: "0123456789",
    });
  });
});
