import {
  SANITY_RECOMMENDED_API_VERSION,
  createSanityPresentationConfig,
} from "@agency/cms-provider-sanity";
import { defineConfig } from "sanity";
import { defineDocuments, presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";

import { readStudioEnvironment } from "./src/environment";
import { providerManagedDocumentTypes, schemaTypes } from "./src/schemaTypes";
import { structure } from "./src/structure";
import { VersionedDocumentInput } from "./src/VersionedDocumentInput";

const environment = readStudioEnvironment(process.env);
const presentation = createSanityPresentationConfig({
  previewUrl: environment.previewUrl,
  allowOrigins: environment.allowOrigins,
});
const mainDocuments = defineDocuments([
  {
    route: "/sanity-preview/:id",
    filter: '_type == "agencyPage" && agencyId == $id',
  },
]);

export default defineConfig({
  name: "rem-viet-visual",
  title: "Rèm Việt Visual Studio",
  projectId: environment.projectId,
  dataset: environment.dataset,
  plugins: [
    structureTool({ structure }),
    presentationTool({
      ...presentation,
      allowOrigins: [...presentation.allowOrigins],
      resolve: { mainDocuments },
    }),
    visionTool({ defaultApiVersion: SANITY_RECOMMENDED_API_VERSION }),
  ],
  schema: {
    types: schemaTypes,
    templates: (previous) =>
      previous.filter(
        (template) =>
          !providerManagedDocumentTypes.includes(template.schemaType),
      ),
  },
  form: {
    components: {
      input: VersionedDocumentInput,
    },
  },
});
