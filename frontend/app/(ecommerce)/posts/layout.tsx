"use client";

// app/admin/layout.tsx
import React from "react";

export default function PostsLayout({
                                          children,
                                      }: {
    children: React.ReactNode;
}) {
    return (
        <div>
            <main>
                <section className="flex items-center h-screen justify-center p-4">
                    <div className="max-w-8xl h-full w-full px-2 lg:px-24">{children}</div>
                </section>
            </main>
        </div>
    );
}
