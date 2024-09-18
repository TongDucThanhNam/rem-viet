import {IUnitOfWork} from "../../../Application/Persistences/IRepositories/IUnitOfWork";
import {BaseUnitOfWork} from "./BaseUnitOfWork";
import LogRepository from "./LogRepository";
import ProductRepository from "./ProductRepository";
import VariantRepository from "./VariantRepository";


export class UnitOfWork extends BaseUnitOfWork implements IUnitOfWork {
    // roleRepository: RoleRepository;
    // JobRepository: JobRepository;
    logRepository: LogRepository;
    // notificationRepository: NotificationRepository;
    // userRepository: UserRepository;
    // cvRepository: CVRepository;
    // companyRepository: CompanyRepository;
    // permissionRepository: PermissionRepository;
    // rolePermissionRepository: RolePermissionRepository;
    productRepository: ProductRepository;
    variantRepository: VariantRepository;

    constructor() {
        super();
        // this.JobRepository = new JobRepository();
        // this.roleRepository = new RoleRepository();
        this.logRepository = new LogRepository();
        // this.notificationRepository = new NotificationRepository();
        // this.userRepository = new UserRepository();
        // this.cvRepository = new CVRepository();
        // this.companyRepository = new CompanyRepository();
        // this.permissionRepository = new PermissionRepository();
        // this.rolePermissionRepository = new RolePermissionRepository();
        this.productRepository = new ProductRepository();
        this.variantRepository = new VariantRepository();
    }
}