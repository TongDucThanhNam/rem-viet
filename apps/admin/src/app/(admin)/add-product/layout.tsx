import React from "react";

export default function AddProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 ">
      <div className="inline-block text-center justify-center w-full bg-transparent">
        {children}
      </div>
    </section>
  );
}
