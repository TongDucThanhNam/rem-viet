import {CVWithBase} from "../../../Domain/Entities/CVEntities";
import ICVRepository from "../../../Application/Persistences/IRepositories/ICVRepository";
import {BaseUnitOfWork} from './BaseUnitOfWork';
import mongoose from "mongoose";

class CVRepository extends BaseUnitOfWork implements ICVRepository {
    constructor() {
        super();
    }

    async createCV(cvData: any): Promise<typeof CVWithBase> {
        try {
            const cv: any = await CVWithBase.create([{
                isActive: cvData.isActive,
                isDeleted: cvData.isDeleted,
                userId: new mongoose.Types.ObjectId(cvData.userId),
                cvPath: cvData.cvPath,
                isApproved: cvData.isApproved
            }]);
            return cv[0];
        } catch (error: any) {
            console.log("Error at Repository");
            throw new Error("Error at createCV in CVRepository: " + error.message);
        }
    }

    async getCVById(cvData: any): Promise<typeof CVWithBase> {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(cvData._id),
                isDeleted: cvData.isDeleted,
                isActive: cvData.isActive,
            };
            const cv: typeof CVWithBase[] = await CVWithBase.find(query);
            return cv[0];
        } catch (error: any) {
            throw new Error("Error at getCVById in CVRepository: " + error.meesage);
        }
    }

    async getCVByUserId(cvData: any): Promise<typeof CVWithBase> {
        try {
            const query: any = {
                userId: new mongoose.Types.ObjectId(cvData.userId),
                isDeleted: cvData.isDeleted,
                isActive: cvData.isActive,
            };
            const cv: typeof CVWithBase[] = await CVWithBase.find(query);
            return cv[0];
        } catch (error: any) {
            throw new Error("Error at getCVById in CVRepository: " + error.meesage);
        }
    }

    async getAllCV(): Promise<typeof CVWithBase[]> {
        try {
            const cv: typeof CVWithBase[] = await CVWithBase.find();
            return cv;
        } catch (error: any) {
            throw new Error("Error at getCVById in CVRepository: " + error.meesage);
        }
    }

    async updateCVById(cvData: any, cvUpdateData: any): Promise<typeof CVWithBase> {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(cvData._id),
                isActive: cvData.isActive,
                isDeleted: cvData.isDeleted
            };
            await CVWithBase.updateOne(query, cvUpdateData);
            const updatedCV: typeof CVWithBase[] = await CVWithBase.find(query);
            if (!updatedCV) {
                throw new Error("CV not found after update");
            }
            return updatedCV[0];
        } catch (error: any) {
            throw new Error("Error at updateCVById in CVRepository: " + error.message);
        }
    }

    async deleteCVById(cvData: any) {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(cvData._id),
                isDeleted: cvData.isDeleted,
                isActive: cvData.isActive
            };
            await CVWithBase.deleteOne(query);
        } catch (error: any) {
            throw new Error("Error at deleteCVById in CVRepository: " + error.meesage);
        }
    }
}

export default CVRepository;