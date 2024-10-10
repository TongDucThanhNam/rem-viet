"use client";

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
} from "@nextui-org/react";
import { useCart } from "@/store/CartProvider";
import { Cart } from "@/api/types";

const products = [
  { id: "1", name: "Product 1", price: 10 },
  { id: "2", name: "Product 2", price: 15 },
  { id: "3", name: "Product 3", price: 20 },
];

export default function ProductList({
  addToCartAction,
}: {
  addToCartAction: (id: any) => Promise<Cart>;
}) {
  const setCart = useCart()((state) => state.setCart);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader>{product.name}</CardHeader>
          <CardBody>
            <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
          </CardBody>
          <CardFooter>
            <Button
              onClick={async () => setCart(await addToCartAction(product.id))}
            >
              Add to Cart
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
