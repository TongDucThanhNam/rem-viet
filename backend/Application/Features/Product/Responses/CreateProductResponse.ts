import {BaseResponse} from "../../../Common/Model/Response/BaseResponse";
import {IProduct} from "../../../../Domain/Interface/IProduct";
import {IVariant} from "../../../../Domain/Interface/IVariant";

// Information about the san-pham
interface ProductAndVariants {
    product: IProduct,
    variants: IVariant[]
}

export class CreateProductResponse extends BaseResponse {
    private data: any;

    constructor(message: string, statusCode: number, data: ProductAndVariants, error?: string) {
        super(message, statusCode, data, error);
        this.data = {
            product: data.product,
            variants: data.variants
        }
    }
}