import ILogRepository from "../../../Application/Persistences/IRepositories/ILogRepository";
import {ClientSession} from "mongoose";
import {LogWithBase} from "../../../Domain/Entities/LogEntities";

class LogRepository implements ILogRepository {
    async createLog(logData: any, session: ClientSession): Promise<typeof LogWithBase> {
        try {
            const log: any = await LogWithBase.create([{
                userId: logData.userId,
                // action: logData.action,
                method: logData.method,
                url: logData.url,
                statusCode: logData.statusCode,
                ipAddress: logData.ipAddress,
                deviceId: logData.deviceId,
                timeStamp: logData.timeStamp
            }], {session});
            return log;
        } catch (error: any) {
            throw new Error("Error at createLog in LogRepository: " + error.message);
        }
    }

    async deleteLogById(logId: string, session: ClientSession): Promise<typeof LogWithBase | null> {
        try {
            const query: any = {
                _id: logId
            }
            const result: typeof LogWithBase | null = await LogWithBase.findOneAndUpdate
            (query, {
                isActive: false,
                isDeleted: true
            }, {
                session
            });

            return result;
        } catch (error: any) {
            throw new Error("Error at deleteLogById in LogRepository: " + error.message);
        }
    }

    async getAllLogs(queryData: any): Promise<typeof LogWithBase[] | null> {
        try {
            const {
                page,
                limit,
                userId,
                // action,
                method,
                url,
                statusCode,
                ipAddress,
                deviceId,
                timeStamp,
                isActive,
                isDeleted
            } = queryData;
            // console.log(queryData);
            let _page = page;
            if (page === undefined || page < 0) {
                _page = 1;
            }
            let _limit = limit;
            if (limit === undefined || limit < 0) {
                _limit = 10;
            }


            const filteredQueryData = {
                ...(userId !== undefined && {userId}),
                // ...(action && {action}),
                ...(method && {method}),
                ...(url && {url}),
                ...(statusCode && {statusCode}),
                ...(ipAddress && {ipAddress}),
                ...(deviceId && {deviceId}),
                ...(timeStamp && {timeStamp}),
                ...(isActive !== undefined && {isActive}),
                ...(isDeleted !== undefined && {isDeleted})
            };

            const totalLogs: any = await LogWithBase.countDocuments(filteredQueryData);

            const logs: any = await LogWithBase.find(filteredQueryData).limit(_limit).skip((_page - 1) * _limit);

            const result: any = {
                currentPage: _page,
                totalPage: Math.ceil(totalLogs / _limit),
                totalItems: logs.length,
                perPage: _limit,
                data: logs,
            }
            // console.log("logs: ", logs);

            return result;
        } catch (error: any) {
            throw new Error("Error at getAllLogs in LogRepository: " + error.message);
        }
    }

    async getLogById(logId: string, queryData: any): Promise<typeof LogWithBase | null> {
        try {
            const query: any = {
                _id: logId,
                isActive: queryData.isActive,
                isDeleted: queryData.isDeleted
            };
            const log: typeof LogWithBase | null = await LogWithBase.findOne(query);
            return log
        } catch (error: any) {
            throw new Error("Error at getLogById in LogRepository: " + error.message);
        }
    }

    async updateLogById(logId: string, logData: any, session: ClientSession): Promise<typeof LogWithBase | null> {
        try {
            const query: any = {
                _id: logId
            };
            const result: typeof LogWithBase | null = await LogWithBase.findOneAndUpdate
            (query, {
                userId: logData.userId,
                // action: logData.action,
                method: logData.method,
                url: logData.url,
                statusCode: logData.statusCode,
                ipAddress: logData.ipAddress,
                deviceId: logData.deviceId,
                timeStamp: logData.timeStamp
            }, {session});
            return result;
        } catch (error: any) {
            throw new Error("Error at updateLogById in LogRepository: " + error.message);
        }
    }
}


export default LogRepository;