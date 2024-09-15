import {IUnitOfWork} from "../../Application/Persistences/IRepositories/IUnitOfWork";
import {UnitOfWork} from "../../Infrastructure/Persistences/Respositories/UnitOfWork";

interface ILog {
    // action: string,
    method: string,
    url: string,
    statusCode: number,
    ipAddress: string,
    deviceId: string,
    timeStamp: string
}

/**
 * Middleware function to save log to database.
 *
 * @param log - The log object.
 * @param req - The request object.
 * @param res - The response object.
 * @returns - The response object.
 */
export async function saveLog(
    log: ILog,
    req: any,
    res: any
) {
    const unitOfWork: IUnitOfWork = new UnitOfWork();
    try {

        //get User from req.user
        const user = req.user;
        let userId = null;

        if (!user) {
            // console.log("User: ", user);
        } else {
            // console.log("User: ", user);
            userId = user.userId ?? null;
        }

        //save log to database
        const session = await unitOfWork.startTransaction();
        await unitOfWork.logRepository.createLog(
            {
                // action: log.action,
                method: log.method,
                url: log.url,
                statusCode: log.statusCode,
                ipAddress: log.ipAddress,
                deviceId: log.deviceId,
                timeStamp: log.timeStamp,
                userId: userId
            },
            session
        );

        await unitOfWork.commitTransaction();
    } catch (error: any) {
        await unitOfWork.abortTransaction();
        console.log("Error occured at save log middleware: ", error.message);
    }
}