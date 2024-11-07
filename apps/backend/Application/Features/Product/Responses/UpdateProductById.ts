import {BaseResponse} from "../../../Common/Model/Response/BaseResponse.ts";

interface Product {
    productId: string;
    name: string;
    description: string;
    price: string;
    size: number[];
}

export class UpdateProductById extends BaseResponse {
    data: Product;


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