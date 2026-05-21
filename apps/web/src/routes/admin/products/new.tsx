import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import AdminShell from "@/components/admin-shell";
import ProductForm, { type ProductFormValues } from "@/components/product-form";
import { getAdminUser } from "@/functions/get-admin-user";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/products/new")({
  component: NewProductRoute,
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

function NewProductRoute() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery(trpc.categories.list.queryOptions());
  const createProduct = useMutation(
    trpc.products.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.products.adminList.queryFilter());
        navigate({ to: "/admin/products" });
      },
    }),
  );

  return (
    <AdminShell hideHeading legacyContentFrame title="Thêm sản phẩm">
      <ProductForm
        categories={categoriesQuery.data ?? []}
        isSubmitting={createProduct.isPending}
        submitLabel="Tạo sản phẩm"
        onSubmit={(values: ProductFormValues) => {
          createProduct.mutate({
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
    </AdminShell>
  );
}
