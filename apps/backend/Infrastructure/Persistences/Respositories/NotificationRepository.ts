import {ClientSession} from 'mongoose';
import INotificationRepository from '../../../Application/Persistences/IRepositories/INotificationRepository';
import {NotificationWithBase} from '../../../Domain/Entities/NotificationEntities';

class NotificationRepository implements INotificationRepository {
    async createNotification(data: any, session: ClientSession): Promise<typeof NotificationWithBase> {
        try {

            const notification: any = await NotificationWithBase.create([{

                userId: data.userId,
                title: data.title,
                message: data.message,
                isRead: data.isRead,

            }], {session});

            return notification[0];

        } catch (error: any) {

            throw new Error("Error in Noti Repository: " + error.message);

        }
    }

    async getNotifiocationById(data: any): Promise<typeof NotificationWithBase> {
        try {
            const query: any = {

                _id: data.id

            };
            const notification: typeof NotificationWithBase[] = await NotificationWithBase.find(query).select('-isDeleted -isActive -createdAt -updatedAt -__v');
            return notification[0];

        } catch (error: any) {
            throw new Error("Error at Repository: " + error.meesage);
        }
    }

    async updateNotificationById(jobId: string, updateData: any, session: ClientSession): Promise<void> {
        try {

            const _id = jobId;

            const query = {
                ...updateData,
                updateTime: Date.now(),
            }

            const notification: any = await NotificationWithBase.findByIdAndUpdate(_id, query, {session});

        } catch (error: any) {

            throw new Error("Error Updated in Noti-Repository: " + error.meesage);
        }
    }

    async deleteNotificationById(notiId: string, session: ClientSession): Promise<void> {
        try {

            const _id = notiId;

            const query = {isDeleted: true,}

            const notification: any = await NotificationWithBase.findByIdAndUpdate(_id, query, {session});
        } catch (error: any) {
            throw new Error("Error in Repository: " + error.meesage);
        }
    }

    async getAllNotificationByUserId(data: any, page: number): Promise<any> {
        try {
            const limit = 5;

            var skip = (page - 1) * limit;

            const noti = await NotificationWithBase.find(data).select('-isDeleted -isActive -createdAt -updatedAt -__v').limit(limit).skip(skip);
            return noti;
        } catch (error: any) {
            throw new Error("Error in Repository: " + error.meesage);
        }
    }
}

export default NotificationRepository;