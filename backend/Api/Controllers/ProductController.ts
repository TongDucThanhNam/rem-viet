import {Request, Response} from 'express';
import IProductService from "../../Application/Persistences/IServices/IProductService";
import ProductService from "../../Application/Features/Product/ProductService";
import {CreateProductRequest} from "../../Application/Features/Product/Requests/CreateProductRequest";
import {IVariant} from "../../Domain/Interface/IVariant";


export default class ProductController {
    private productServices: IProductService = new ProductService();

    getAllProducts = async (
        req: Request,
        res: Response,
    ) => {
        //#swagger.tags = ['Products']
        //#swagger.description = 'API to get all products'
        /* #swagger.parameters['query'] = {
            "page": 1,
            "limit": 10
        }
         */

        /*
            #swagger.responses[200] = {
                description: 'Successfully',
                schema: {
                  "products": {
                    "currentPage": 1,
                    "totalPage": 1,
                    "totalItems": 3,
                    "perPage": 10,
                    "data": [
                      {
                        "_id": "66e6a2f5a0a8d5be45d8f568",
                        "name": "Product Name",
                        "description": "Product Description",
                        "size": [
                          30,
                          30,
                          10
                        ],
                        "__v": 0
                      },
                    ]
                  }
                }
            }
         */

        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;

            const queryData = {
                page,
                limit
            }

            const result = await this.productServices.getAllProducts(queryData);

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }
    getProductById = async (
        req: Request,
        res: Response,
    ) => {
        //#swagger.tags = ['Products']

        //#swagger.description = 'API to get product by id'

        /* #swagger.parameters['productId'] = {
                in: 'path',
                description: 'Product Id',
                required: true,
                type: 'string',
                example: '66e6a3aaa0a8d5be45d8f572'
         }
        */

        /* #swagger.responses[200] = {
                    description: 'Successfully',
                    schema: {
                          "message": "Product found",
                          "statusCode": 200,
                          "data": {
                            "productId": "66e6a3aaa0a8d5be45d8f572",
                            "name": "Product1",
                            "description": "daedak",
                            "size": [
                              30,
                              30,
                              10
                            ]
                        }
                    }
                }
         */

        try {
            const productId = req.params.productId;

            const result = await this.productServices.getProductById(productId, {});

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }

    getProductAndVariantById = async (
        req: Request,
        res: Response,
    ) => {
        //#swagger.tags = ['Products']

        //#swagger.description = 'API to get product and variant by id'

        /* #swagger.parameters['productId'] = {
                in: 'path',
                description: 'Product Id',
                required: true,
                type: 'string',
                example: '66e6a3aaa0a8d5be45d8f572'
         }
        */

        /* #swagger.responses[200] = {
                    description: 'Successfully',
                    schema: {
                          "message": "Product found",
                          "statusCode": 200,
                          "data": {
                            "productId": "66e6a3aaa0a8d5be45d8f572",
                            "name": "Product1",
                            "description": "daedak",
                            "size": [
                              30,
                              30,
                              10
                            ],
                            "variants": [
                                {
                                    "price": 100,
                                    "quantity": 10,
                                    "attributes": {
                                        "color": "red",
                                        "size": "M"
                                    }
                                },
                                {
                                    "price": 110,
                                    "quantity": 5,
                                    "attributes": {
                                        "color": "blue",
                                        "size": "L"
                                    }
                                }
                            ]
                        }
                    }
                }
         */

        try {
            const productId = req.params.productId;

            const result = await this.productServices.getProductAndVariantsById(productId);

            //Id

            res.status(200).json(result);

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }

    createProduct = async (
        req: Request<any, any, CreateProductRequest>,
        res: Response,
    ) => {
        //#swagger.tags = ['Products']
        //#swagger.description = 'API to create product'


        try {
            // console.log("Request", req.body);
            const {name, description, price, size, variants, imageurls} = req.body;
            //Product
            const productData = {
                "imageUrls": imageurls,
                "name": name,
                "description": description,
                "size": size,
                "price": price ?? "0"
            }

            console.log("ProductData", productData);
            console.log("VariantData", variants);

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
            console.log("Price", price);
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
}