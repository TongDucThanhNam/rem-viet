import { Certificate, CertificateWithBase } from "../../../Domain/Entities/CertificateEntities";
import ICertificateRepository from "../../../Application/Persistences/IRepositories/ICertificateRepository";
import { BaseUnitOfWork } from './BaseUnitOfWork';
import mongoose from "mongoose";

class CertificateRepository extends BaseUnitOfWork implements ICertificateRepository{ constructor(){ super(); }
    async createCertificate(CertificateData: any): Promise<typeof CertificateWithBase>{
        try {
          const certificate: any = await CertificateWithBase.create([{
              name: CertificateData.name,
              type: CertificateData.type,
              description: CertificateData.description,
              userId: new mongoose.Types.ObjectId(CertificateData.userId),
              fileURL: CertificateData.fileURL,
              issueDate: CertificateData.issueDate,
              expiryDate: CertificateData.expiryDate,
              isActive: CertificateData.isActive,
              isDeleted: CertificateData.isDeleted
          }]);       
          return certificate[0];
        }catch (error: any) {
          console.log("Error at Repository");
          throw new Error("Error at createCertificate in CertificateRepository: " + error.message);
        }
    }

    async getCertificateById(CertificateData: any): Promise<typeof CertificateWithBase>{
        try {
          const query: any = {
            _id: new mongoose.Types.ObjectId(CertificateData._id),
            isDeleted: CertificateData.isDeleted,
            isActive: CertificateData.isActive,
          };
          const certificate: typeof CertificateWithBase[] = await CertificateWithBase.find(query);
          return certificate[0];
        } catch (error: any) {
          throw new Error("Error at getCertificateById in CertificateRepository: " + error.meesage);
        }
    }

    async getAllCertificateByUserId(CertificateData: any): Promise<typeof CertificateWithBase[]>{
      try {
        const query: any = {
          userId: new mongoose.Types.ObjectId(CertificateData.userId),
          isDeleted: CertificateData.isDeleted,
          isActive: CertificateData.isActive,
        };
        const certificate: typeof CertificateWithBase[] = await CertificateWithBase.find(query);
        return certificate;
      } catch (error: any) {
        throw new Error("Error at getAllCertificateByUserId in CertificateRepository: " + error.meesage);
      }
  }

    async getAllCertificate(): Promise<typeof CertificateWithBase[]>{
        try {
          const certificate: typeof CertificateWithBase[] = await CertificateWithBase.find();
          return certificate;
        } catch (error: any) {
          throw new Error("Error at getCertificateById in CertificateRepository: " + error.meesage);
        }
    }

    async updateCertificateById(CertificateData: any, CertificateUpdateData: any): Promise<typeof CertificateWithBase> {
      try {
        const query: any = {
          _id: new mongoose.Types.ObjectId(CertificateData._id),
          isActive: CertificateData.isActive,
          isDeleted: CertificateData.isDeleted
        };
        console.log(CertificateUpdateData);
        await CertificateWithBase.updateOne(query, CertificateUpdateData);
        const updatedCertificate: typeof CertificateWithBase[] = await CertificateWithBase.find(query);
        if (!updatedCertificate) {
          throw new Error("Certificate not found after update");
        }
        return updatedCertificate[0];
      } catch (error: any) {
        throw new Error("Error at updateCertificateById in CertificateRepository: " + error.message);
      }
    }

    async deleteCertificateById(CertificateData: any){
        try {
          const query: any = {
            _id: new mongoose.Types.ObjectId(CertificateData._id),
            isDeleted: CertificateData.isDeleted,
            isActive: CertificateData.isActive
          };
          await CertificateWithBase.deleteOne(query);
        } catch (error: any) {
          throw new Error("Error at deleteCertificateById in CertificateRepository: " + error.meesage);
        }
    }
}

export default CertificateRepository;