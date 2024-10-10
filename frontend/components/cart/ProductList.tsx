'use client'

import { useCartStore } from '../lib/useCartStore'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const products = [
    { id: '1', name: 'Product 1', price: 10 },
    { id: '2', name: 'Product 2', price: 15 },
    { id: '3', name: 'Product 3', price: 20 },
]

export default function ProductList() {
    const addItem = useCartStore((state) => state.addItem)

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map((product) => (
                <Card key={product.id}>
                    <CardHeader>
                        <CardTitle>{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => addItem(product)}>Add to Cart</Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}