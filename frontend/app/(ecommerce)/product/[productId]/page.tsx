import ProductDetail from "@/components/product/product-detail";

export default async function ProductPage({
                                              params,
                                          }: {
    params: { productId: string };
}) {
    return <ProductDetail productId={params.productId}/>;
}
