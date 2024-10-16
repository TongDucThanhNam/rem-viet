"use client"; // <===== REQUIRED

import React from "react";
import { Button, Card, CardBody, CardFooter } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";

import { SolarStarLinear } from "@/components/icons/icons";
import { priceVietNamDongformetter } from "@/components/lib/client-utils/utils";

const CardItem = ({
  imageUrls,
  name,
  price,
  productId,
  // isLoading,
}: {
  imageUrls: string[];
  name: string;
  description: string;
  price: string;
  productId: string;
  productSize: string[];
  // isLoading: boolean;
}) => {
  const router = useRouter();

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-square">
        <NextImage
          alt={name}
          className=""
          fill={true}
          src={`${process.env.NEXT_PUBLIC_DOMAIN}/cdn-cgi/image/fit=scale-down,width=640,format=auto/${imageUrls[0]}`}
          // src={imageUrls[0]}
        />
      </div>
      <CardBody className="p-4">
        <h3 className="text-lg font-semibold line-clamp-2 mb-2">{name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">
            {priceVietNamDongformetter(price)}
          </span>
          <div className="flex items-center">
            <SolarStarLinear />
            <span className="ml-1 text-sm text-gray-600">{5}</span>
          </div>
        </div>
      </CardBody>
      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          onClick={() => router.push(`/san-pham/${productId}`)}
        >
          Xem chi tiết
        </Button>
      </CardFooter>
    </Card>
  );
};

export default React.memo(CardItem);
