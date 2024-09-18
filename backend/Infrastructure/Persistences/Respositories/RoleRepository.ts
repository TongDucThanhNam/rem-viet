import mongoose, {ClientSession} from "mongoose";
import IRoleRepository from "../../../Application/Persistences/IRepositories/IRoleRepository";
import {RoleWithBase} from "../../../Domain/Entities/RoleEntities";

class RoleRepository implements IRoleRepository {
    async createRole(roleData: any, session: ClientSession): Promise<typeof RoleWithBase> {
        try {
            const role: any = await RoleWithBase.create([{
                name: roleData.name,
                description: roleData.description,
                bitwisePermission: roleData.bitwisePermission
            }], {session});
            return role;
        } catch (error: any) {
            throw new Error("Error at createRole in RoleRepository: " + error.message);
        }
    }

    async deleteRoleById(roleId: string, session: ClientSession): Promise<typeof RoleWithBase | null> {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(roleId)
            }
            const result: typeof RoleWithBase | null = await RoleWithBase.findOneAndUpdate(query, {
                isActive: false,
                isDeleted: true
            }, {
                session
            });

            if (result == null) return null;
            return result;
        } catch (error: any) {
            throw new Error("Error at deleteRoleById in RoleRepository: " + error.message);
        }
    }

    async getRoleById(roleId: string, queryData: any): Promise<typeof RoleWithBase | null> {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(roleId),
                isActive: queryData.isActive,
                isDeleted: queryData.isDeleted
            };
            const roles: typeof RoleWithBase[] = await RoleWithBase.find(query);
            if (roles == null) return null;
            return roles[0];
        } catch (error: any) {
            throw new Error("Error at getRoleById in RoleRepository: " + error.message);
        }
    }

    async updateRoleById(roleId: string, roleData: any, session: ClientSession): Promise<typeof RoleWithBase | null> {
        try {
            const query: any = {
                _id: new mongoose.Types.ObjectId(roleId)
            };
            const result: typeof RoleWithBase | null = await RoleWithBase.findOneAndUpdate(query, {
                name: roleData.name,
                description: roleData.description,
                bitwisePermission: roleData.bitwisePermission
            }, {session});

            if (result == null) return null;

            return result;


        } catch (error: any) {
            throw new Error("Error at updateRoleById in RoleRepository: " + error.message);
        }
    }

    async getAllRoles(queryData: any): Promise<typeof RoleWithBase[] | null> {
        try {
            const query: any = {
                isActive: queryData.isActive,
                isDeleted: queryData.isDeleted
            };
            return await RoleWithBase.find(query) ?? null;

        } catch (error: any) {
            throw new Error("Error at getAllRoles in RoleRepository: " + error.message);
        }
    }

    async getRoleIdByRoleName(roleName: string, queryData: any): Promise<string | null | unknown> {
        try {
            const query: any = {
                name: roleName,
                isDeleted: queryData.isDeleted,
                isActive: queryData.isActive
            }
            const role = await RoleWithBase.findOne(query)
            if (!role) return null;
            return role._id;
        } catch (error: any) {
            throw new Error("Error occured at getRoleIdByRoleName in RoleRepository: " + error.message);
        }
    }
}

export default RoleRepository;
