import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { formatCurrency, useCart } from "@/lib/cart";
import { productImageUrl } from "@/lib/site-config";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/gio-hang")({
  component: CartRoute,
});

type CheckoutForm = {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  specificAddress: string;
  district: string;
  city: string;
  postcode: string;
};

const defaultCheckoutForm: CheckoutForm = {
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

function CartRoute() {
  const trpc = useTRPC();
  const cart = useCart();
  const [form, setForm] = useState<CheckoutForm>(defaultCheckoutForm);
  const createOrder = useMutation(
    trpc.orders.createCart.mutationOptions({
      onSuccess: () => {
        cart.clear();
        setForm(defaultCheckoutForm);
        toast.success("Đã ghi nhận đơn hàng.");
      },
      onError: () => {
        toast.error("Không thể gửi đơn hàng. Vui lòng thử lại.");
      },
    }),
  );

  function updateField(field: keyof CheckoutForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cart.items.length) {
      toast.error("Giỏ hàng trống.");
      return;
    }

    createOrder.mutate({
      ...form,
      cart: cart.items,
      total: cart.summary.total,
    });
  }

  return (
    <div className="flex h-auto items-center justify-center p-4">
      <form
        className="flex w-full max-w-7xl flex-col lg:flex-row lg:gap-8"
        onSubmit={submitOrder}
      >
        <section className="mx-auto flex w-full justify-center text-center">
          <div className="mx-auto flex h-auto items-center text-center">
            <div className="flex w-full max-w-2xl py-8">
              <div className="flex flex-col gap-5 py-8">
                <div className="grid gap-2 text-left">
                  <Label htmlFor="email">Email của bạn</Label>
                  <Input
                    id="email"
                    placeholder="Nhập Email của bạn"
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="firstName">Họ của bạn</Label>
                    <Input
                      id="firstName"
                      placeholder="Nhập họ của bạn"
                      required
                      value={form.firstName}
                      onChange={(event) =>
                        updateField("firstName", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="lastName">Tên của bạn</Label>
                    <Input
                      id="lastName"
                      placeholder="Nhập tên của bạn"
                      required
                      value={form.lastName}
                      onChange={(event) =>
                        updateField("lastName", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="address">Địa chỉ</Label>
                    <Input
                      id="address"
                      placeholder="Lê Văn Lương, Quận 7, TP.HCM"
                      required
                      value={form.address}
                      onChange={(event) =>
                        updateField("address", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="specificAddress">Specific address</Label>
                    <Input
                      id="specificAddress"
                      placeholder="Đại học RMIT"
                      required
                      value={form.specificAddress}
                      onChange={(event) =>
                        updateField("specificAddress", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="district">Quận, huyện</Label>
                    <Input
                      id="district"
                      placeholder="Quận 7"
                      required
                      value={form.district}
                      onChange={(event) =>
                        updateField("district", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="city">Tỉnh/Thành phố</Label>
                    <Input
                      id="city"
                      placeholder="Hồ Chí Minh"
                      required
                      value={form.city}
                      onChange={(event) =>
                        updateField("city", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="postcode">Mã bưu điện</Label>
                    <Input
                      id="postcode"
                      placeholder="700000"
                      value={form.postcode}
                      onChange={(event) =>
                        updateField("postcode", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2 text-left">
                    <Label htmlFor="phoneNumber">Số điện thoại</Label>
                    <Input
                      id="phoneNumber"
                      placeholder="0901234567"
                      required
                      value={form.phoneNumber}
                      onChange={(event) =>
                        updateField("phoneNumber", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="mt-6 h-fit w-full rounded-medium bg-content2 px-2 py-4 md:px-6 md:py-8 lg:w-[340px] lg:flex-none">
          <div className="flex flex-col">
            <h2 className="text-2xl font-semibold tracking-normal">Giỏ hàng</h2>
            <div className="h-4" />

            <ul>
              <li>
                <div className="flex max-h-[520px] flex-col items-center gap-x-4 overflow-y-scroll py-4">
                  {cart.items.length ? (
                    cart.items.map((item) => (
                      <div
                        className="w-full max-w-sm rounded-lg border bg-background p-3 shadow-sm transition-all duration-300 hover:shadow-md sm:max-w-md sm:p-4"
                        key={`cart-item${item.id}`}
                      >
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex w-full justify-center sm:w-auto sm:justify-start">
                            <img
                              alt={`${item.name} image`}
                              className="size-[60px] rounded-md object-cover"
                              src={productImageUrl(item.imageUrl)}
                            />
                          </div>
                          <div className="min-w-0 w-full flex-1 sm:w-fit">
                            <div className="flex items-start justify-between">
                              <h4 className="truncate pr-2 text-base font-semibold text-foreground sm:max-w-sm sm:text-lg md:max-w-xs">
                                {item.name} {item.name}
                              </h4>
                              <Button
                                aria-label="Remove item"
                                className="h-7 w-7 rounded-lg sm:h-8 sm:w-8"
                                size="icon-sm"
                                type="button"
                                variant="destructive"
                                onClick={() => cart.removeItem(item.id)}
                              >
                                <X aria-hidden className="size-4" />
                              </Button>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {formatCurrency(item.price)}
                              </span>
                              <span className="text-xs text-muted-foreground sm:text-sm">
                                x {item.quantity}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-2">
                              {Object.values(item.variants).map(
                                (value, index) => (
                                  <span
                                    className="rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground sm:px-2 sm:py-1"
                                    key={`${value}-${index}`}
                                  >
                                    {value}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Giỏ hàng trống.
                    </p>
                  )}
                </div>
              </li>
            </ul>

            <div className="flex flex-col gap-4 py-4">
              <div className="border-t" />
              <div className="flex justify-between">
                <span>Tổng cộng</span>
                <span className="text-foreground">
                  {formatCurrency(cart.summary.total)}
                </span>
              </div>
            </div>

            <div className="h-4" />
            <Button
              className="w-auto rounded-lg self-start"
              disabled={!cart.items.length || createOrder.isPending}
              type="submit"
            >
              {createOrder.isPending ? "Đang gửi..." : "Đặt hàng"}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
