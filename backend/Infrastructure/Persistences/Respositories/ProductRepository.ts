import IProductRepository from "../../../Application/Persistences/IRepositories/IProductRepository";
import {ClientSession} from "mongoose";
import {ProductWithBase} from "../../../Domain/Entities/ProductEntities";

class ProductRepository implements IProductRepository {
    async createProduct(productData: any, session: ClientSession): Promise<typeof ProductWithBase> {
        try {
            const product: any = await ProductWithBase.create(
                [{
                    ...productData
                }],
                {
                    session
                }
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
            return await ProductWithBase.findOneAndUpdate(
                {_id: productId},
                {$set: softDelete},
                {session: session}
            );
        } catch (error: any) {
            throw new Error("Error at deleteProductById in ProductRepository: " + error.message);
        }
    }

    async getAllProducts(queryData: any): Promise<any> {
        try {
            const {
                page,
                limit,
                isActive,
                isDeleted
            } = queryData;

            // console.log(queryData);
            let _page = page;
            if (page === undefined || page < 0) {
                _page = 1;
            }
            let _limit = limit;
            if (limit === undefined || limit < 0) {
                _limit = 8;
            }

            const filteredQueryData = {
                ...(isActive && {isActive}),
                ...(isDeleted && {isDeleted})
            }

            const totalProducts = await ProductWithBase
                .find(filteredQueryData)
                .countDocuments();

            const products = await ProductWithBase
                .find(filteredQueryData)
                .limit(_limit)
                .skip((_page - 1) * _limit);

            const result = {
                currentPage: _page,
                totalPage: Math.ceil(totalProducts / _limit),
                totalItems: products.length,
                perPage: _limit,
                data: products,
            }

            return result;

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