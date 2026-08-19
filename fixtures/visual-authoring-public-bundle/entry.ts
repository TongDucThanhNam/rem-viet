import { remVietTemplateBlockSchema } from "../../packages/cms-template-rem-viet/src/index";

export const parsePublicRemVietBlock = (value: unknown) =>
  remVietTemplateBlockSchema.parse(value);
