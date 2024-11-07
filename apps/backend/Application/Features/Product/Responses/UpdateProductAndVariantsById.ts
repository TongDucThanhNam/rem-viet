import {BaseResponse} from "../../../Common/Model/Response/BaseResponse.ts";

interface Product {
    productId: string;
    name: string;
    description: string;
    price: string;
    size: number[];
    variantNumber: number;
}

export class UpdateProductAndVariantsById extends BaseResponse {
    data: any;

    constructor(message: string, statusCode: number, data: any, error?: string) {
        super(message, statusCode, data, error);
        this.data = {
            productId: data._id,
            name: data.name,
            description: data.description,
            size: data.size,
            price: data.price
        }
    }
}