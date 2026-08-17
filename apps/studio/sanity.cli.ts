import { defineCliConfig } from "sanity/cli";

import { readStudioEnvironment } from "./src/environment";

const environment = readStudioEnvironment(process.env);

export default defineCliConfig({
  api: {
    projectId: environment.projectId,
    dataset: environment.dataset,
  },
});
