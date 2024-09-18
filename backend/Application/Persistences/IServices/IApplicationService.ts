import {CoreException} from "../../Common/Exceptions/CoreException";
import {CreateApplicationResponse} from "../../Features/Application/Response/CreateApplicationResponse";
import {DeleteApplicationResponse} from "../../Features/Application/Response/DeleteApplicationResponse";
import {GetAllApplicationByJobIdResponse} from "../../Features/Application/Response/GetAllApplicationByJobIdResponse";
import {GetAllApplicationResponse} from "../../Features/Application/Response/GetAllApplicationResponse";
import {GetApplicationResponse} from "../../Features/Application/Response/GetApplicationResponse";
import {GetDetailApplicationResponse} from "../../Features/Application/Response/GetDetailApplicationResponse";
import {UpdateApplicationResponse} from "../../Features/Application/Response/UpdateApplicationResponse";
import {ChangeStatusApplicationResponse} from "../../Features/Application/Response/ChangeStatusApplicationResponse";
import {FindApplicationResponse} from "../../Features/Application/Response/FindApplicationResponse";
import {GetApplicationByCvIdResponse} from "../../Features/Application/Response/GetApplicationByCvIdResponse";

interface IApplicationService {
    createApplicationService(data: any): Promise<CreateApplicationResponse | CoreException>;

    getApplicationService(data: any): Promise<GetApplicationResponse | CoreException>;

    getDetailApplicationService(data: any): Promise<GetDetailApplicationResponse | CoreException>;

    getAllApplicationService(data: any): Promise<GetAllApplicationResponse | CoreException>;

    updateApplicationService(ApplicationData: any): Promise<UpdateApplicationResponse | CoreException>;

    changeStatusApplicationService(ApplicationData: any): Promise<ChangeStatusApplicationResponse | CoreException>;

    deleteApplicationService(data: any): Promise<DeleteApplicationResponse | CoreException>;

    filterApplicationService(data: any): Promise<FindApplicationResponse | CoreException>;

    getAllApplicationByJobIdService(data: any): Promise<GetAllApplicationByJobIdResponse | CoreException>;

    getExportApplicationByJobIdService(data: any): Promise<Buffer | CoreException>;

    // approvedCVService(data: any): Promise<any | CoreException>;
    // watchCVFromApplicationService(data: any): Promise<any | CoreException>;
    getUserIDbyapplicationIdService(id: string): Promise<string>;

    getApplicationByCvIdService(data: any): Promise<GetApplicationByCvIdResponse | CoreException>;
}

export default IApplicationService;