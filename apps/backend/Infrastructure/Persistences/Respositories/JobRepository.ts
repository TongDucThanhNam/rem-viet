import {JobWithBase} from "../../../Domain/Entities/JobEntities";
import IJobRepository from "../../../Application/Persistences/IRepositories/IJobRepository";
import mongoose, {ClientSession} from "mongoose";
import {UserWithBase} from "../../../Domain/Entities/UserEntites";

class JobRepository implements IJobRepository {

    async createJob(queryData: any, userID: string, session: ClientSession): Promise<typeof JobWithBase> {

        try {
            const user = await UserWithBase.findOne({_id: userID});
            if (user) {
                queryData.companyId = user.companyId;
            } else {
                throw new Error("Error in Repository: " + "Not Found User");
            }
            ;
            console.log(queryData)
            const Job: any = await JobWithBase.create([{

                companyId: queryData.companyId,
                title_VN: queryData.title_VN,
                title_EN: queryData.title_EN,

                position: queryData.position,
                typeOfWork: queryData.typeOfWork,
                occupation: queryData.occupation,
                major: queryData.major,
                gender: queryData.gender,
                expirationDate: queryData.expirationDate,

                startingSalary: queryData.startingSalary,
                vacanciesNum: queryData.vacanciesNum,
                city: queryData.city,
                district: queryData.district,
                address: queryData.address,

                description_VN: queryData.description_VN,
                description_EN: queryData.description_EN,

                requirement_VN: queryData.requirement_VN,
                requirement_EN: queryData.requirement_EN,
                status: queryData.status,

                benefit_VN: queryData.benefit_VN,
                benefit_EN: queryData.benefit_EN,
                applicationId: queryData.applicationId,

            }], {session});
            return Job[0];

        } catch (error: any) {

            throw new Error("Error at createJob in JobRepository: " + error.message);

        }
    }

    async getJobById(queryData: any): Promise<typeof JobWithBase> {
        try {

            const query: any = {
                _id: queryData.id,
                // isDeleted: queryData.isDeleted,
            };

            // console.log(query);

            const Job: typeof JobWithBase[] = await JobWithBase.find(query).select('-isDeleted -isActive -createdAt -updatedAt -__v');
            // console.log(Job[0])
            return Job[0];

        } catch (error: any) {
            throw new Error("Error at getJobById in JobRepository: " + error.message);
        }
    }

    async updateJobById(jobId: string, updateData: any, session: ClientSession): Promise<void> {
        try {

            const _id = jobId;

            const query = {
                ...updateData,
                updateAt: Date.now(),
            }
            // console.log(query);
            const job: any = await JobWithBase.findByIdAndUpdate(_id, query, {session});
            // console.log(job);
        } catch (error: any) {
            throw new Error("Error at updateJobById in jobRepository: " + error.message);
        }
    }

    async deleteJobById(jobId: string | mongoose.Types.ObjectId, session: ClientSession): Promise<void> {
        try {
            const _id = new mongoose.Types.ObjectId(jobId);

            const query = {isDeleted: true,}

            const job: any = await JobWithBase.findByIdAndUpdate(_id, query, {session});

            // return Job;
        } catch (error: any) {
            throw new Error("Error at deleteJobById in jobRepository: " + error.message);
        }
    }

    async getAllJob(status: any, page: number, session: ClientSession): Promise<any> {
        try {

            const limit = 10;

            var skip = (page - 1) * limit;

            if (skip < 0) {
                skip = 0;
            }

            const job = await JobWithBase.find(status).select('-isDeleted -isActive -createdAt -updatedAt -__v').limit(limit).skip(skip);

            return job;
        } catch (error: any) {
            throw new Error("Error in Repository: " + error.error);
        }
    }

    async getJobByCompanyId(UserID: String, page: number, session: ClientSession): Promise<any> {
        try {

            const limit = 10;

            var skip = (page - 1) * limit;

            const user = await UserWithBase.findOne({_id: UserID});

            var query = {};
            if (user) {
                query = {companyId: user.companyId};
            } else {
                throw new Error("Error in Repository: " + "Not Found User");
            }
            ;

            if (query === null) {
                throw new Error("Error in Repository: " + "Not Found");
            }

            // console.log(query)

            const job = await JobWithBase.find(query).select('-isDeleted -isActive -createdAt -updatedAt -__v').limit(limit).skip(skip);

            return job;
        } catch (error: any) {
            throw new Error("Error in Repository: " + error.error);
        }
    }

    async searchJob(data: any, page: number): Promise<any> {
        const LanguageDetect = require('languagedetect');
        try {
            const limit = 10;

            var skip = (page - 1) * limit;

            if (skip < 0) {
                skip = 0;
            }


            const lngDetector = new LanguageDetect();

            // const francModule = await import('franc');
            const {major, occupation, position, title} = data;
            const query: any = {};

            if (major) query.major = {$regex: major, $options: 'i'};
            if (occupation) query.occupation = {$regex: occupation, $options: 'i'};
            if (position) query.position = {$regex: position, $options: 'i'};
            if (title) {
                var temp = lngDetector.detect(title, 1)[0];
                if (temp[0] === "vietnamese") {

                    query.title_VN = {$regex: title, $options: 'i'};

                } else {

                    query.title_EN = {$regex: title, $options: 'i'};

                }
                ;
            }

            const job = await JobWithBase.find(query).select('-isDeleted -isActive -createdAt -updatedAt -__v').limit(limit).skip(skip);
            console.log(job)
            return job;
        } catch (error: any) {
            throw new Error("Error in Repository: " + error.error);
        }
    }

    async findJobs(queryData: any, skip: number, limit: number): Promise<any> {
        try {
            const jobs = await JobWithBase.find(queryData).select('-isDeleted -isActive -createdAt -updatedAt -__v').limit(limit).skip(skip);
            return jobs;
        } catch (error: any) {
            throw new Error("Error in Repository: " + error.error);
        }
    }

    // từ jobid lấy companyID -> lấy userId 
    async getUserIdbyJobId(jobId: string): Promise<any> {
        try {

            var temp: any = {}

            var userIds: any = [];

            const job: any = await JobWithBase.findOne({_id: jobId});

            if (job) {
                temp.companyId = job.companyId?.toString();

                const companyId = temp.companyId;

                const users: any = await UserWithBase.find({companyId}).select('_id');
                if (users) {
                    userIds = users.reduce((acc: string[], user: any) => {
                        acc.push(user._id.toString());
                        return acc;
                    }, []);
                } else {
                    return new Error("Error in JobRepository: Cant not found Users");
                }
            }
            ;
            console.log(userIds)
            return userIds;

        } catch (error: any) {
            throw new Error("Error in Repository: " + error.error);
        }
    }
}

export default JobRepository;
