export class CreateProductRequest {
    name: string;
    description: string;
    size: string[];
    price: string;
    variants: {
        price: number;
        quantity: number;
        attributes: {
            [key: string]: string;
        };
    }[];

    constructor(name: string, description: string, size: string[], price: string, variants: {
        price: number;
        quantity: number;
        attributes: {
            [key: string]: string;
        };
    }[]) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.size = size;
        this.variants = variants;
    }
}