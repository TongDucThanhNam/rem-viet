import {
  createLog,
  createLogInputSchema,
  deleteLog,
  getLogById,
  listLogs,
  listLogsInputSchema,
  logIdInputSchema,
  updateLog,
  updateLogInputSchema,
} from "../services/logs";
import { protectedProcedure, router } from "../index";

export const logsRouter = router({
  list: protectedProcedure
    .input(listLogsInputSchema)
    .query(({ input }) => listLogs(input)),
  byId: protectedProcedure
    .input(logIdInputSchema)
    .query(({ input }) => getLogById(input)),
  create: protectedProcedure
    .input(createLogInputSchema)
    .mutation(({ input }) => createLog(input)),
  update: protectedProcedure
    .input(updateLogInputSchema)
    .mutation(({ input }) => updateLog(input)),
  delete: protectedProcedure
    .input(logIdInputSchema)
    .mutation(({ input }) => deleteLog(input)),
});
