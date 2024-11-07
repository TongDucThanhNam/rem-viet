import {CoreException} from '../../Common/Exceptions/CoreException';
import {CreateCertificateResponse} from "../../Features/Certificate/Responses/CreateCertificateResponse";
import {GetCertificateResponse} from "../../Features/Certificate/Responses/GetCertificateResponse";
import {GetAllCertificateResponse} from "../../Features/Certificate/Responses/GetAllCertificateResponse";
import {UpdateCertificateResponse} from "../../Features/Certificate/Responses/UpdateCertificateResponse";
import {DeleteCertificateResponse} from "../../Features/Certificate/Responses/DeleteCertificateResponse";

export default interface ICertificateService {
    createNewCertificate(data: any): Promise<CreateCertificateResponse | CoreException>;

    getCertificateById(_id: string): Promise<GetCertificateResponse | CoreException>;

    getAllCertificateByUserId(userId: string): Promise<GetAllCertificateResponse | CoreException>;

    getAllCertificate(): Promise<GetAllCertificateResponse | CoreException>;

    updateCertificateById(_id: string, data: any): Promise<UpdateCertificateResponse | CoreException>;

    deleteCertificateById(_id: string): Promise<DeleteCertificateResponse | CoreException>;
}