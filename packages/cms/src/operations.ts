import { z } from "zod";

export const internalPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine((value) => value.startsWith("/"), "Đường dẫn phải bắt đầu bằng /.")
  .refine(
    (value) => !value.startsWith("//") && !value.includes("://"),
    "Chỉ chấp nhận đường dẫn nội bộ.",
  );

export const redirectStatusCodeSchema = z.union([
  z.literal(301),
  z.literal(302),
  z.literal(307),
  z.literal(308),
]);

export const redirectSchema = z.object({
  id: z.string().min(1),
  oldPath: internalPathSchema,
  newPath: internalPathSchema,
  statusCode: redirectStatusCodeSchema.default(301),
  active: z.boolean().default(true),
});
export type CmsRedirect = z.infer<typeof redirectSchema>;

export function wouldCreateRedirectLoop(
  existing: Array<{
    id?: string;
    oldPath: string;
    newPath: string;
    active?: boolean;
  }>,
  candidate: { oldPath: string; newPath: string; exceptId?: string },
) {
  const normalize = (path: string) =>
    path !== "/" ? path.replace(/\/+$/, "") || "/" : path;
  const oldPath = normalize(candidate.oldPath);
  const newPath = normalize(candidate.newPath);
  if (oldPath === newPath) return true;

  const graph = new Map(
    existing
      .filter(
        (redirect) =>
          redirect.active !== false && redirect.id !== candidate.exceptId,
      )
      .map((redirect) => [
        normalize(redirect.oldPath),
        normalize(redirect.newPath),
      ]),
  );
  graph.set(oldPath, newPath);

  let current = oldPath;
  const visited = new Set<string>();
  while (graph.has(current)) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = graph.get(current)!;
  }
  return false;
}

export const formFieldDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
});
export type FormFieldDefinition = z.infer<typeof formFieldDefinitionSchema>;

export const formDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,49}$/),
  name: z.string().trim().min(1).max(120),
  fields: z.array(formFieldDefinitionSchema).min(1).max(30),
  notificationSettings: z
    .object({
      email: z.boolean().default(true),
      telegram: z.boolean().default(false),
    })
    .default({ email: true, telegram: false }),
  active: z.boolean().default(true),
  retentionDays: z.coerce.number().int().min(1).max(3650).default(365),
});
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

export const formSubmissionStatusSchema = z.enum([
  "new",
  "contacted",
  "closed",
  "spam",
]);
export type FormSubmissionStatus = z.infer<typeof formSubmissionStatusSchema>;

const submissionValueSchema = z.union([
  z.string().max(5000),
  z.number().finite(),
  z.boolean(),
]);

export const publicFormSubmissionSchema = z.object({
  formKey: z.string().regex(/^[a-z][a-z0-9_-]{0,49}$/),
  payload: z
    .record(z.string(), submissionValueSchema)
    .refine(
      (value) => Object.keys(value).length <= 30,
      "Biểu mẫu có quá nhiều trường.",
    ),
  sourcePage: internalPathSchema.default("/"),
  website: z.string().max(0).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});
export type PublicFormSubmission = z.infer<typeof publicFormSubmissionSchema>;
