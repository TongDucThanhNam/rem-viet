import type { SchemaTypeDefinition } from "sanity";

import { agencyFaqBlock, agencyFaqItem } from "./faq";
import {
  agencyHeroBackground,
  agencyHeroBlock,
  agencyHeroFeature,
} from "./hero";
import { agencyPage, agencyPageContent } from "./page";
import {
  agencyImageSource,
  agencyLink,
  agencySeo,
  agencyStringList,
} from "./shared";

export const schemaTypes = [
  agencyLink,
  agencyImageSource,
  agencySeo,
  agencyStringList,
  agencyHeroBackground,
  agencyHeroFeature,
  agencyHeroBlock,
  agencyFaqItem,
  agencyFaqBlock,
  agencyPageContent,
  agencyPage,
] satisfies SchemaTypeDefinition[];

export const providerManagedDocumentTypes = Object.freeze([
  "agencyPage",
  "agencyGlobal",
  "agencyGlobalRevision",
]);
