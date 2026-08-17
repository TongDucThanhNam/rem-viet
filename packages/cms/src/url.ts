import { z } from "zod";

function hasSafeProtocol(value: string, protocols: readonly string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const safeHttpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => hasSafeProtocol(value, ["http:", "https:"]), {
    message: "URL chỉ được dùng http hoặc https.",
  });

export const safePublicLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      (value.startsWith("#") && value.length > 1) ||
      hasSafeProtocol(value, ["http:", "https:", "mailto:", "tel:"]),
    {
      message:
        "Link phải là đường dẫn nội bộ, anchor, http(s), mailto hoặc tel.",
    },
  );

export const safeMediaSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      hasSafeProtocol(value, ["http:", "https:"]),
    { message: "Media phải là đường dẫn nội bộ hoặc URL http(s)." },
  );
