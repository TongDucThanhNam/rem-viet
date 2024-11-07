import {ClientSession} from "mongoose";
import {LogWithBase} from "../../../Domain/Entities/LogEntities";

interface ILogRepository {
    createLog(logData: any, session: ClientSession): Promise<typeof LogWithBase>;

    getLogById(logId: string, queryData: any): Promise<typeof LogWithBase | null>;

    getAllLogs(queryData: any): Promise<typeof LogWithBase[] | null>;

    updateLogById(logId: string, logData: any, session: ClientSession): Promise<typeof LogWithBase | null>;

    deleteLogById(logId: string, session: ClientSession): Promise<typeof LogWithBase | null>;
}

export default ILogRepository;

