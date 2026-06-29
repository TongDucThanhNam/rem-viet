import {
  isMediaObjectKey,
  mediaObjectKey,
  mediaPublicPath,
  maxMediaBatchBytes,
  maxMediaBytes,
  maxMediaFiles,
  validateMediaFile,
  validateMediaFiles,
} from "@/lib/media";

export const maxProductImageFiles = maxMediaFiles;
export const maxProductImageBytes = maxMediaBytes;
export const maxProductImageBatchBytes = maxMediaBatchBytes;

export const validateProductImageFile = validateMediaFile;
export const validateProductImageFiles = validateMediaFiles;
export const productImageObjectKey = mediaObjectKey;

// Compatibility URL for product images uploaded before generic media existed.
export function productImagePublicPath(key: string) {
  return `/api/product-images/${encodeURIComponent(key)}`;
}

export function genericMediaPublicPath(key: string) {
  return mediaPublicPath(key);
}

export const isProductImageObjectKey = isMediaObjectKey;
