import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";

import AdminShell from "@/components/admin-shell";
import ProductForm, { type ProductFormValues } from "@/components/product-form";
import { getAdminUser } from "@/functions/get-admin-user";
import { normalizeVariantValues } from "@/lib/variants";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/products/$productId/edit")({
  component: EditProductRoute,
  beforeLoad: async () => {
    const session = await getAdminUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/dang-nhap" });
    }
  },
});

function EditProductRoute() {
  const { productId } = Route.useParams();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const productQuery = useQuery(
    trpc.products.adminWithVariants.queryOptions({
      productId,
      includeInactive: true,
    }),
  );
  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const updateProduct = useMutation(
    trpc.products.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.products.adminList.queryFilter());
        queryClient.invalidateQueries(
          trpc.products.adminWithVariants.queryFilter({ productId }),
        );
        navigate({ to: "/admin/products" });
      },
    }),
  );
  const data = productQuery.data?.data;

  return (
    <AdminShell hideHeading legacyContentFrame title="Sửa sản phẩm">
      {productQuery.isLoading ? (
        <div className="mx-auto my-14 min-h-80 w-full max-w-2xl animate-pulse rounded-md border bg-muted/30" />
      ) : data?.product ? (
        <ProductForm
          key={data.product._id}
          categories={categoriesQuery.data ?? []}
          initialValues={{
            name: data.product.name,
            description: data.product.description ?? "",
            price: data.product.price ?? "",
            categoryId: data.product.categoryId ?? "",
            imageUrls: data.product.imageUrls,
            size: data.product.size,
            variants: data.variants.map((variant) => ({
              id: variant.id,
              _id: variant._id,
              key: variant.key,
              variantPrice: variant.variantPrice,
              values: normalizeVariantValues(variant.values),
            })),
          }}
          isSubmitting={updateProduct.isPending}
          submitLabel="Lưu thay đổi"
          onSubmit={(values: ProductFormValues) => {
            updateProduct.mutate({
              productId,
              name: values.name,
              description: values.description,
              price: values.price,
              categoryId: values.categoryId,
              imageUrls: values.imageUrls,
              size: values.size,
              variants: values.variants,
            });
          }}
        />
      ) : (
        <div className="mx-auto my-14 flex min-h-80 w-full max-w-2xl flex-col items-center justify-center gap-3 border text-center">
          <PackageSearch aria-hidden className="size-8 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-medium">Không tìm thấy sản phẩm</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bản ghi này không còn tồn tại.
            </p>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
