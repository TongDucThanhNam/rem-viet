import {CompanyWithBase} from "../../../Domain/Entities/CompanyEntities";
import ICompanyRepository from "../../../Application/Persistences/IRepositories/ICompanyRepository";
import {BaseUnitOfWork} from './BaseUnitOfWork';
import mongoose, {ClientSession} from "mongoose";

class CompanyRepository extends BaseUnitOfWork implements ICompanyRepository {
    constructor() {
        super();
    }

    async createCompany(companyData: any): Promise<typeof CompanyWithBase> {
        try {
            const company: any = await CompanyWithBase.create([{
                companyName: companyData.companyName,
                industry: companyData.industry,
                location: companyData.location,
                companySize: companyData.companySize,
                address: companyData.address,
                website: companyData.website,
                email: companyData.email,
                status: companyData.status
            }]);
            return company[0];
        } catch (error: any) {
            console.log("Error at Repository");
            throw new Error("Error at createCompany in CompanyRepository: " + error.message);
        }
    }

    async getCompanyById(queryData: any): Promise<any> {
        try {
            // console.log('companyId', companyId);
            // console.log('queryData', queryData);

            const query = {
                _id: new mongoose.Types.ObjectId(queryData._id),
                isActive: queryData.isActive,
                isDeleted: queryData.isDeleted
            }
            // console.log("Query", query)
            const company: any = await CompanyWithBase.findOne(query);

            // console.log("Result Company", company)
            return company;
        } catch (error: any) {
            throw new Error('Error at findCompanyById in CompanyRepository: ' + error.message);
        }
    }

    async getAllCompany(queryData: any): Promise<typeof CompanyWithBase[] | null> {
        try {
            const {page, limit, status} = queryData;
            const query = {
                status: status
            }
            const Page = page * 1 || 1;
            const Limit = limit * 1 || 5;
            // Page 1: 1 - 10; Page 2: 11 - 20; Page 3; 21 - 30
            const skip = (Page - 1) * Limit;

            if (page) {
                const companyCount = await CompanyWithBase.countDocuments();
                if (skip >= companyCount) {
                    throw new Error("This Page is not found");
                }
            }
            const companies: any = await CompanyWithBase.find(query)
                .skip(skip)
                .limit(Limit);
            return companies;
        } catch (error: any) {
            throw new Error("Error at getAllCompany in CVRepository: " + error.meesage);
        }
    }

    async updateCompanyById(companyData: any, companyUpdateData: any): Promise<typeof CompanyWithBase> {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(companyData._id),
                isActive: companyData.isActive,
                isDeleted: companyData.isDeleted
            };
            await CompanyWithBase.updateOne(query, companyUpdateData);
            const updatedCompany: typeof CompanyWithBase[] = await CompanyWithBase.find(query);
            if (!updatedCompany) {
                throw new Error("Company not found after update");
            }
            return updatedCompany[0];
        } catch (error: any) {
            throw new Error("Error at updateCompanyById in CompanyRepository: " + error.message);
        }
    }

    async update(companyId: string, queryData: any, session: ClientSession): Promise<any> {
        try {
            const baseQuery: any = {
                _id: new mongoose.Types.ObjectId(companyId),
                isActive: true,
                isDeleted: false,
            };

            const checkCompany = await this.getCompanyById(baseQuery);
            if (checkCompany === null) return null;

            const query = {
                ...queryData,
                updatedAt: Date.now()
            }

            const company: any = await CompanyWithBase.findByIdAndUpdate({_id: companyId}, query, {session});

            if (company == null) return null;

            return company;
        } catch (error: any) {
            throw new Error('Error at findCompanyById in CompanyRepository: ' + error.message);
        }
    }
}

export default CompanyRepository;