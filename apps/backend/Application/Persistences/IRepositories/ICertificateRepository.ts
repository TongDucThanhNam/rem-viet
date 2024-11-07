import {CertificateWithBase} from "../../../Domain/Entities/CertificateEntities";
import {IBaseUnitOfWork} from "./IBaseUnitOfWork";


interface ICertificateRepository extends IBaseUnitOfWork {
    createCertificate(CertificateData: any): Promise<typeof CertificateWithBase>;

    getCertificateById(CertificateData: any): Promise<typeof CertificateWithBase>;

    getAllCertificateByUserId(CertificateData: any): Promise<typeof CertificateWithBase[]>

    getAllCertificate(): Promise<typeof CertificateWithBase[]>;

    updateCertificateById(CertificateData: any, queryData: any): Promise<typeof CertificateWithBase>;

    deleteCertificateById(CertificateData: any);
}

export default ICertificateRepository;