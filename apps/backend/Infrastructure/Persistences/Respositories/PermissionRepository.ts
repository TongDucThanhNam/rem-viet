import {IPermissionRepository} from "../../../Application/Persistences/IRepositories/IPermissionRepository";
import {PermissionWithBase} from "../../../Domain/Entities/Permission";

class PermissionRepository implements IPermissionRepository {
    async createPermission(data: any, session: any): Promise<any> {
        try {
            const permission: any = await PermissionWithBase.create([{
                name: data.name,
                description: data.description,
                bitwise: data.bitwise
            }], {session});
            return permission;
        } catch (error: any) {
            throw new Error("Error at createPermission in PermissionRepository: " + error.message);
        }
    }

    deletePermissionById(permissionId: string, session: any): Promise<any> {
        try {
            const query: any = {
                _id: permissionId
            }
            return PermissionWithBase.findOneAndUpdate(query, {
                isActive: false,
                isDeleted: true
            }, {
                session
            });
        } catch (error: any) {
            throw new Error("Error at deletePermissionById in PermissionRepository: " + error.message);
        }
    }

    async getAllPermissions(query: any): Promise<any> {
        try {
            const {limit, page, ...queryData} = query;
            let _page = page > 0 ? page : 1;
            let _limit = limit > 0 ? limit : 10;
            const totalPermissions: any = await PermissionWithBase.countDocuments(queryData);

            const permissions: any = await PermissionWithBase.find(queryData).limit(_limit).skip((_page - 1) * _limit);
            return {
                currentPage: _page,
                totalItems: totalPermissions,
                totalPages: Math.ceil(totalPermissions / _limit),
                perPage: _limit,
                data: permissions
            };
        } catch (error: any) {
            throw new Error("Error at getAllPermissions in PermissionRepository: " + error.message);
        }
    }

    async getPermissionById(permissionId: string, query: any): Promise<any> {
        try {
            const queryData: any = {
                _id: permissionId,
                ...query
            }
            const permissions: any = await PermissionWithBase.find(queryData);
            return permissions;
        } catch (error: any) {
            throw new Error("Error at getPermissionById in PermissionRepository: " + error.message);
        }
    }

    async updatePermissionById(permissionId: string, data: any, session: any): Promise<any> {
        try {
            const query: any = {
                _id: permissionId
            }
            // console.log("query: ", query);
            // console.log("data: ", data);


            return PermissionWithBase.findOneAndUpdate(query, {
                name: data.name,
                description: data.description,
                bitwise: data.bitwise
            }, {
                session
            });
        } catch (error: any) {
            throw new Error("Error at updatePermissionById in PermissionRepository: " + error.message);
        }
    }
}

export default PermissionRepository;