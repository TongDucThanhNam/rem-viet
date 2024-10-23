import React from "react";
import { Skeleton } from "@nextui-org/skeleton";

export default function Loading() {
  return (
    <Skeleton>
      <div className={"h-full w-screen"}></div>
    </Skeleton>
  );
}
