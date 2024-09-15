import IProductRepository from "../../../Application/Persistences/IRepositories/IProductRepository";
import mongoose, { ClientSession } from "mongoose";
import {ProductWithBase} from "../../../Domain/Entities/ProductEntities";

class ProductRepository implements IProductRepository {
    async createProduct(productData: any, session: ClientSession): Promise<typeof ProductWithBase> {
        try {
            const product: any = await ProductWithBase.create(
                [{
                    ...productData
                }],
                {session}
            );
            return product[0];
        } catch (error: any) {
            throw new Error("Error at createProduct in ProductRepository: " + error.message);
        }
    }

    async deleteProductById(productId: string, session: ClientSession): Promise<typeof ProductWithBase | null> {
        try {
            const softDelete = {
                updatedAt: Date.now(),
                isDeleted: true,
                isActive: false
            }
            return null
        } catch (error: any) {
            throw new Error("Error at deleteProductById in ProductRepository: " + error.message);
        }
    }

    async getAllProducts(queryData: any): Promise<typeof ProductWithBase[] | null> {
        try {

            return await ProductWithBase.find();

        } catch (error: any) {
            throw new Error("Error at getAllProducts in ProductRepository: " + error.message);
        }
    }

    async getProductById(productId: string, queryData: any): Promise<typeof ProductWithBase | null> {
        try {
            return await ProductWithBase.findOne({
                _id: productId,
                ...queryData
            });
        } catch (error: any) {
            throw new Error("Error at getProductById in ProductRepository: " + error.message);
        }
    }

    async getProductIdByProductName(productName: string, queryData: any): Promise<string | unknown | null> {
        try {
            const product = await ProductWithBase.findOne({
                productName: productName,
                ...queryData
            });
            return product?._id;
        } catch (error: any) {
            throw new Error("Error at getProductIdByProductName in ProductRepository: " + error.message);
        }
    }

    async updateProductById(productId: string, productData: any, session: ClientSession): Promise<typeof ProductWithBase | null> {
        try {
            return await
                ProductWithBase.findOneAndUpdate(
                    {_id: productId},
                    {$set: productData},
                    {new: true, session: session}
                );
        } catch (error: any) {
            throw new Error("Error at updateProductById in ProductRepository: " + error.message);
        }
    }
}

export default ProductRepository;