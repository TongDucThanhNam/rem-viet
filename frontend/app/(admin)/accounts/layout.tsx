"use client";

import React from "react";
import AdminLayout from "@/app/(admin)/layout";

export default function Layout({children}: { children: React.ReactNode }) {
    return <AdminLayout>{children}</AdminLayout>;
}
