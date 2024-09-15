import mongoose, { ClientSession } from "mongoose";
import { Job, JobWithBase } from "../../../Domain/Entities/JobEntities";

interface IJobRepository {

    createJob(queryData: any,userId:string, session: ClientSession): Promise<typeof JobWithBase>;
    getJobById(queryData: any): Promise<typeof JobWithBase | null>;   
    updateJobById(jobId: string ,updateData: any, session: ClientSession): Promise<void>;
    deleteJobById(jobId: string, session: ClientSession): Promise<void>;
    searchJob(data:any,page:number,session: ClientSession): Promise<typeof JobWithBase[]>;
    getAllJob(data: any,page:number,session: ClientSession): Promise<typeof JobWithBase[]>;
    getJobByCompanyId(userId: string ,page:number, session: ClientSession):Promise<typeof JobWithBase[]>;
    findJobs(queryData: any, skip: number, limit: number): Promise<typeof JobWithBase[]>;
    getUserIdbyJobId(jobId:string): Promise<any>;
}

export default IJobRepository;