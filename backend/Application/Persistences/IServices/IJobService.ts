import mongoose, { ClientSession } from "mongoose";
import { createJobResponse } from '../../Features/Job/Response/CreateJobResponse';
import { deleteJobResponse } from '../../Features/Job/Response/DeleteJobResponse';
import { updateJobResponse } from '../../Features/Job/Response/UpdateJobResponse';
import { getJobResponse } from '../../Features/Job/Response/GetJobResponse';
import { getAllJobResponse } from '../../Features/Job/Response/GetAllJobResponse';
import { CoreException } from '../../Common/Exceptions/CoreException';
import { GetJobsOfCompanyResponse } from '../../Features/Job/Response/GetJobsOfCompanyResponse';
import { GetJobsOfCandidateResponse } from '../../Features/Job/Response/GetJobsOfCandidateResponse';


interface IJobService {
    createJobService(queryData: any,userId:string): Promise<any>;
    getJobByIdService(queryData: any): Promise<any>;   
    updateJobByIdService(jobId: string, updateData: any, ): Promise<any>;
    deleteJobByIdService(jobId: string ): Promise<any>;
    changeStatusService(data: any): Promise<any>;
    getAllJobService(data:any,page: number): Promise<getAllJobResponse|CoreException>;
    getJobByCompanyIdService(userId:String,page:number):Promise<any>;
    searchJobService(data: any,page:number): Promise<any>;
    findJobs(queryData: any, skip: number, limit: number): Promise<getAllJobResponse|CoreException>;
    getJobsByRole(userId: string, skip: number, limit: number): Promise<GetJobsOfCompanyResponse|GetJobsOfCandidateResponse|CoreException>;
    getUserIdByJobIdService(JobId:string):Promise<any>;
}

export default IJobService;