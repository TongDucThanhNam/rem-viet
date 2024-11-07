import mongoose, {ClientSession, Types} from "mongoose";
import {BaseUnitOfWork} from './BaseUnitOfWork';
import IApplicationRepository from "../../../Application/Persistences/IRepositories/IApplicationRepository";
import {ApplicationWithBase} from "../../../Domain/Entities/ApplicationEntites";
import {CVWithBase} from "../../../Domain/Entities/CVEntities";

class ApplicationRepository extends BaseUnitOfWork implements IApplicationRepository {
    async createApplication(ApplicationData: any, session: ClientSession): Promise<typeof ApplicationWithBase> {
        try {
            const application: any = await ApplicationWithBase.create([{
                cvId: new mongoose.Types.ObjectId(ApplicationData.cvId),
                jobId: new mongoose.Types.ObjectId(ApplicationData.jobId),
                status: ApplicationData.status
            }], {session});
            return application[0];
        } catch (error: any) {
            throw new Error("Error at createApplication in ApplicationRepository: " + error.message);
        }
    }

    async getApplicationById(applicationData: any): Promise<any> {
        try {
            const query = {
                _id: new mongoose.Types.ObjectId(applicationData._id),
                isDeleted: applicationData.isDeleted,
                isActive: applicationData.isActive,
            };
            const application: any = await ApplicationWithBase.find(query)
                .populate({path: 'cvId', select: ['userId', 'cvPath', 'isApproved']});
            // const cvId = new mongoose.Types.ObjectId(application.cvId)
            // const cv: typeof CVWithBase[] = await CVWithBase.find(cvId);
            // .populate('cvId');
            return application[0];
        } catch (error: any) {
            throw new Error(
                "Error at getApplicationById in ApplicationRepository: " + error.message
            );
        }
    }

    async getDetailApplicationByCvId(CvData: any): Promise<any> {
        try {
            const query = {
                cvId: new mongoose.Types.ObjectId(CvData.cvId),
                isDeleted: CvData.isDeleted,
                isActive: CvData.isActive,
            };
            const application: any = await ApplicationWithBase.find(query)
                .populate({
                    path: 'cvId',
                    select: ['userId', 'cvPath', 'isApproved'],
                    populate: {
                        path: 'userId'
                    }
                });
            // const cvId = new mongoose.Types.ObjectId()
            // const cv: typeof CVWithBase[] = await CVWithBase.find();
            // .populate('cvId');
            return application;
        } catch (error: any) {
            throw new Error(
                "Error at getDetailApplicationByCvId in ApplicationRepository: " + error.message
            );
        }
    }

    async getDetailApplicationById(cvData: any): Promise<any> {
        try {
            const query = {
                cvId: new mongoose.Types.ObjectId(cvData.cvId),
                isDeleted: cvData.isDeleted,
                isActive: cvData.isActive,
            };
            const application: any = await ApplicationWithBase.find(query)
                .populate({
                    path: 'cvId',
                    select: ['userId', 'cvPath', 'isApproved'],
                    populate: {
                        path: 'userId'
                    }
                });
            // const cvId = new mongoose.Types.ObjectId()
            // const cv: typeof CVWithBase[] = await CVWithBase.find();
            // .populate('cvId');
            return application[0];
        } catch (error: any) {
            throw new Error(
                "Error at getApplicationById in ApplicationRepository: " + error.message
            );
        }
    }

    async getApplicationByCVIdAndJobId(queryData: any): Promise<typeof ApplicationWithBase> {
        try {
            const data: any = {
                cvId: new mongoose.Types.ObjectId(queryData.cvId),
                jobId: new mongoose.Types.ObjectId(queryData.jobId),
                isDeleted: queryData.isDeleted,
                isActive: queryData.isActive
            }
            const application: typeof ApplicationWithBase[] = await ApplicationWithBase.find(data);
            if (application.length > 0) {
                return application[application.length - 1];
            }
            return application[0];
        } catch (error: any) {
            throw new Error("Error at getApplicationByCVId in ApplicationRepository: " + error.message);
        }
    }

    async getAllApplication(data: any): Promise<typeof ApplicationWithBase[] | null> {
        try {
            const {page, limit} = data;
            const Page = page * 1 || 1;
            const Limit = limit * 1 || 10;
            // Page 1: 1 - 10; Page 2: 11 - 20; Page 3; 21 - 30
            const skip = (Page - 1) * Limit;

            if (page) {
                const applicationCount = await ApplicationWithBase.countDocuments();
                if (skip >= applicationCount) {
                    throw new Error("This Page is not found");
                }
            }
            const applications: typeof ApplicationWithBase[] =
                await ApplicationWithBase.find();
            return applications;
        } catch (error: any) {
            throw new Error(
                "Error at getAllApplication in ApplicationRepository: " + error.message
            );
        }
    }

    async updateApplication(ApplicationId: string, ApplicationData: any, session: ClientSession): Promise<typeof ApplicationWithBase> {
        try {
            const _id = new mongoose.Types.ObjectId(ApplicationId);
            const query = {
                ...ApplicationData,
                updatedAt: Date.now()
            }
            await ApplicationWithBase.updateOne(
                {_id: _id},
                query
            );
            const application: typeof ApplicationWithBase[] = await ApplicationWithBase.find({_id: _id});
            if (!application) {
                throw new Error("Application not found after update");
            }
            return application[0];
        } catch (error: any) {
            throw new Error("Error at updateApplication in ApplicationRepository: " + error.message);
        }
    }

    async filterApplication(queryData: any): Promise<(typeof ApplicationWithBase)[] | null> {
        try {
            const {jobId, page, limit} = queryData;
            const Page = page * 1 || 1;
            const Limit = limit * 1 || 1;
            // Page 1: 1 - 10; Page 2: 11 - 20; Page 3; 21 - 30
            const skip = (Page - 1) * Limit;

            if (page) {
                const applicationCount = await ApplicationWithBase.countDocuments();
                if (skip >= applicationCount) {
                    throw new Error("This Page is not found");
                }
            }
            const application: any = await ApplicationWithBase.find(jobId)
                .skip(skip)
                .limit(Limit);
            return application;
        } catch (error: any) {
            throw new Error(
                "Error at filterApplicationById in ApplicationRepository: " +
                error.message
            );
        }
    }

    async deleteApplicationById(ApplicationId: string, session: ClientSession): Promise<void> {
        try {
            const _id = new mongoose.Types.ObjectId(ApplicationId);
            const application: any = ApplicationWithBase.findByIdAndUpdate(
                _id,
                {isDeleted: true},
                {session}
            );
            return application;
        } catch (error: any) {
            throw new Error("Error at deleteApplication in ApplicationRepository: " + error.message);
        }
    }

    async approvedCV(ApplicationId: string, ApplicationData: any, session: ClientSession): Promise<void> {
        try {
            const _id = new mongoose.Types.ObjectId(ApplicationId);
            const query = {
                ...ApplicationData,
                updateTime: Date.now(),
            }
            const application: any = ApplicationWithBase.findByIdAndUpdate(
                _id,
                query,
                {session}
            ).populate({path: 'cvId', select: ['userId', 'cvPath', 'isApproved']});
            return application;
        } catch (error: any) {
            throw new Error(
                "Error at approvedCV in ApplicationRepository: " +
                error.message
            );
        }
    }

    async getAllApplicationByJobId(queryData: any): Promise<typeof ApplicationWithBase[]> {
        try {
            const data: any = {
                jobId: new mongoose.Types.ObjectId(queryData.jobId),
                isDeleted: queryData.isDeleted,
                isActive: queryData.isActive
            }
            const application: typeof ApplicationWithBase[] = await ApplicationWithBase.find(data);

            return application;
        } catch (error: any) {
            throw new Error("Error at getApplicationByCVId in ApplicationRepository: " + error.message);
        }
    }

    async getCandidatesDetails(applicationIds: Types.ObjectId[]):
        Promise<{
            fullname: string,
            email: string,
            phoneNumber: string,
            cvPath: string
        }[]> {
        try {
            const candidates: any[] = await CVWithBase.aggregate([
                {
                    $match: {
                        _id: {$in: applicationIds}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                {
                    $unwind: {
                        path: "$user",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        fullname: {$ifNull: ['$user.fullname', null]},
                        email: {$ifNull: ['$user.email', null]},
                        phoneNumber: {$ifNull: ['$user.phoneNumber', null]},
                        cvPath: 1,
                        _id: 0
                    }
                }
            ]);

            return candidates as { fullname: string, email: string, phoneNumber: string, cvPath: string }[];
        } catch (error: any) {
            throw new Error("Error at getCandidatesDetails in ApplicationRepository: " + error.message);
        }
    }

    async getUserIDbyCVId(applicationId: string): Promise<any> {

        // trên cơ sở một user/CV

        const app = await ApplicationWithBase.findOne({_id: applicationId}).select('cvId');
        var id = ""
        if (app) {

            const cvid = (app.cvId as any).toString()

            const cv = await CVWithBase.findOne({_id: cvid}).select('userId');

            if (cv) {
                id = (cv.userId as any).toString()
            } else {
                return new Error("Error at getCandidatesDetails in ApplicationRepository: Cannot find candidates");
            }
        } else {
            return new Error("Error at getCandidatesDetails in ApplicationRepository: Cannot find CV");
        }

        return id;
    }


    // async watchCVFromApplication(ApplicationId: string ,queryData: any): Promise<typeof ApplicationWithBase | null > {
    //   try {
    //     const _id = ApplicationId;
    //     const application: any = await ApplicationWithBase.find({
    //       _id,
    //       isDeleted: queryData.isDeleted,
    //       isActive: queryData.isActive,
    //     }).populate({path:'cvId', select: ['cvPath']});
    //     return application;
    //   } catch (error: any) {
    //     throw new Error(
    //       "Error at watchCVFromApplication in ApplicationRepository: " +
    //         error.message
    //     );
    //   }
    // }
}

export default ApplicationRepository;
