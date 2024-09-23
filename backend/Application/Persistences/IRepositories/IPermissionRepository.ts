export interface IPermissionRepository {
    createPermission(data: any, session: any): Promise<any>;

    getPermissionById(permissionId: string, query: any): Promise<any>;

    getAllPermissions(query: any): Promise<any>;

    updatePermissionById(permissionId: string, data: any, session: any): Promise<any>;

    deletePermissionById(permissionId: string, session: any): Promise<any>;
}