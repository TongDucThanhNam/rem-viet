import React from "react";
import { Skeleton } from "@nextui-org/react";

export default function Loading() {
  return (
    <section
      id={"feature"}
      className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
    >
      <Skeleton />
    </section>
  );
}
