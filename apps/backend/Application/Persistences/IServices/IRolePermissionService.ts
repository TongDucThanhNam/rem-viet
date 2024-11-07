export interface IRolePermissionService {
    create(data: any): Promise<any>;

    findById(data: any): Promise<any>;

    findAll(data: any): Promise<any>;

    delete(data: any): Promise<any>;
}