import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

type NativeImage = Readonly<{
  asset?: Readonly<{ _ref?: unknown }>;
  crop?: unknown;
  hotspot?: unknown;
}>;

type ImageHost = {
  nativeAsset?: NativeImage;
  src?: unknown;
  mediaId?: unknown;
};

export function materializeRemVietSanityImages(
  value: unknown,
  config: Readonly<{ projectId: string; dataset: string }>,
) {
  if (!isRecord(value)) return value;
  const builder = createImageUrlBuilder(config);
  const content = { ...value };

  if (isRecord(content.seo)) {
    const seo = { ...content.seo };
    const nativeAsset = readNativeImage(seo.ogImageAsset);
    if (nativeAsset) {
      seo.ogImage = buildImageUrl(builder, nativeAsset, 1200, 630);
    }
    content.seo = seo;
  }

  if (Array.isArray(content.blocks)) {
    content.blocks = content.blocks.map((block) => {
      if (!isRecord(block) || !isRecord(block.data)) return block;
      const data = { ...block.data };
      if (!isRecord(data.background)) return block;
      const background = { ...data.background } as ImageHost &
        Record<string, unknown>;
      const nativeAsset = readNativeImage(background.nativeAsset);
      if (!nativeAsset) return block;
      background.src = buildImageUrl(builder, nativeAsset, 2400, 1350);
      background.mediaId = nativeAsset.asset?._ref;
      data.background = background;
      return { ...block, data };
    });
  }

  return content;
}

function buildImageUrl(
  builder: ReturnType<typeof createImageUrlBuilder>,
  image: NativeImage,
  width: number,
  height: number,
) {
  return builder
    .image(image as SanityImageSource)
    .width(width)
    .height(height)
    .fit("crop")
    .auto("format")
    .quality(85)
    .url();
}

function readNativeImage(value: unknown): NativeImage | null {
  if (!isRecord(value) || !isRecord(value.asset)) return null;
  const reference = value.asset._ref;
  if (typeof reference !== "string" || !reference.startsWith("image-")) {
    return null;
  }
  return value as NativeImage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
