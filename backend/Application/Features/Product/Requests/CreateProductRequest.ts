import {IVariant} from "../../../../Domain/Interface/IVariant";

export class CreateProductRequest {
    imageurls: string[];
    name: string;
    description: string;
    size: string[];
    price: string;
    variants: any;

    constructor(name: string, description: string, size: string[], price: string, variants: any, imageUrls: string[]) {
        this.imageurls = imageUrls;
        this.name = name;
        this.description = description;
        this.price = price;
        this.size = size;
        this.variants = variants;
    }
}