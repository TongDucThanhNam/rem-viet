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

export function validateMediaFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Chỉ hỗ trợ tệp ảnh AVIF, GIF, JPEG, PNG hoặc WEBP.");
  }

  if (file.size > maxMediaBytes) {
    throw new Error("Tệp ảnh phải nhỏ hơn 5MB.");
  }
}

export function validateMediaFiles(files: File[]) {
  if (files.length > maxMediaFiles) {
    throw new Error(`Chỉ được tải tối đa ${maxMediaFiles} ảnh mỗi lần.`);
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxMediaBatchBytes) {
    throw new Error("Tổng dung lượng ảnh mỗi lần tải phải nhỏ hơn 30MB.");
  }

  for (const file of files) {
    validateMediaFile(file);
  }
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
