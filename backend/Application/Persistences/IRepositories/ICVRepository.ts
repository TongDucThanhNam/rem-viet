import { ClientSession } from "mongoose";
import { CV, CVWithBase } from "../../../Domain/Entities/CVEntities";
import { IBaseUnitOfWork } from "./IBaseUnitOfWork";


interface ICVRepository extends IBaseUnitOfWork{
    createCV(cvData: any): Promise<typeof CVWithBase>;
    getCVById(cvData: any): Promise<typeof CVWithBase>;
    getCVByUserId(cvData: any): Promise<typeof CVWithBase>
    getAllCV(): Promise<typeof CVWithBase[]>;
    updateCVById(cvData: any, queryData: any): Promise<typeof CVWithBase>;
    deleteCVById(cvData: any);
}

export default ICVRepository;