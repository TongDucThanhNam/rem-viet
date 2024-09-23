/**
 * Enum for bitwise permissions.
 * @enum
 * @readonly
 */
export enum BitwisePermissionEnums {
    ViewJob = 0, //Guest can view job

    //Candidate
    ManageOwnCV = 1 << 0, //Candidate can manage own CV
    ManageOwnProfile = 1 << 1, //Candidate can manage own profile
    SubmitOwnCv = 1 << 2, //Candidate can submit own CV
    ViewOwnApplication = 1 << 3, //Candidate can view own application

    // Company Employee
    ManageOwnJob = 1 << 4, //Company employee can manage own job
    ViewIntervieweeProfile = 1 << 5, //Company employee can view interviewee profile
    ViewIntervieweeCV = 1 << 6, //Company employee can view interviewee CV
    ManageOwnJobApplication = 1 << 7, //Company employee can view, update own application

    //Company Admin
    ManageCompanyProfile = 1 << 8, //Company can manage company profile
    ManageCompanyEmployee = 1 << 9, //Company admin can manage company employee

    //Admin
    ManageUser = 1 << 10, //Admin can manage user
    ManageJob = 1 << 11, //Admin can manage job
    ManageApplication = 1 << 12, //Admin can manage application
    ViewLog = 1 << 13, //Admin can view log
    ManageCompany = 1 << 14, //Admin can manage company
}