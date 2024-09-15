import {DangerCircleSvg} from "./danger-circle";
import {DefaultCircleSvg} from "./default-circle";
import {SuccessCircleSvg} from "./success-circle";
import {WarningCircleSvg} from "./warning-circle";

export const statusOptions = [
    {name: "Active", uid: "active"},
    {name: "Inactive", uid: "inactive"},
    {name: "Paused", uid: "paused"},
    {name: "Vacation", uid: "vacation"},
] as const;

export type StatusOptions = (typeof statusOptions)[number]["name"];

export const statusColorMap: Record<StatusOptions, JSX.Element> = {
    Active: SuccessCircleSvg,
    Inactive: DefaultCircleSvg,
    Paused: DangerCircleSvg,
    Vacation: WarningCircleSvg,
};

type Teams =
    | "Design"
    | "Product"
    | "Marketing"
    | "Management"
    | "Engineering"
    | "Sales"
    | "Support"
    | "Other"
    | (string & {});

export type MemberInfo = {
    avatar: string;
    email: string;
    name: string;
};

export type Users = {
    id: string;
    externalWorkerID: string;
    status: StatusOptions;
    startDate: Date;
};

export type ColumnsKey =
    | "externalWorkerID"
    | "status"
    | "startDate"
    | "actions";

export const INITIAL_VISIBLE_COLUMNS: ColumnsKey[] = [
    "externalWorkerID",
    "status",
    "startDate",
    "actions",
];

export const columns = [
    {name: "External Worker ID", uid: "externalWorkerID"},
    {name: "Status", uid: "status", info: "The user's current status"},
    {name: "Start Date", uid: "startDate", info: "The date the user started"},
    {name: "Actions", uid: "actions"},
];


const generateMockUserData = (count: number): Users[] => {
    const mockData: Users[] = [];

    for (let i = 0; i < count; i++) {

        const user: Users = {
            id: `ID-${Math.floor(Math.random() * 1000)}`,
            externalWorkerID: `EXT-${Math.floor(Math.random() * 1000)}`,
            status:
                Math.random() > 0.5
                    ? "Active"
                    : Math.random() > 0.5
                        ? "Paused"
                        : Math.random() > 0.5
                            ? "Vacation"
                            : "Inactive",
            startDate: new Date(new Date().getTime() - Math.random() * (24 * 60 * 60 * 1000 * 40)),
        };

        mockData.push(user);
    }

    return mockData;
};

export const users: Users[] = generateMockUserData(100);
