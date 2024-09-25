"use client"; // <===== REQUIRED

import React from "react";
import { Button, Card, CardBody, CardFooter, Image } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { Star } from "react-iconly";
import NextImage from "next/image";

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
        <NextImage src={imageUrls[0]} alt={name} layout="fill" className="" />
      </div>
      <CardBody className="p-4">
        <h3 className="text-lg font-semibold line-clamp-2 mb-2">{name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">{price}₫</span>
          <div className="flex items-center">
            <Star />
            <span className="ml-1 text-sm text-gray-600">{5}</span>
          </div>
        </div>
      </CardBody>
      <CardFooter className="p-4 pt-0">
        <Button
          onClick={() => router.push(`/product/${productId}`)}
          className="w-full"
        >
          Xem chi tiết
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CardItem;
