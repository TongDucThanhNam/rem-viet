import IProductService from "../../Persistences/IServices/IProductService";
import {IUnitOfWork} from "../../Persistences/IRepositories/IUnitOfWork";
import {UnitOfWork} from "../../../Infrastructure/Persistences/Respositories/UnitOfWork";
import {ProductWithBase} from "../../../Domain/Entities/ProductEntities";
import {StatusCodeEnums} from "../../../Domain/Enums/StatusCodeEnums";
import {CoreException} from "../../Common/Exceptions/CoreException";
import {GetProductByIdResponse} from "./Responses/GetProductByIdResponse";
import {GetVariantByProductId} from "./Responses/GetVariantByProductId";
import {CreateProductResponse} from "./Responses/CreateProductResponse";
import {UpdateProductById} from "./Responses/UpdateProductById.ts";
import {UpdateProductAndVariantsById} from "./Responses/UpdateProductAndVariantsById.ts";

export default class ProductService implements IProductService {
    private unitOfWork: IUnitOfWork = new UnitOfWork();

    async createProduct(productData: any, variantData: any): Promise<any> {
        try {
            const session = await this.unitOfWork.startTransaction();
            const newProduct: typeof ProductWithBase = await this.unitOfWork.productRepository.createProduct(productData, session);
            const productId = newProduct;
            //create variant
            const variants: any = variantData.map((variant: any) => {
                return {
                    ...variant,
                    productId: productId
                }
            });

            for (const variant of variants) {
                await this.unitOfWork.variantRepository.createVariant(variant);
            }

            const result: any = {
                product: newProduct,
                variants: variants
            }
            // console.log(result);

            await this.unitOfWork.commitTransaction();

            return new CreateProductResponse(
                "Product created",
                StatusCodeEnums.Created_201,
                result,
            )

        } catch (error: any) {
            await this.unitOfWork.abortTransaction();
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at createProduct in ProductService: " + error.message,
            )
        }
    }

    async deleteProductById(productId: string): Promise<any> {
        try {
            const session = await this.unitOfWork.startTransaction();
            const result = await this.unitOfWork.productRepository.deleteProductById(productId, session);
            await this.unitOfWork.commitTransaction();
        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at deleteProductById in ProductService: " + error.message,
            )
        }
    }

    async getAllProducts(queryData: any): Promise<any> {
        try {
            return await this.unitOfWork.productRepository.getAllProducts(queryData);
        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at getAllProducts in ProductService: " + error.message,
            )
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
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at getProductById in ProductService: " + error.message,
            )
        }
    }

    async getProductAndVariantsById(productId: string): Promise<any> {
        try {
            const queryData = {
                isActive: true,
                isDeleted: false
            }

            const product = await this.unitOfWork.productRepository.getProductById(productId, queryData);
            if (!product) {
                return new CoreException(
                    StatusCodeEnums.NotFound_404,
                    "Product not found",
                )
            }
            const variants = await this.unitOfWork.variantRepository.getVariantByProductId(productId, queryData);
            const result = {
                product: product,
                variants: variants
            }
            return new GetVariantByProductId(
                "Product and variants found",
                StatusCodeEnums.OK_200,
                result,
            )
        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at getProductAndVariantsById in ProductService: " + error.message,
            )
        }
    }

    async getProductIdByProductName(productName: string, queryData: any): Promise<any> {
        try {
            return new GetProductByIdResponse(
                "Product found",
                StatusCodeEnums.OK_200,
                await this.unitOfWork.productRepository.getProductIdByProductName(productName, queryData),
            )

        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at getProductIdByProductName in ProductService: " + error.message,
            )
        }
    }

    async updateProductById(productId: string, productData: any): Promise<any> {
        try {
            const session = await this.unitOfWork.startTransaction();

            // console.log(productData);
            const result = await this.unitOfWork.productRepository.updateProductById(productId, productData, session);



            if (!result) {
                await this.unitOfWork.abortTransaction();
                return new CoreException(
                    StatusCodeEnums.NotFound_404,
                    "Product not found",
                )
            }

            await this.unitOfWork.commitTransaction();

            return new UpdateProductById(
                "Product updated",
                StatusCodeEnums.OK_200,
                result,
            )
        } catch (error: any) {
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at updateProductById in ProductService: " + error.message,
            )
        }
    }

    //
    async updateProductAndVariantsById(productId: string, productData: any, variantData: any): Promise<any> {
        try {
            const session = await this.unitOfWork.startTransaction();
            //update product
            await this.unitOfWork.productRepository.updateProductById(productId, productData, session);

            if (!productData) {
                await this.unitOfWork.abortTransaction();
                return new CoreException(
                    StatusCodeEnums.NotFound_404,
                    "Product not found",
                )
            }

            //update variant
            const variants = variantData.map((variant: any) => {
                return {
                    ...variant,
                    productId: productId
                }
            });

            for (const variant of variants) {
                await this.unitOfWork.variantRepository.updateVariantById(variant._id, variant);
            }

            await this.unitOfWork.commitTransaction();

            return UpdateProductAndVariantsById(
                "Product and variants updated",
                StatusCodeEnums.OK_200,
                {
                    _id: productId,
                    name: productData.name,
                    description: productData.description,
                    size: productData.size,
                    price: productData.price,
                    variantNumber: variants.length
                })

        } catch (error: any) {
            await this.unitOfWork.abortTransaction();
            throw new CoreException(
                StatusCodeEnums.InternalServerError_500,
                "Error at updateProductAndVariantsById in ProductService: " + error.message,
            )
        }
    }
}