import {BitwisePermissionEnums} from "./PermissionEnums";


/**
 * Export rolePermissions
 */
export enum RolePermissionEnums {
    GuestPermission = BitwisePermissionEnums.ViewJob,
    CandidatePermission = BitwisePermissionEnums.ManageOwnCV | BitwisePermissionEnums.ManageOwnProfile |
        BitwisePermissionEnums.SubmitOwnCv | BitwisePermissionEnums.ViewOwnApplication,
    CompanyEmployeePermission = BitwisePermissionEnums.ManageOwnJob |
        BitwisePermissionEnums.ViewIntervieweeProfile | BitwisePermissionEnums.ViewIntervieweeCV |
        BitwisePermissionEnums.ManageOwnJobApplication,
    CompanyAdminPermission = BitwisePermissionEnums.ManageCompanyProfile | BitwisePermissionEnums.ManageCompanyEmployee,

    AdminPermission = BitwisePermissionEnums.ManageUser | BitwisePermissionEnums.ManageJob |
        BitwisePermissionEnums.ManageApplication | BitwisePermissionEnums.ViewLog | BitwisePermissionEnums.ManageCompany
}