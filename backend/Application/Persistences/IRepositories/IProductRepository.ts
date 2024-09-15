import {ProductWithBase} from "../../../Domain/Entities/ProductEntities";
import {ClientSession} from "mongoose";

interface  IProductRepository {
    getProductById(productId: string, queryData: any): Promise<typeof ProductWithBase | null>;

    getAllProducts(queryData: any): Promise<typeof ProductWithBase[] | null>;

    createProduct(productData: any, session: ClientSession): Promise<typeof ProductWithBase>;

    updateProductById(productId: string, productData: any, session: ClientSession): Promise<typeof ProductWithBase | null>;

    deleteProductById(productId: string, session: ClientSession): Promise<typeof ProductWithBase | null>;

    getProductIdByProductName(productName: string, queryData: any): Promise<string|null|unknown>;
}

export default IProductRepository;