export class UpdateLogRequest {
    logId: string;
    userId: string;
    action: string;
    ipAddress: string;
    deviceId: string;
    timeStamp: Date;

    constructor(logId: string, userId: string, action: string, ipAddress: string, deviceId: string, timeStamp: Date) {
        this.logId = logId;
        this.userId = userId;
        this.action = action;
        this.ipAddress = ipAddress;
        this.deviceId = deviceId;
        this.timeStamp = timeStamp;
    }
}