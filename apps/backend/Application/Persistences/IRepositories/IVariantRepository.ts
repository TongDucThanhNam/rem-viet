interface IVariantRepository {
    getVariantById(variantId: string, queryData: any): Promise<any>;

    getVariantByProductId(productId: string, queryData: any): Promise<any>

    getAllVariants(queryData: any): Promise<any>;

    createVariant(variantData: any): Promise<any>;

    updateVariantById(variantId: string, variantData: any): Promise<any>;

    deleteVariantById(variantId: string): Promise<any>;

    getVariantIdByVariantName(variantName: string, queryData: any): Promise<any>;
}

export default IVariantRepository;