const allowedImageTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const extensionByType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const productImageKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(avif|gif|jpg|png|webp)$/i;

export const maxProductImageFiles = 12;
export const maxProductImageBytes = 5 * 1024 * 1024;
export const maxProductImageBatchBytes = 30 * 1024 * 1024;

export function validateProductImageFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Chỉ hỗ trợ tệp ảnh AVIF, GIF, JPEG, PNG hoặc WEBP.");
  }

  if (file.size > maxProductImageBytes) {
    throw new Error("Tệp ảnh phải nhỏ hơn 5MB.");
  }
}

export function validateProductImageFiles(files: File[]) {
  if (files.length > maxProductImageFiles) {
    throw new Error(`Chỉ được tải tối đa ${maxProductImageFiles} ảnh mỗi lần.`);
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > maxProductImageBatchBytes) {
    throw new Error("Tổng dung lượng ảnh mỗi lần tải phải nhỏ hơn 30MB.");
  }

  for (const file of files) {
    validateProductImageFile(file);
  }
}

export function productImageObjectKey(file: File) {
  const extension = extensionByType[file.type] ?? "bin";

  return `${crypto.randomUUID()}.${extension}`;
}

export function productImagePublicPath(key: string) {
  return `/api/product-images/${encodeURIComponent(key)}`;
}

export function isProductImageObjectKey(key: string) {
  return productImageKeyPattern.test(key);
}
