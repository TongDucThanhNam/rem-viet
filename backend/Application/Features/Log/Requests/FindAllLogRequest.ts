export class FindAllLogRequest {
    private page: number;
    private limit: number;
    private userId: string;
    // private action: string;
    private method: string;
    private url: string;
    private statusCode: number;
    private ipAddress: string;
    private deviceId: string;
    private timeStamp: Date;


    constructor(page: number, limit: number, userId: string, method: string, url: string, statusCode: number, ipAddress: string, deviceId: string, timeStamp: Date) {
        this.page = page;
        this.limit = limit;
        this.userId = userId;
        this.method = method;
        this.url = url;
        this.statusCode = statusCode;
        this.ipAddress = ipAddress;
        this.deviceId = deviceId;
        this.timeStamp = timeStamp;
    }
}