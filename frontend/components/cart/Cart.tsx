// 'use client'
//
// import { useCartStore } from '../lib/useCartStore'
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
//
// export default function Cart() {
//     const { items, removeItem, clearCart, total } = useCartStore()
//
//     if (items.length === 0) {
//         return (
//             <Card className="w-full max-w-md mx-auto">
//                 <CardContent className="pt-6">
//                     <p className="text-center text-gray-500">Your cart is empty</p>
//                 </CardContent>
//             </Card>
//         )
//     }
//
//     return (
//         <Card className="w-full max-w-md mx-auto">
//             <CardHeader>
//                 <CardTitle>Your Cart</CardTitle>
//             </CardHeader>
//             <CardContent>
//                 {items.map((item) => (
//                     <div key={item.id} className="flex justify-between items-center mb-4">
//                         <div>
//                             <h3 className="font-semibold">{item.name}</h3>
//                             <p className="text-sm text-gray-500">
//                                 ${item.price.toFixed(2)} x {item.quantity}
//                             </p>
//                         </div>
//                         <Button variant="destructive" size="sm" onClick={() => removeItem(item.id)}>
//                             Remove
//                         </Button>
//                     </div>
//                 ))}
//             </CardContent>
//             <CardFooter className="flex justify-between">
//                 <p className="font-semibold">Total: ${total.toFixed(2)}</p>
//                 <Button onClick={clearCart}>Clear Cart</Button>
//             </CardFooter>
//         </Card>
//     )
// }
