
export default interface ILogServices {
    // login(data: any): Promise<LoginResponse> ;
    create(data: any): Promise<any>;
    findById(data: any): Promise<any>;
    findAll(data: any): Promise<any>;
    update(data: any): Promise<any>;
    delete(data: any): Promise<any>;
}