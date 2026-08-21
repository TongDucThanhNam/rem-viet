import { TRPCError } from "@trpc/server";

import { CmsError, type OperationalIncidentInput } from "@rem-viet/cms";

import { reportOperationalIncident } from "./services/incidents";
import { ContentWorkflowError } from "./services/content-workflow-error";

export async function runCmsWorkflow<T>(
  operation: () => Promise<T>,
  incident?: Omit<OperationalIncidentInput, "error">,
) {
  try {
    return await operation();
  } catch (error) {
    if (
      !(error instanceof ContentWorkflowError) &&
      !(error instanceof CmsError)
    ) {
      if (incident) reportOperationalIncident({ ...incident, error });
      throw error;
    }

    const code =
      error.code === "CONFLICT"
        ? "CONFLICT"
        : error.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : error.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : "BAD_REQUEST";

    throw new TRPCError({ code, message: error.message, cause: error });
  }
}
