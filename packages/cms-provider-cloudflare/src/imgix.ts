import { CmsError } from "@agency/cms-core";
import type {
  CmsDamTransformAdapter,
  CmsDamVariantJob,
} from "@agency/cms-runtime";

export type ImgixMd5Signer = (
  signatureBase: string,
) => string | Promise<string>;

export type ImgixDamTransformAdapterOptions = Readonly<{
  domain: string;
  /** Required for signed sources. Kept server-side and never added to URLs. */
  secureUrlToken?: string;
  /** Inject an edge-compatible MD5 implementation when secureUrlToken is set. */
  signMd5?: ImgixMd5Signer;
  /** Unsigned URLs require an explicit opt-in for S3/Web Folder sources. */
  allowUnsigned?: boolean;
}>;

function invalid(message: string): never {
  throw new CmsError({
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
  });
}

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase();
  if (
    !domain ||
    domain.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) ||
    domain.includes("..")
  ) {
    return invalid("Imgix domain must be a hostname without a scheme or path.");
  }
  return domain;
}

function encodeAssetPath(key: string) {
  const segments = key.replace(/^\/+/, "").split("/");
  if (
    !segments.length ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0"),
    )
  ) {
    return invalid("Imgix asset key contains an unsafe path segment.");
  }
  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function variantParameters(job: CmsDamVariantJob) {
  const parameters = new URLSearchParams();
  if (job.variant.fit === "crop" || job.variant.fit === "cover") {
    parameters.set("fit", "crop");
    if (job.asset.focalPoint) {
      parameters.set("crop", "focalpoint");
      parameters.set("fp-x", String(job.asset.focalPoint.x));
      parameters.set("fp-y", String(job.asset.focalPoint.y));
    }
  } else {
    parameters.set("fit", "clip");
  }
  parameters.set(
    "fm",
    job.variant.format === "jpeg" ? "jpg" : job.variant.format,
  );
  if (job.variant.height !== null)
    parameters.set("h", String(job.variant.height));
  if (job.variant.width !== null)
    parameters.set("w", String(job.variant.width));
  parameters.sort();
  return parameters.toString();
}

/**
 * External Imgix URL-transform adapter. It follows Imgix's encoded path/query
 * contract and keeps the secure token behind an injected server-side signer.
 */
export function createImgixDamTransformAdapter(
  options: ImgixDamTransformAdapterOptions,
): CmsDamTransformAdapter {
  const domain = normalizeDomain(options.domain);
  const token = options.secureUrlToken?.trim();
  if (token && !options.signMd5) {
    invalid("Signed Imgix URLs require an MD5 signer.");
  }
  if (!token && !options.allowUnsigned) {
    invalid("Unsigned Imgix URLs require allowUnsigned: true.");
  }
  return Object.freeze({
    id: "imgix",
    async buildVariantUrl(job: CmsDamVariantJob) {
      const path = encodeAssetPath(job.asset.key);
      const query = variantParameters(job);
      const unsigned = `https://${domain}${path}?${query}`;
      if (!token) return unsigned;
      const signature = await options.signMd5!(`${token}${path}?${query}`);
      if (!/^[a-f0-9]{32}$/.test(signature)) {
        invalid(
          "Imgix signer must return a lowercase 32-character MD5 digest.",
        );
      }
      return `${unsigned}&s=${signature}`;
    },
  });
}
