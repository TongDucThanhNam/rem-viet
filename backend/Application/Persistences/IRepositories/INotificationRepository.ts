import {ClientSession} from 'mongoose';
import {NotificationWithBase} from '../../../Domain/Entities/NotificationEntities';

interface INotificationRepository {
    createNotification(data: any, session: ClientSession): Promise<typeof NotificationWithBase>;

    getNotifiocationById(data: any): Promise<typeof NotificationWithBase>;

    getAllNotificationByUserId(data: any, page: number): Promise<typeof NotificationWithBase[]>;

    updateNotificationById(data: any, updateData: any, session: ClientSession): Promise<void>;

    deleteNotificationById(data: any, session: ClientSession): Promise<void>;
}

export default INotificationRepository;