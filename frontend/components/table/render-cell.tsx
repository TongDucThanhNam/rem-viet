import {Chip, Tooltip, User} from "@nextui-org/react";
import React from "react";


import {users} from "./data";
import {DeleteIcon, EditIcon, EyeIcon} from "@/components/icons/icons";

interface Props {
    user: (typeof users)[number];
    columnKey: string | React.Key;
}

export const RenderCell = ({user, columnKey}: Props) => {
    // @ts-ignore
    const cellValue = user[columnKey];

    switch (columnKey) {
        case "name":
            return (
                <User
                    avatarProps={{
                        src: "/src/user-avatar.jpeg",
                    }}
                    name={cellValue}
                >
                    {user.email}
                </User>
            );
        case "role":
            return (
                <div>
                    <div>
                        <span>{cellValue}</span>
                    </div>
                    <div>
                        <span>{user.team}</span>
                    </div>
                </div>
            );
        case "status":
            return (
                <Chip
                    color={
                        cellValue === "active"
                            ? "success"
                            : cellValue === "paused"
                                ? "danger"
                                : "warning"
                    }
                    size="sm"
                    variant="flat"
                >
                    <span className="capitalize text-xs">{cellValue}</span>
                </Chip>
            );

        case "actions":
            return (
                <div className="flex items-center gap-4 ">
                    <div>
                        <Tooltip content="Details">
                            <button onClick={() => console.log("View user", user.id)}>
                                <EyeIcon fill="#979797" size={20}/>
                            </button>
                        </Tooltip>
                    </div>
                    <div>
                        <Tooltip color="secondary" content="Edit user">
                            <button onClick={() => console.log("Edit user", user.id)}>
                                <EditIcon fill="#979797" size={20}/>
                            </button>
                        </Tooltip>
                    </div>
                    <div>
                        <Tooltip
                            color="danger"
                            content="Delete user"
                            onClick={() => console.log("Delete user", user.id)}
                        >
                            <button>
                                <DeleteIcon fill="#FF0080" size={20}/>
                            </button>
                        </Tooltip>
                    </div>
                </div>
            );
        // Brand
        case "brand":
            return <span>{cellValue}</span>;

        // Size
        case "size":
            return <span>{cellValue}</span>;

        // Color
        case "color":
            return <span>{cellValue}</span>;

        default:
            return cellValue;
    }
};