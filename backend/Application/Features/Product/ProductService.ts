import IProductService from "../../Persistences/IServices/IProductService";
import {IUnitOfWork} from "../../Persistences/IRepositories/IUnitOfWork";
import {UnitOfWork} from "../../../Infrastructure/Persistences/Respositories/UnitOfWork";
import {ProductWithBase} from "../../../Domain/Entities/ProductEntities";
import {StatusCodeEnums} from "../../../Domain/Enums/StatusCodeEnums";
import {CoreException} from "../../Common/Exceptions/CoreException";
import {GetProductByIdResponse} from "./Responses/GetProductByIdResponse";

export default class ProductService implements IProductService {
    private unitOfWork: IUnitOfWork = new UnitOfWork();

    async createProduct(productData: any, variantData: any): Promise<any> {
        try {
            const session = await this.unitOfWork.startTransaction();
            const newProduct: typeof ProductWithBase = await this.unitOfWork.productRepository.createProduct(productData, session);
            //get ProductId
            const productId = newProduct;


            //Variant
            // const variantData = [
            //     [{"key":0,"values":{"Colors":"R","Sizes":"S"},"price":1},
            //    {"key":1,"values":{"Colors":"R","Sizes":"M"},"price":2},
            //    {"key":2,"values":{"Colors":"R","Sizes":"L"},"price":3},
            // ];
            //create variant
            const variants = variantData.map((variant: any) => {
                return {
                    ...variant,
                    productId: productId
                }
            });

            for (const variant of variants) {
                await this.unitOfWork.variantRepository.createVariant(variant);
            }
            console.log(newProduct);
            await this.unitOfWork.commitTransaction();
        } catch (error: any) {
            await this.unitOfWork.abortTransaction();
            throw new Error("Error at createProduct in ProductService: " + error.message);
        }
    }

    async deleteProductById(productId: string): Promise<any> {
        return Promise.resolve(undefined);
    }

    async getAllProducts(queryData: any): Promise<any> {
        try {
            return await this.unitOfWork.productRepository.getAllProducts(queryData);
        } catch (error: any) {
            throw new Error("Error at getAllProducts in ProductService: " + error.message);
        }
    }

    async getProductById(productId: string, queryData: any): Promise<any> {
        try {
            const result: any = await this.unitOfWork.productRepository.getProductById(productId, queryData);
            if (result == null) {
                return new CoreException(
                    StatusCodeEnums.NotFound_404,
                    "Product not found",
                )
            }

            // console.log(result);

            return new GetProductByIdResponse(
                "Product found",
                StatusCodeEnums.OK_200,
                result,
            )

        } catch (error: any) {
            throw new Error("Error at getProductById in ProductService: " + error.message);
        }
    }

    async getProductIdByProductName(productName: string, queryData: any): Promise<any> {
        return Promise.resolve(undefined);
    }

    async updateProductById(productId: string, productData: any): Promise<any> {
        return Promise.resolve(undefined);
    }
}