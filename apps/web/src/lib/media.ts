import {
  allowedMediaTypes,
  extensionByMediaType,
  maxMediaBatchBytes,
  maxMediaBytes,
  maxMediaFiles,
  mediaKeyPattern,
  type AllowedMediaType,
} from "@rem-viet/cms";

const allowedImageTypes = new Set<string>(allowedMediaTypes);

export { maxMediaBatchBytes, maxMediaBytes, maxMediaFiles };

export async function validateMediaFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Chỉ hỗ trợ tệp ảnh AVIF, GIF, JPEG, PNG hoặc WEBP.");
  }

  if (file.size > maxMediaBytes) {
    throw new Error("Tệp ảnh phải nhỏ hơn 5MB.");
  }

  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  const valid =
    (file.type === "image/jpeg" &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (file.type === "image/png" &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (byte, index) => bytes[index] === byte,
      )) ||
    (file.type === "image/gif" &&
      (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a"))) ||
    (file.type === "image/webp" &&
      ascii.startsWith("RIFF") &&
      ascii.slice(8, 12) === "WEBP") ||
    (file.type === "image/avif" &&
      ascii.slice(4, 8) === "ftyp" &&
      /avif|avis/.test(ascii.slice(8, 24)));
  if (!valid) throw new Error("Nội dung file không khớp MIME ảnh đã khai báo.");
}

export async function validateMediaFiles(files: File[]) {
  if (files.length > maxMediaFiles) {
    throw new Error(`Chỉ được tải tối đa ${maxMediaFiles} ảnh mỗi lần.`);
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxMediaBatchBytes) {
    throw new Error("Tổng dung lượng ảnh mỗi lần tải phải nhỏ hơn 30MB.");
  }

  await Promise.all(files.map(validateMediaFile));
}

export function mediaObjectKey(file: File) {
  const extension =
    extensionByMediaType[file.type as AllowedMediaType] ?? "bin";

  return `${crypto.randomUUID()}.${extension}`;
}

export function mediaPublicPath(key: string) {
  return `/api/media/${encodeURIComponent(key)}`;
}

export function isMediaObjectKey(key: string) {
  return mediaKeyPattern.test(key);
}
