import {ClientSession} from "mongoose";
import {CompanyWithBase} from "../../../Domain/Entities/CompanyEntities";
import {IBaseUnitOfWork} from "./IBaseUnitOfWork";


interface ICompanyRepository extends IBaseUnitOfWork {
    createCompany(companyData: any): Promise<typeof CompanyWithBase>;

    getCompanyById(query: any): Promise<typeof CompanyWithBase | null>;

    updateCompanyById(companyData: any, companyUpdateData: any): Promise<typeof CompanyWithBase>;

    getAllCompany(queryData: any): Promise<typeof CompanyWithBase[] | null>

    update(companyId: string, query: any, session: ClientSession): Promise<typeof CompanyWithBase | null>;
}

export default ICompanyRepository;