export class BaseResponse {
    private message: string;
    private statusCode: number;
    // private data: object;
    private error?: string;

    public getError?(): string | undefined {
        return this.error;
    }

    public setError(error?: string): void {
        this.error = error;
    }


    public getMessage(): string {
        return this.message;
    }

    public setMessage(message: string): void {
        this.message = message;
    }

    public getStatusCode(): number {
        return this.statusCode;
    }

    public setStatusCode(statusCode: number): void {
        this.statusCode = statusCode;
    }

    // public getData(): object {
    //     return this.data;
    // }

    // public setData(data: object): void {
    //     this.data = data;
    // }


    constructor(message: string, statusCode: number, data: object, error?: string) {
        this.message = message;
        this.statusCode = statusCode;
        // this.data = data;
        this.error = error;
    }
}