export enum JobStatusEnums {
    DRAFT = "draft", //DRAFT("Bản nháp"),
    PENDING = "pending", // DRAFT("Chờ duyệt"),
    APPROVED = "approved", // APPROVED("Đã duyệt"),
    REJECTED = "rejected", // không duyệt
    OPEN = "open",          // OPEN("Đang tuyển"),
    CLOSED = "closed",      //  CLOSED("Đã đóng"),
    EXPIRED = "expired",    // EXPIRED("Hết hạn"),
    ARCHIVED = "archived"   // ARCHIVED("Đã lưu trữ");
}