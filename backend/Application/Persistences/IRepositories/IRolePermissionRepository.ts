export interface IRolePermissionRepository {
    createRolePermission(data: any, session: any): Promise<any>;

    getRolePermissionById(rolePermissionId: string, query: any): Promise<any>;

    getAllRolePermissions(query: any): Promise<any>;

    deleteRolePermission(rolePermissionId: string, session: any): Promise<any>;

    deleteRolePermissionById(rolePermissionId: string, session: any): Promise<any>;
}