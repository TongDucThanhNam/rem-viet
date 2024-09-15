import { CoreException } from '../../Common/Exceptions/CoreException';
import { CreateCVResponse } from "../../Features/CV/Responses/CreateCVResponse";
import { GetCVResponse } from "../../Features/CV/Responses/GetCVResponse";
import { GetAllCVResponse } from "../../Features/CV/Responses/GetAllCVResponse";
import { UpdateCVResponse } from "../../Features/CV/Responses/UpdateCVResponse";
import { DeleteCVResponse } from "../../Features/CV/Responses/DeleteCVResponse";

export default interface ICVService{
    createNewCV(data: any): Promise<CreateCVResponse|CoreException>;
    getCVById(_id: string): Promise<GetCVResponse|CoreException>;
    getCVByUserId(userId: string): Promise<GetCVResponse|CoreException>;
    getAllCV(): Promise<GetAllCVResponse|CoreException>;
    updateCVById(_id: string, data: any): Promise<UpdateCVResponse|CoreException>;
    deleteCVById(_id: string): Promise<DeleteCVResponse|CoreException>;
}