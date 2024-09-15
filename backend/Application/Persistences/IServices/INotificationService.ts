import { CoreException } from '../../Common/Exceptions/CoreException';

interface INotificationService {

    createNotificationService(queryData: any,): Promise<any>;
    getNotifiocationByIdService(queryData: any): Promise<any>;   
    updateNotificationByIdService(notiId: string, updateData: any, ): Promise<any>;
    deleteNotificationByIdService(notiId: string ): Promise<any>
    getAllNotificationByUserIdService(data: any,page:number): Promise<any> 
}

export default INotificationService;