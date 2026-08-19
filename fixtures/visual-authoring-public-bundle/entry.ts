import { parseAtelierPublicNode } from "../../packages/cms-template-atelier/src/index";
import { remVietTemplateBlockSchema } from "../../packages/cms-template-rem-viet/src/index";

export const parsePublicAtelierBlock = (value: unknown) =>
  parseAtelierPublicNode(value);

export const parsePublicRemVietBlock = (value: unknown) =>
  remVietTemplateBlockSchema.parse(value);
