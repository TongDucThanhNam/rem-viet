import { IBaseUnitOfWork } from "./IBaseUnitOfWork";
import { UserWithBase } from "../../../Domain/Entities/UserEntites";
import { ClientSession } from "mongoose";

interface IUserRepository extends IBaseUnitOfWork {
    createUser(userData: any, session: ClientSession): Promise<typeof UserWithBase>;
    checkDuplicateUsername (username: string, queryData: any): Promise<boolean>;
    getUserByUsername(username: string, queryData: any): Promise<any>;
    getUserById(userId: string, queryData: any): Promise<any>;
    deleteUserById(userId: string, queryData: any, session: ClientSession): Promise<any>;
    updateUserById(userId: string, userData: any, session: ClientSession): Promise<any>;
    changePassword(userId: string, userData: any, session: ClientSession): Promise<any>;
}

export default IUserRepository;