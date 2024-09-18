import {ClientSession, Types} from "mongoose";
import {ApplicationWithBase} from "../../../Domain/Entities/ApplicationEntites";
import {IBaseUnitOfWork} from "./IBaseUnitOfWork";


interface IApplicationRepository extends IBaseUnitOfWork {
    createApplication(ApplicationData: any, session: ClientSession): Promise<typeof ApplicationWithBase>;

    getApplicationById(applicationData: any): Promise<any>;

    getDetailApplicationById(applicationData: any): Promise<any>;

    getApplicationByCVIdAndJobId(queryData: any): Promise<typeof ApplicationWithBase>;

    getAllApplication(data: any): Promise<typeof ApplicationWithBase[] | null>;

    updateApplication(ApplicationId: string, ApplicationData: any, session: ClientSession): Promise<typeof ApplicationWithBase>;

    deleteApplicationById(ApplicationId: string, session: ClientSession): Promise<void>;

    filterApplication(queryData: any): Promise<typeof ApplicationWithBase[] | null>;

    getAllApplicationByJobId(queryData: any): Promise<typeof ApplicationWithBase[] | null>;

    getCandidatesDetails(applicationIds: Types.ObjectId[]): Promise<{
        fullname: string,
        email: string,
        phoneNumber: string,
        cvPath: string
    }[]>;

    // watchCVFromApplication(ApplicationId: any, queryData: any): Promise<typeof ApplicationWithBase | null >;

    approvedCV(ApplicationId: string, ApplicationData: any, session: ClientSession): Promise<void>;

    getUserIDbyCVId(CVId: string): Promise<string>;

    getDetailApplicationByCvId(CvData: any): Promise<typeof ApplicationWithBase>;


}

export default IApplicationRepository;