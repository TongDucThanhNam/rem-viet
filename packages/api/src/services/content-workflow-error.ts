export class ContentWorkflowError extends Error {
  constructor(
    readonly code: "CONFLICT" | "NOT_FOUND" | "INVALID_REVISION" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "ContentWorkflowError";
  }
}
