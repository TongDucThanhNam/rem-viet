import {Request, Response} from 'express';
import IProductService from "../../Application/Persistences/IServices/IProductService";
import ProductService from "../../Application/Features/Product/ProductService";
import {CreateProductRequest} from "../../Application/Features/Product/Requests/CreateProductRequest";

//     [{"key":0,"values":{"Colors":"R","Sizes":"S"},"price":1},
interface Variant {
    price: number;
    quantity: number;
    attributes: any;
}

export default class ProductController {
    private productServices: IProductService = new ProductService();

    createProduct = async (
        req: Request<any, any, CreateProductRequest>,
        res: Response,
    ) => {
        //#swagger.tags = ['Products']
        //#swagger.description = 'API to create product'
        /*
            #swagger.parameters['body'] = {
                in: 'body',
                description: 'Product information',
                schema: {
                    name: 'string',
                    description: 'string',
                    size: [30, 30, 10],
                    variants: [
                        {
                            price: 100,
                            quantity: 10,
                            attributes: {
                                color: "red",
                                size: "M"
                            }
                        },
                        {
                            price: 110,
                            quantity: 5,
                            attributes: {
                                color: "blue",
                                size: "L"
                            }
                        },
                    ]
                }
            }
         */

        try {
            // const jsonString = JSON.stringify({
            //     name: product.name,
            //     description: product.description,
            //     size: [30, 30, 10],
            //     price: product.price,
            //     variants: variantCombinations,
            // });
            const {name, description, price, size, variants} = req.body;

            //Log
            console.log('Request body: ', req.body);
            console.log(name, description, size, variants);

            //Product
            const productData = {
                "name": name,
                "description": description,
                "size": size,
                "price": price
            }

            //Variant
            // const variantData = [
            //     [{"key":0,"values":{"Colors":"R","Sizes":"S"},"price":1},
            //    {"key":1,"values":{"Colors":"R","Sizes":"M"},"price":2},
            //    {"key":2,"values":{"Colors":"R","Sizes":"L"},"price":3},
            // ];
            let min = 99999999999;
            let max = 0;
            const variantData = variants.map((variant: Variant) => {
                if (variant.price < min) {
                    min = variant.price;
                }
                if (variant.price > max) {
                    max = variant.price;
                }
                return {
                    ...variant
                }
            })
            productData['price'] = `${min} - ${max}`;

            //Create product
            await this.productServices.createProduct(
                //ProductDataa
                productData,
                //VariantData
                variantData
            );


            res.status(200).json({message: 'Product created successfully'});

        } catch (error: any) {
            res.status(500).json({message: error.message});
        }
    }
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

        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

            const queryData = {
                page,
                limit
            }

            const products = await this.productServices.getAllProducts(queryData);

            res.status(200).json({products});

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
}