import {Db, DeleteResult, InsertOneResult} from "mongodb";
import {User} from "../../../Domain/Entities/UserEntites";
import {UpdateWriteOpResult} from "mongoose";

interface IBaseRepository {
    connectDB(): Promise<Db>;

    insertDocuments<T>(data: T): Promise<InsertOneResult<T>>

    findDocuments<T>(query: object, projectionOptions: object | null, sortOptions: object, page?: number, limit?: number): Promise<T[]>;

    updateDocument<T>(query: object, update: typeof User): Promise<UpdateWriteOpResult>;

    deleteDocument<T>(query: object): Promise<DeleteResult>;
}

export default IBaseRepository;