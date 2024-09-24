"use client"; // <===== REQUIRED

import React from "react";
import { Card, CardBody, Image, Skeleton } from "@nextui-org/react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { StartIcon } from "@/components/icons/icons";

const CardItem = ({
  imageUrls,
  name,
  price,
  productId,
  isLoading,
}: {
  imageUrls: string[];
  name: string;
  description: string;
  price: string;
  productId: string;
  productSize: string[];
  isLoading: boolean;
}) => {
  const router = useRouter();

  return (
    <Card
      className="relative flex w-full flex-none flex-col gap-3 select-none"
      isFooterBlurred={true}
      isBlurred={true}
      shadow={"lg"}
      isPressable={true}
      disableAnimation={true}
      disableRipple={true}
      onPress={() => {
        router.push(`/product/${productId}`);
      }}
    >
      <div className="relative w-full">
        {isLoading ? (
          <Skeleton>
            <Image
              as={NextImage}
              width={800}
              height={800}
              isBlurred
              src={imageUrls[0]}
              fallbackSrc={"/src/800x800.png"}
              alt="Product Image"
              layout="responsive"
            />
          </Skeleton>
        ) : (
          <Image
            isBlurred={true}
            removeWrapper
            className={"w-full h-full"}
            as={NextImage}
            width={800}
            height={800}
            src={imageUrls[0]}
            fallbackSrc={"/src/800x800.png"}
            alt="Product Image"
            layout="responsive"
          />
        )}
      </div>

      <CardBody className="mt-1 flex flex-col gap-2 px-1">
        <div className="flex items-start justify-between gap-1">
          <h3 className="text-small font-medium text-default-700">
            {isLoading ? (
              <Skeleton>
                <span>{name}</span>
              </Skeleton>
            ) : (
              <span>{name}</span>
            )}
          </h3>
          <div className="flex items-center gap-1">
            <StartIcon />
            <span className="text-small text-default-500">5.0</span>
          </div>
        </div>
        <div className="text-small font-medium text-default-500">
          {isLoading ? (
            <Skeleton>
              <p className={"text-ellipsis overflow-hidden line-clamp-3 ..."}>
                {price}₫
              </p>
            </Skeleton>
          ) : (
            <p className={"text-ellipsis overflow-hidden line-clamp-3 ..."}>
              {price}₫
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default CardItem;
