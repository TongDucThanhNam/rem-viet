export default interface IProductService {
    getProductById(productId: string, queryData: any): Promise<any>;

    getProductAndVariantsById(productId: string): Promise<any>;

    getAllProducts(queryData: any): Promise<any>;

    createProduct(productData: any, variantData: any): Promise<any>;

    updateProductById(productId: string, productData: any): Promise<any>;

    updateProductAndVariantsById(productId: string, productData: any, variantData: any): Promise<any>;

    deleteProductById(productId: string): Promise<any>;

    getProductIdByProductName(productName: string, queryData: any): Promise<any>;
}