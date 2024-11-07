import {IRolePermissionRepository} from "../../../Application/Persistences/IRepositories/IRolePermissionRepository";
import {ClientSession, Types} from "mongoose";
import {RolePermissionWithBase} from "../../../Domain/Entities/RolePermission";

class RolePermissionRepository implements IRolePermissionRepository {
    async createRolePermission(data: any, session: ClientSession): Promise<any> {
        try {
            // console.log("data", data);

            const rolePermission = await RolePermissionWithBase.create([{
                roleId: new Types.ObjectId(data.roleId),
                permissionId: new Types.ObjectId(data.permissionId),
            }], {session});
            return rolePermission[0];
        } catch (error: any) {
            throw new Error("Error at createRolePermission in RolePermissionRepository: " + error.message);
        }
    }

    async deleteRolePermissionById(rolePermissionId: string, session: any): Promise<any> {
        try {
            const query: any = {
                _id: rolePermissionId
            };
            return await RolePermissionWithBase.findOneAndDelete(query, {session});
        } catch (error: any) {
            throw new Error("Error at deleteRolePermissionById in RolePermissionRepository: " + error.message);
        }
    }

    async getAllRolePermissions(query: any): Promise<any> {
        try {
            return await RolePermissionWithBase.find(query);
        } catch (error: any) {
            throw new Error("Error at getAllRolePermissions in RolePermissionRepository: " + error.message);
        }
    }

    async getRolePermissionById(rolePermissionId: string, query: any): Promise<any> {
        try {
            return await RolePermissionWithBase.find({
                _id: rolePermissionId
            });
        } catch (error: any) {
            throw new Error("Error at getRolePermissionById in RolePermissionRepository: " + error.message);
        }
    }

    async deleteRolePermission(data: any, session: ClientSession) {
        try {
            const query: any = {
                roleId: data.roleId,
                permissionId: data.permissionId
            };
            const deleteData: any = {
                isDeleted: true,
                isActive: false,
            }

            const result: any = await RolePermissionWithBase.updateMany(query, deleteData, {session});
            return result;
        } catch (error: any) {
            throw new Error("Error at deleteRolePermission in RolePermissionRepository: " + error.message);
        }
    }
}

export default RolePermissionRepository;