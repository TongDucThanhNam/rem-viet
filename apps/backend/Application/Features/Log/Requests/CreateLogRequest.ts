export class CreateLogRequest {
    userId: string;
    action: string;
    ipAddress: string;
    deviceId: string;
    timeStamp: Date;

    constructor(userId: string, action: string, ipAddress: string, deviceId: string, timeStamp: Date) {
        this.userId = userId;
        this.action = action;
        this.ipAddress = ipAddress;
        this.deviceId = deviceId;
        this.timeStamp = timeStamp;
    }
}