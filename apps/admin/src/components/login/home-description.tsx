"use client";

import * as React from "react";
// import { Flex, FlexBox } from "@/components/flex";
import { Avatar, AvatarGroup } from "@nextui-org/react";

const pictureUsers = [
  "https://i.pravatar.cc/150?u=a042581f4e29026024d",
  "https://i.pravatar.cc/150?u=a042581f4e29026704d",
  "https://i.pravatar.cc/150?u=a04258114e29026702d",
  "https://i.pravatar.cc/150?u=a048581f4e29026701d",
  "https://i.pravatar.cc/150?u=a092581d4ef9026700d",
];

export const HomeDescription = () => {
  return (
    <div className="w-full">
      <h1 className="text-4xl">Sign In to</h1>
      <h2 className="text-3xl">NextUI Design Pro</h2>
      <h3 className="text-2xl bg-gradient-to-r from-blue-500 via-pink-500 to-blue-700 inline-block text-transparent bg-clip-text">
        Use templates to quickly create your projects.
      </h3>
      <div className="flex justify-center">
        <AvatarGroup isBordered>
          <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" />
          <Avatar src="https://i.pravatar.cc/150?u=a04258a2462d826712d" />
          <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
          <Avatar src="https://i.pravatar.cc/150?u=a04258114e29026302d" />
          <Avatar src="https://i.pravatar.cc/150?u=a04258114e29026702d" />
          <Avatar src="https://i.pravatar.cc/150?u=a04258114e29026708c" />
        </AvatarGroup>
        <p className="font-bold"> Join Web Developer.</p>
      </div>
    </div>
  );
};
