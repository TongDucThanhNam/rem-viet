import {BaseResponse} from "../../../Common/Model/Response/BaseResponse";

interface Product {
    _id: string,
    name: string,
    description: string,
    price: string,
    size: number[],
    __v: number
}


export class GetProductByIdResponse extends BaseResponse {

    private data: any;


    constructor(message: string, statusCode: number, data: Product, error?: string) {
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