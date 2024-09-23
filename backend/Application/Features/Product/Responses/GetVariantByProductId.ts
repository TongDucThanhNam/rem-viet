import {BaseResponse} from "../../../Common/Model/Response/BaseResponse";

export class GetVariantByProductId extends BaseResponse {

    private data: any;


    constructor(message: string, statusCode: number, data: any, error?: string) {
        super(message, statusCode, data, error);
        this.data = {
            product: data.product,
            variants: data.variants

        }
    }
}