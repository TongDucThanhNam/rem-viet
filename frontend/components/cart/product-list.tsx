"use client";

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
} from "@nextui-org/react";

import { Product } from "@/types";

const products: Product[] = [
  {
    id: "1",
    name: "Product 1",
    description: "Product 1 description",
    price: 100,
    rating: 4,
    imageUrl: "/src/150x150.png",
    imageUrls: [],
  },
  {
    id: "2",
    name: "Product 2",
    description: "Product 2 description",
    price: 200,
    rating: 3,
    imageUrl: "/src/150x150.png",
    imageUrls: [],
  },
  {
    id: "3",
    name: "Product 3",
    description: "Product 3 description",
    price: 300,
    rating: 5,
    imageUrl: "/src/150x150.png",
    imageUrls: [],
  },
];

export default function ProductList({ addToCart }: { addToCart: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader>{product.name}</CardHeader>
          <CardBody>
            <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
          </CardBody>
          <CardFooter>
            <Button onClick={() => addToCart(product)}>Add to Cart</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
