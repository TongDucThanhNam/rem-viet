import {BaseResponse} from "../../../Common/Model/Response/BaseResponse.ts";
import type {IProduct} from "../../../../Domain/Interface/IProduct.ts";

//Define Response return
interface Product {
    name: string,
    description: string,
    price: string,
    size: number[],
}

export class GetProductIdByProductNameResponse extends BaseResponse {
    data: Product;

    constructor(message: string, statusCode: number, data: IProduct, error: string) {
        super(message, statusCode, data, error);
        this.data = {
            name: data.name,
            description: data.description,
            price: data.price,
            size: data.size,
        }
    }
}