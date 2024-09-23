import {BaseUnitOfWork} from './BaseUnitOfWork';
import IUserRepository from '../../../Application/Persistences/IRepositories/IUserRepository';
import {UserWithBase} from '../../../Domain/Entities/UserEntites';
import mongoose, {ClientSession} from 'mongoose';
import {hashPassword} from '../../../Application/Common/Helpers/passwordUtils';

class UserRepository extends BaseUnitOfWork implements IUserRepository {
    constructor() {
        super();
    }

    async createUser(userData: any, session: ClientSession): Promise<typeof UserWithBase> {
        try {
            const {password, ...restData} = userData;
            // console.log('restData', restData);

            const hashedPassword: string = await hashPassword(password);

            const user: any = await UserWithBase.create([{
                password: hashedPassword,
                ...restData
            }], {session});

            return user[0];
        } catch (error: any) {
            throw new Error(`Error occured at createUser in UserRepository: ${error.message}`);
        }
    }

    async checkDuplicateUsername(username: string, queryData: any): Promise<boolean> {
        try {
            const data: any = {
                username: username,
                isDeleted: queryData.isDeleted,
                isActive: queryData.isActive,
                roleId: queryData.roleId
            }
            const user: any = await UserWithBase.findOne(data);
            if (user) return true;
            return false;
        } catch (error: any) {
            throw new Error(`Error occured at checkDuplicateUsername in UserRepository: ${error.message}`);
        }
    }

    async getUserByUsername(username: string, queryData: any): Promise<any> {
        try {
            const query: any = {
                username,
                isDeleted: queryData.isDeleted,
                isActive: queryData.isActive,
                //roleId: queryData.roleId
            }
            const user = await UserWithBase.findOne(query).lean();
            return user;
        } catch (error: any) {
            throw new Error(`Error at getUserByUsername in UserRepository: ${error.message}`);
        }
    }

    async getUserById(userId: string, queryData: any): Promise<any> {
        try {
            const query: any = {
                _id: userId,
                ...queryData
            };
            const user: any = await UserWithBase.findOne(query).lean();
            return user;
        } catch (error: any) {
            throw new Error(`Error at getUserById in UserRepository: ${error.message}`);
        }
    }

    async deleteUserById(userId: string, queryData: any, session: ClientSession): Promise<any> {
        try {
            const query: any = {
                _id: userId,
                isDeleted: queryData.isDeleted,
                isActive: queryData.isActive
            }
            const softDelete: any = {
                updatedAt: Date.now(),
                isDeleted: true,
                isActive: false
            }
            await UserWithBase.updateOne(query, softDelete, {session});
            return userId;
        } catch (error: any) {
            throw new Error(`Error at deleteUserById in UserRepository: ${error.message}`);
        }
    }

    async updateUserById(userId: string, userData: any, session: ClientSession): Promise<any> {
        try {
            const _id = new mongoose.Types.ObjectId(userId);
            const updateData: any = {
                ...userData,
                updatedAt: Date.now()
            }
            await UserWithBase.findByIdAndUpdate(_id, updateData, {session});
        } catch (error: any) {
            throw new Error(`Error at updateUserById in UserRepository: ${error.message}`);
        }
    }

    async changePassword(userId: string, userData: any, session: ClientSession): Promise<any> {
        try {
            const hashedPassword: string = await hashPassword(userData.password);

            const query: any = {
                password: hashedPassword,
                updatedAt: Date.now()
            }
            const user = await UserWithBase.findByIdAndUpdate(userId, query, {session});
            return user;
        } catch (error: any) {
            throw new Error(`Error at changePassword in UserRepository: ${error.message}`);
        }
    }
}

export default UserRepository;