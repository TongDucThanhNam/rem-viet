export class UpdateProduct {
    productId: string;
    imageurls: string[];
    name: string;
    description: string;
    size: string[];
    price: string;
    variants: any;

    constructor(productId: string, name: string, description: string, size: string[], price: string, variants: any, imageUrls: string[]) {
        this.productId = productId;
        this.imageurls = imageUrls;
        this.name = name;
        this.description = description;
        this.price = price;
        this.size = size;
        this.variants = variants;
    }
}