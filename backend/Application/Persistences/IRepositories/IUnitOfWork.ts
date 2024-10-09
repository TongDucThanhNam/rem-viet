import type { IBaseUnitOfWork } from "./IBaseUnitOfWork";
import LogRepository from "../../../Infrastructure/Persistences/Respositories/LogRepository";
import ProductRepository from "../../../Infrastructure/Persistences/Respositories/ProductRepository";
import VariantRepository from "../../../Infrastructure/Persistences/Respositories/VariantRepository";

export interface IUnitOfWork extends IBaseUnitOfWork {
    // JobRepository: JobRepository;
    // roleRepository: RoleRepository;
    // notificationRepository: NotificationRepository;
    // userRepository: UserRepository;
    logRepository: LogRepository;
    // cvRepository: CVRepository;
    // companyRepository: CompanyRepository;
    // permissionRepository: PermissionRepository;
    // rolePermissionRepository: RolePermissionRepository
    productRepository: ProductRepository;
    variantRepository: VariantRepository;
}