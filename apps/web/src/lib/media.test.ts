import { describe, expect, it } from "bun:test";

import { validateMediaFile } from "./media";

function imageFile(bytes: number[], type: string, name = "asset.bin") {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("media magic-byte validation", () => {
  it("accepts a JPEG whose signature matches its MIME", async () => {
    await expect(
      validateMediaFile(imageFile([0xff, 0xd8, 0xff, 0xdb], "image/jpeg")),
    ).resolves.toBeUndefined();
  });

  it("accepts PNG, GIF, WEBP and AVIF signatures", async () => {
    const cases = [
      imageFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"),
      imageFile([...new TextEncoder().encode("GIF89a")], "image/gif"),
      imageFile([...new TextEncoder().encode("RIFF0000WEBP")], "image/webp"),
      imageFile(
        [0, 0, 0, 24, ...new TextEncoder().encode("ftypavif")],
        "image/avif",
      ),
    ];

    await Promise.all(cases.map((file) => validateMediaFile(file)));
  });

  it("rejects renamed or spoofed image files", async () => {
    await expect(
      validateMediaFile(
        new File(["<script>alert(1)</script>"], "payload.png", {
          type: "image/png",
        }),
      ),
    ).rejects.toThrow("không khớp MIME");
  });

  it("rejects unsupported MIME types before inspecting bytes", async () => {
    await expect(
      validateMediaFile(imageFile([0xff, 0xd8, 0xff], "image/svg+xml")),
    ).rejects.toThrow("Chỉ hỗ trợ");
  });
});
