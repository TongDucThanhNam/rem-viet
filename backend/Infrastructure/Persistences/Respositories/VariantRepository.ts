import IVariantRepository from "../../../Application/Persistences/IRepositories/IVariantRepository";
import {VariantWithBase} from "../../../Domain/Entities/VariantEntities";

class VariantRepository implements IVariantRepository {
    async createVariant(variantData: any): Promise<any> {
        try {
            //Variant
            // const variantData = [
            //     [{"key":0,"values":{"Colors":"R","Sizes":"S"},"price":1},
            //    {"key":1,"values":{"Colors":"R","Sizes":"M"},"price":2},
            //    {"key":2,"values":{"Colors":"R","Sizes":"L"},"price":3},
            // ];
            const variant = await VariantWithBase.create([variantData]);
            return variant[0];
        } catch (error: any) {
            throw new Error("Error at createVariant in VariantRepository: " + error.message);
        }
    }

    async deleteVariantById(variantId: string): Promise<any> {
        try {
            const softDelete = {
                updatedAt: Date.now(),
                isDeleted: true,
                isActive: false
            }
            return await VariantWithBase.updateOne(
                {_id: variantId},
                {$set: softDelete}
            );
        } catch (error: any) {
            throw new Error("Error at deleteVariantById in VariantRepository: " + error.message);
        }
    }

    async getAllVariants(queryData: any): Promise<any> {
        try {
            return await VariantWithBase.find(queryData);
        } catch (error: any) {
            throw new Error("Error at getAllVariants in VariantRepository: " + error.message);
        }
    }

    async getVariantById(variantId: string, queryData: any): Promise<any> {
        try {
            return await VariantWithBase.findOne({
                _id: variantId,
                ...queryData
            });
        } catch (error: any) {
            throw new Error("Error at getVariantById in VariantRepository: " + error.message);

        }
    }

    async getVariantIdByVariantName(variantName: string, queryData: any): Promise<any> {
        try {
            const variant = await VariantWithBase.findOne({
                variantName: variantName,
                ...queryData
            });
            return (variant as any)?._id;
        } catch (error: any) {
            throw new Error("Error at getVariantIdByVariantName in VariantRepository: " + error.message);
        }
    }

    async updateVariantById(variantId: string, variantData: any): Promise<any> {
        try {
            return await VariantWithBase.updateOne(
                {_id: variantId},
                {$set: variantData}
            );
        } catch (error: any) {
            throw new Error("Error at updateVariantById in VariantRepository: " + error.message);
        }
    }
}

export default VariantRepository;