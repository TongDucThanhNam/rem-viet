import Cart from "@/components/cart/Cart";
import ProductList from "@/components/cart/product-list";
import {addToCart} from "@/api/cart";

export default function Home() {
    const addToCartAction = async (id: any) => {
        "use server";
        return await addToCart(+id);
    };

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">Next.js Shopping Cart</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Products</h2>
          <ProductList  addToCartAction={addToCartAction} />
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Cart</h2>
          <Cart />
        </div>
      </div>
    </>
  );
}
