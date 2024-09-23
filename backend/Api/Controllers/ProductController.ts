import {Request, Response} from 'express';
import IProductService from "../../Application/Persistences/IServices/IProductService";
import ProductService from "../../Application/Features/Product/ProductService";
import {CreateProductRequest} from "../../Application/Features/Product/Requests/CreateProductRequest";
import {IVariant} from "../../Domain/Interface/IVariant";
import {GetAllProductsRequest} from "../../Application/Features/Product/Requests/GetAllProductsRequest.ts";
import {GetProductById} from "../../Application/Features/Product/Requests/getProductById.ts";
import {GetProductAndVariantById} from "../../Application/Features/Product/Requests/GetProductAndVariantById.ts";
import type {UpdateProduct} from "../../Application/Features/Product/Requests/UpdateProduct.ts";
import type {DeleteProductById} from "../../Application/Features/Product/Requests/DeleteProductById.ts";


export default class ProductController {
    private productServices: IProductService = new ProductService();

    getAllProducts = async (
        req: Request<any, any, any, GetAllProductsRequest>,
        res: Response,
    ) => {
        /*
            #swagger.tags = ['Products']
            #swagger.description = 'API to get all products'
         */

        try {
            const {
                search,
                sort,
                order,
                page,
                limit
            } = req.query;


            const queryData = {
                search: search as string || "",
                sort: sort as string || "",
                order: order as string || "",
                page: parseInt(page as string) || 1,
                limit: parseInt(limit as string) || 8
            }

            const result = await this.productServices.getAllProducts(queryData);

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }
    getProductById = async (
        req: Request<GetProductById, any, any, any>,
        res: Response,
    ) => {
        /*
            #swagger.tags = ['Products']
            #swagger.description = 'API to get product by id'
         */

        try {
            const {
                productId
            } = req.params;

            const result = await this.productServices.getProductById(productId, {});

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }

    getProductAndVariantById = async (
        req: Request<GetProductAndVariantById, any, any, any>,
        res: Response,
    ) => {
        /*
            #swagger.tags = ['Products']
            #swagger.description = 'API to get product and variant by id'
         */

        try {
            const {
                productId
            } = req.params;

            const result = await this.productServices.getProductAndVariantsById(productId);

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }

    createProduct = async (
        req: Request<any, any, CreateProductRequest, any>,
        res: Response,
    ) => {
        /*
            #swagger.tags = ['Products']
            #swagger.description = 'API to create product'
         */

        try {
            const {name, description, price, size, variants, imageurls} = req.body;
            //Product
            const productData = {
                "imageUrls": imageurls,
                "name": name,
                "description": description,
                "size": size,
                "price": price ?? "0"
            }

            let min = 99999999999;
            let max = 0;
            const variantData = variants.map((variant: IVariant) => {
                if (variant.variantPrice < min) {
                    min = variant.variantPrice;
                }
                if (variant.variantPrice > max) {
                    max = variant.variantPrice;
                }
                return {
                    ...variant
                }
            })

            if (price == "0" || price == undefined) {
                productData['price'] = `${min} - ${max}`;
            }

            //Create product
            const result = await this.productServices.createProduct(
                //ProductDataa
                productData,
                //VariantData
                variantData
            );

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }

    updateProduct = async (
        req: Request<UpdateProduct, any, UpdateProduct, any>,
        res: Response,
    ) => {
        /*
            #swagger.tags = ['Products']
            #swagger.description = 'API to update product'
         */

        try {
            const {
                productId
            } = req.params;

            const {name, description, price, size, imageurls} = req.body;

            const productData = {
                "imageUrls": imageurls,
                "name": name,
                "description": description,
                "size": size,
                "price": price
            }

            const result = await this.productServices.updateProductById(productId, productData);

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }

    deleteProduct = async (
        req: Request<DeleteProductById, any, any, any>,
        res: Response,
    ) => {
        /*
            #swagger.tags = ['Products']
            #swagger.description = 'API to delete product by id'
         */

        try {
            const {
                productId
            } = req.params;

            const result = await this.productServices.deleteProduct(productId);

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }
}