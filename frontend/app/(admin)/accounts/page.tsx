"use client"; // This is a comment

import {BreadcrumbItem, Breadcrumbs, Link} from "@nextui-org/react";
import React from "react";
import dynamic from "next/dynamic";
import {Input} from "@nextui-org/input";
import {InfoIcon} from "@nextui-org/shared-icons";
import {Button} from "@nextui-org/button";

import {TableWrapper} from "@/components/table/table";
import {HouseIcon} from "@/components/icons/breadcrumb/house-icon";
import {SettingsIcon} from "@/components/icons/sidebar/settings-icon";
import {TrashIcon} from "@/components/icons/accounts/trash-icon";
import {DotsIcon} from "@/components/icons/accounts/dots-icon";
import {ExportIcon} from "@/components/icons/accounts/export-icon";
import {AccountsIcon} from "@/components/icons/sidebar/accounts-icon";
import {AddUserButton} from "@/components/button/add-user";

const Chart = dynamic(
    () => import("@/components/charts/steam").then((mod) => mod.Steam),
    {
        ssr: false,
    },
);

export default function AccountsPage() {
    return (
        <div className="my-14 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
            <Breadcrumbs>
                <BreadcrumbItem>
                    <HouseIcon/>
                    <Link href={"/"}>
                        <span>Home</span>
                    </Link>
                </BreadcrumbItem>
                <BreadcrumbItem>
                    <HouseIcon/>
                    <Link href={"/"}>
                        <span>Admin</span>
                    </Link>
                </BreadcrumbItem>
                <BreadcrumbItem>
                    <AccountsIcon/>
                    <Link href={"/"}>
                        <span>Accounts</span>
                    </Link>
                </BreadcrumbItem>
            </Breadcrumbs>

            <h3 className="text-xl font-semibold">All Accounts</h3>
            <div className="flex justify-between flex-wrap gap-4 items-center">
                <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                    <Input
                        classNames={{
                            input: "w-full",
                            mainWrapper: "w-full",
                        }}
                        placeholder="Search users"
                    />
                    <SettingsIcon/>
                    <TrashIcon/>
                    <InfoIcon/>
                    <DotsIcon/>
                </div>
                <div className="flex flex-row gap-3.5 flex-wrap">
                    <AddUserButton/>

                    <Button color="primary" startContent={<ExportIcon/>}>
                        Export to CSV
                    </Button>
                </div>
            </div>
            <div className="max-w-[95rem] mx-auto w-full">
                <TableWrapper/>
            </div>
        </div>
    );
}
