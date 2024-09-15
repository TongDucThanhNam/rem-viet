import ILogServices from "../../Persistences/IServices/ILogServices";
import {IUnitOfWork} from "../../Persistences/IRepositories/IUnitOfWork";
import {UnitOfWork} from "../../../Infrastructure/Persistences/Respositories/UnitOfWork";
import {StatusCodeEnums} from "../../../Domain/Enums/StatusCodeEnums";
import {CoreException} from "../../Common/Exceptions/CoreException";
import {DeleteLogResponse} from "./Response/DeleteLogResponse";
import {CreateLogResponse} from "./Response/CreateLogResponse";
import {FindAllLogResponse} from "./Response/FindAllLogResponse";
import {FindLogByIdResponse} from "./Response/FindLogByIdResponse";
import {UpdateLogResponse} from "./Response/UpdateLogResponse";

class LogServices implements ILogServices {
    // private logRepository: ILogRepository = new LogRepository();
    private unitOfWork: IUnitOfWork = new UnitOfWork();


    async create(data: any): Promise<CreateLogResponse | CoreException> {
        try {
            const session = await this.unitOfWork.startTransaction();
            const result = await this.unitOfWork.logRepository.createLog(data, session);
            await this.unitOfWork.commitTransaction();
            return new CreateLogResponse(
                "Create Log Success",
                StatusCodeEnums.Created_201,
                result
            )
        } catch (error: any) {
            await this.unitOfWork.abortTransaction();
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                error.message
            )
        }
    }

    async delete(data: any): Promise<DeleteLogResponse | CoreException> {
        try {
            const session = await this.unitOfWork.startTransaction();
            const result: any = await this.unitOfWork.logRepository.deleteLogById(data, session);
            await this.unitOfWork.commitTransaction();
            return new DeleteLogResponse(
                "Delete Log Success",
                StatusCodeEnums.OK_200,
                result
            )
        } catch (error: any) {
            await this.unitOfWork.abortTransaction();
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                error.message
            )
        }
    }

    async findAll(queryData: any): Promise<FindAllLogResponse | CoreException> {
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
                timeStamp
            } = queryData;
            const query = {
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
                isActive: true,
                isDeleted: false
            }


            const result: any = await this.unitOfWork.logRepository.getAllLogs(query);
            return new FindAllLogResponse(
                "Find All Log Success",
                StatusCodeEnums.OK_200,
                result
            )

        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                error.message
            )
        }
    }

    async findById(logId: any): Promise<FindLogByIdResponse | CoreException> {
        try {
            const queryData = {
                isActive: true,
                isDeleted: false
            }

            const result: any = await this.unitOfWork.logRepository.getLogById(logId, queryData);
            if (result == null) {
                return new CoreException(
                    StatusCodeEnums.NotFound_404,
                    "Log not found"
                )
            }
            return new FindLogByIdResponse(
                "Find Log Success",
                StatusCodeEnums.OK_200,
                result
            )
        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                error.message
            )
        }
    }

    async update(data: any): Promise<UpdateLogResponse | CoreException> {
        try {
            const session = await this.unitOfWork.startTransaction();
            const {logId, ...logData} = data;
            const result: any = await this.unitOfWork.logRepository.updateLogById(logId, logData, session);
            await this.unitOfWork.commitTransaction();
            if (result == null) {
                return new CoreException(
                    StatusCodeEnums.NotFound_404,
                    "Log not found"
                )
            }
            return new UpdateLogResponse(
                "Update Log Success",
                StatusCodeEnums.OK_200,
                result
            )
        } catch (error: any) {
            await this.unitOfWork.abortTransaction();
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                error.message
            )
        }
    }
}

export default LogServices;