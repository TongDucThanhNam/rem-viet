import { Button } from "@rem-viet/ui/components/button";
import { Card, CardContent } from "@rem-viet/ui/components/card";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import AdminShell from "@/components/admin-shell";
import { getAdminUser } from "@/functions/get-admin-user";
import { formatCurrency, parseProductPrice } from "@/lib/cart";
import { normalizeVariantValues } from "@/lib/variants";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/admin/orders/new")({
  component: NewOrderRoute,
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

type ManualOrderItem = {
  productId: string;
  quantity: number;
  variants: Record<string, string>;
  unitPrice: number;
  requiresVariant: boolean;
  isVariantValid: boolean;
};

type ProductListItem = {
  _id: string;
  name: string;
  price?: string | null;
  imageUrls: string[];
};

type ProductVariant = {
  _id?: string;
  id?: string;
  variantPrice: number;
  values: unknown;
};

const defaultContact = {
  email: "",
  firstName: "",
  lastName: "",
  phoneNumber: "",
  address: "",
  specificAddress: "",
  district: "",
  city: "",
  postcode: "",
};

function emptyOrderItem(): ManualOrderItem {
  return {
    productId: "",
    quantity: 1,
    variants: {},
    unitPrice: 0,
    requiresVariant: false,
    isVariantValid: true,
  };
}

function variantSignature(values: Record<string, string>) {
  return JSON.stringify(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function variantOptionsFromRows(variants: ProductVariant[]) {
  const options: Record<string, string[]> = {};

  for (const variant of variants) {
    for (const [key, value] of Object.entries(
      normalizeVariantValues(variant.values),
    )) {
      options[key] ??= [];
      if (!options[key].includes(value)) {
        options[key].push(value);
      }
    }
  }

  return options;
}

function findSelectedVariant(
  variants: ProductVariant[],
  selectedValues: Record<string, string>,
) {
  const selectedSignature = variantSignature(selectedValues);

  return variants.find(
    (variant) =>
      variantSignature(normalizeVariantValues(variant.values)) ===
      selectedSignature,
  );
}

function NewOrderRoute() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const productsQuery = useQuery(
    trpc.products.adminList.queryOptions({
      sort: "name",
      order: "asc",
      isActive: true,
      isDeleted: false,
    }),
  );
  const products = productsQuery.data?.data ?? [];
  const productById = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products],
  );
  const [contact, setContact] = useState(defaultContact);
  const [items, setItems] = useState<ManualOrderItem[]>([emptyOrderItem()]);
  const createOrder = useMutation(
    trpc.orders.createCart.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.orders.list.queryFilter());
        toast.success("Đã tạo đơn hàng.");
        navigate({ to: "/admin/orders" });
      },
      onError: (error) => {
        toast.error(error.message || "Không thể tạo đơn hàng.");
      },
    }),
  );
  const orderItems = items
    .map((item) => {
      const product = productById.get(item.productId);
      const quantity = Number(item.quantity);

      if (!product || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return {
        productId: product._id,
        name: product.name,
        price: item.unitPrice || parseProductPrice(product.price),
        quantity,
        imageUrl: product.imageUrls[0] ?? "",
        variants: item.variants,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const total = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  function updateContact(field: keyof typeof defaultContact, value: string) {
    setContact((current) => ({ ...current, [field]: value }));
  }

  function updateItem(index: number, patch: Partial<ManualOrderItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyOrderItem()]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.length === 1
        ? [emptyOrderItem()]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!orderItems.length) {
      toast.error("Vui lòng chọn ít nhất một sản phẩm.");
      return;
    }
    if (items.some((item) => item.productId && item.requiresVariant && !item.isVariantValid)) {
      toast.error("Vui lòng chọn đúng biến thể cho từng sản phẩm.");
      return;
    }

    createOrder.mutate({
      ...contact,
      cart: orderItems,
      total,
    });
  }

  return (
    <AdminShell hideHeading legacyContentFrame title="Thêm đơn hàng">
      <form
        className="mx-auto my-14 grid w-full max-w-5xl gap-4 lg:px-6"
        onSubmit={submitOrder}
      >
        <div className="mb-[18px] flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold leading-8 tracking-normal">
              Thêm đơn hàng
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo đơn hàng thủ công từ dữ liệu sản phẩm đã migrate sang D1.
              Giá được tính lại trên server từ sản phẩm và biến thể đang active.
            </p>
          </div>
          <Link
            className="inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
            to="/admin/orders"
          >
            <ArrowLeft aria-hidden className="mr-2 size-4" />
            Danh sách đơn
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card className="rounded-md border bg-background shadow-sm">
            <CardContent className="grid gap-4 p-5">
              <h2 className="text-sm font-semibold">Thông tin khách hàng</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id="firstName"
                  label="Họ của bạn"
                  required
                  value={contact.firstName}
                  onChange={(value) => updateContact("firstName", value)}
                />
                <Field
                  id="lastName"
                  label="Tên của bạn"
                  required
                  value={contact.lastName}
                  onChange={(value) => updateContact("lastName", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id="email"
                  label="Email của bạn"
                  type="email"
                  value={contact.email}
                  onChange={(value) => updateContact("email", value)}
                />
                <Field
                  id="phoneNumber"
                  label="Số điện thoại"
                  required
                  value={contact.phoneNumber}
                  onChange={(value) => updateContact("phoneNumber", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id="address"
                  label="Địa chỉ"
                  required
                  value={contact.address}
                  onChange={(value) => updateContact("address", value)}
                />
                <Field
                  id="specificAddress"
                  label="Địa chỉ cụ thể"
                  required
                  value={contact.specificAddress}
                  onChange={(value) => updateContact("specificAddress", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  id="district"
                  label="Quận, huyện"
                  required
                  value={contact.district}
                  onChange={(value) => updateContact("district", value)}
                />
                <Field
                  id="city"
                  label="Tỉnh/Thành phố"
                  required
                  value={contact.city}
                  onChange={(value) => updateContact("city", value)}
                />
                <Field
                  id="postcode"
                  label="Mã bưu điện"
                  value={contact.postcode}
                  onChange={(value) => updateContact("postcode", value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md border bg-background shadow-sm">
            <CardContent className="grid gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Sản phẩm</h2>
                <Button size="sm" type="button" onClick={addItem}>
                  <Plus aria-hidden className="size-3.5" />
                  Thêm dòng
                </Button>
              </div>

              {items.map((item, index) => {
                return (
                  <ManualOrderLine
                    index={index}
                    item={item}
                    key={index}
                    products={products as ProductListItem[]}
                    productsLoading={productsQuery.isLoading}
                    updateItem={updateItem}
                    onRemove={() => removeItem(index)}
                  />
                );
              })}

              <div className="flex items-center justify-between border-t pt-4 text-sm font-semibold">
                <span>Tổng cộng</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <div className="flex justify-end gap-2">
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                  to="/admin/orders"
                >
                  Hủy
                </Link>
                <Button disabled={createOrder.isPending} type="submit">
                  {createOrder.isPending ? "Đang tạo..." : "Tạo đơn hàng"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </AdminShell>
  );
}

function ManualOrderLine({
  index,
  item,
  onRemove,
  products,
  productsLoading,
  updateItem,
}: {
  index: number;
  item: ManualOrderItem;
  onRemove: () => void;
  products: ProductListItem[];
  productsLoading: boolean;
  updateItem: (index: number, patch: Partial<ManualOrderItem>) => void;
}) {
  const trpc = useTRPC();
  const product = products.find((option) => option._id === item.productId);
  const variantQueryOptions = trpc.products.withVariants.queryOptions({
    productId: item.productId || "__missing-product__",
  });
  const variantQuery = useQuery({
    ...variantQueryOptions,
    enabled: Boolean(item.productId),
    retry: false,
  });
  const variants = (variantQuery.data?.data?.variants ?? []) as ProductVariant[];
  const variantOptions = useMemo(
    () => variantOptionsFromRows(variants),
    [variants],
  );
  const variantKeys = Object.keys(variantOptions);
  const selectedVariant = findSelectedVariant(variants, item.variants);
  const hasVariants = variants.length > 0;
  const isVariantValid = hasVariants ? Boolean(selectedVariant) : true;
  const unitPrice = selectedVariant?.variantPrice ?? parseProductPrice(product?.price);

  useEffect(() => {
    if (!product) {
      if (item.unitPrice || item.requiresVariant || !item.isVariantValid) {
        updateItem(index, {
          unitPrice: 0,
          requiresVariant: false,
          isVariantValid: true,
        });
      }
      return;
    }

    if (
      item.unitPrice !== unitPrice ||
      item.requiresVariant !== hasVariants ||
      item.isVariantValid !== isVariantValid
    ) {
      updateItem(index, {
        unitPrice,
        requiresVariant: hasVariants,
        isVariantValid,
      });
    }
  }, [
    hasVariants,
    index,
    isVariantValid,
    item.isVariantValid,
    item.requiresVariant,
    item.unitPrice,
    product,
    unitPrice,
    updateItem,
  ]);

  function selectProduct(productId: string) {
    const nextProduct = products.find((option) => option._id === productId);

    updateItem(index, {
      productId,
      variants: {},
      unitPrice: nextProduct ? parseProductPrice(nextProduct.price) : 0,
      requiresVariant: false,
      isVariantValid: true,
    });
  }

  function selectVariantValue(key: string, value: string) {
    updateItem(index, {
      variants: {
        ...item.variants,
        [key]: value,
      },
    });
  }

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="grid gap-2">
        <Label htmlFor={`product-${index}`}>Sản phẩm</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          disabled={productsLoading}
          id={`product-${index}`}
          required
          value={item.productId}
          onChange={(event) => selectProduct(event.target.value)}
        >
          <option value="">Chọn sản phẩm</option>
          {products.map((option) => (
            <option key={option._id} value={option._id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {hasVariants ? (
        <div className="grid gap-3 rounded-md bg-muted/30 p-3">
          {variantKeys.map((key) => (
            <div className="grid gap-2" key={key}>
              <Label>{key}</Label>
              <div className="flex flex-wrap gap-2">
                {variantOptions[key].map((value) => {
                  const selected = item.variants[key] === value;

                  return (
                    <button
                      className={`inline-flex h-8 items-center rounded-sm border px-2 text-xs transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                      key={value}
                      type="button"
                      onClick={() => selectVariantValue(key, value)}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!isVariantValid ? (
            <p className="text-xs text-destructive">
              Chọn đủ một tổ hợp biến thể đang active để tạo đơn.
            </p>
          ) : null}
        </div>
      ) : variantQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Đang tải biến thể...</p>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`quantity-${index}`}>Số lượng</Label>
          <Input
            id={`quantity-${index}`}
            min={1}
            required
            type="number"
            value={String(item.quantity)}
            onChange={(event) =>
              updateItem(index, {
                quantity: Number(event.target.value || 1),
              })
            }
          />
        </div>
        <Button
          aria-label="Xóa dòng sản phẩm"
          className="mt-6"
          size="icon"
          type="button"
          variant="destructive"
          onClick={onRemove}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {hasVariants && selectedVariant
            ? formatCurrency(selectedVariant.variantPrice)
            : product?.price ?? "Chưa chọn giá"}
        </span>
        <span>{formatCurrency(unitPrice * item.quantity)}</span>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
