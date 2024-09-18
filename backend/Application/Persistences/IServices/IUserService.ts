import {CreateUserResponse} from "../../Features/User/Response/CreateUserResponse";
import {CoreException} from "../../Common/Exceptions/CoreException";
import {LoginResponse} from "../../Features/User/Response/LoginResponse";
import {GetCandidateProfile} from "../../Features/User/Response/GetCandidateProfile";
import {DeleteUserResponse} from "../../Features/User/Response/DeleteUserResponse";
import {UpdateUserResponse} from "../../Features/User/Response/UpdateUserResponse";

export default interface IUserService {
    registerAccount(data: any, roleName: string): Promise<CreateUserResponse | CoreException>;

    login(data: any): Promise<LoginResponse | CoreException>;

    getUserCandidateById(id: any): Promise<GetCandidateProfile | CoreException>;

    deleteUserById(userId: any): Promise<DeleteUserResponse | CoreException>;

    updateProfile(userId: any, updateData: any): Promise<UpdateUserResponse | CoreException>;

    changePassword(userId: any, data: any): Promise<LoginResponse | CoreException>;

    getEmployeeProfile(_id: string): any;

    updateEmployeeProfile(_id: any, updateData: any): any;

    getNewToken(refreshToken: any): any;
}