import { useEffect, useMemo, useState } from "react";

import { formatCurrency, parseProductPrice } from "@/lib/price";

const CART_STORAGE_KEY = "rem-viet-cart";
const LEGACY_CART_STORAGE_KEY = "cart-storage";
const CART_UPDATED_EVENT = "rem-viet-cart-updated";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variants: Record<string, string>;
};

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function safeParseCart(value: string | null): CartItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as CartItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is CartItem =>
      Boolean(
        item &&
        typeof item === "object" &&
        item.id &&
        item.productId &&
        item.name,
      ),
    );
  } catch {
    return [];
  }
}

function normalizeLegacyCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const productId = String(record.productId ?? record.id ?? "");
  const name = String(record.name ?? "");

  if (!productId || !name) {
    return null;
  }

  const variants =
    record.variants && typeof record.variants === "object"
      ? Object.fromEntries(
          Object.entries(record.variants as Record<string, unknown>).map(
            ([key, itemValue]) => [key, String(itemValue)],
          ),
        )
      : {};

  const price = parseProductPrice(
    typeof record.price === "number" || typeof record.price === "string"
      ? record.price
      : 0,
  );
  const quantity = Number(record.quantity ?? 1);

  return {
    id: String(record.id ?? productId),
    productId,
    name,
    price: Number.isFinite(price) ? price : 0,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    imageUrl: String(
      record.imageUrl ??
        (Array.isArray(record.imageUrls) ? record.imageUrls[0] : "") ??
        "",
    ),
    variants,
  };
}

function safeParseLegacyCart(value: string | null): CartItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const legacyCart =
      parsed && typeof parsed === "object"
        ? (parsed as { state?: { cart?: unknown } }).state?.cart
        : null;

    if (!Array.isArray(legacyCart)) {
      return [];
    }

    return legacyCart
      .map(normalizeLegacyCartItem)
      .filter((item): item is CartItem => Boolean(item));
  } catch {
    return [];
  }
}

export function getCartItems() {
  const storage = getBrowserStorage();
  const items = safeParseCart(storage?.getItem(CART_STORAGE_KEY) ?? null);

  if (items.length) {
    return items;
  }

  const legacyItems = safeParseLegacyCart(
    storage?.getItem(LEGACY_CART_STORAGE_KEY) ?? null,
  );

  if (legacyItems.length) {
    storage?.setItem(CART_STORAGE_KEY, JSON.stringify(legacyItems));
  }

  return legacyItems;
}

function emitCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  }
}

function setCartItems(items: CartItem[]) {
  getBrowserStorage()?.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emitCartUpdated();
}

export function addCartItem(
  item: Omit<CartItem, "id" | "quantity"> & { quantity?: number },
) {
  const items = getCartItems();
  const existingIndex = items.findIndex(
    (cartItem) => cartItem.productId === item.productId,
  );

  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    items[existingIndex] = {
      ...existing,
      quantity: existing.quantity + (item.quantity ?? 1),
    };
  } else {
    items.push({
      ...item,
      id: crypto.randomUUID(),
      quantity: item.quantity ?? 1,
      variants: item.variants ?? {},
    });
  }

  setCartItems(items);
}

export function updateCartItemQuantity(id: string, quantity: number) {
  const nextItems = getCartItems()
    .map((item) => (item.id === id ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);

  setCartItems(nextItems);
}

export function removeCartItem(id: string) {
  setCartItems(getCartItems().filter((item) => item.id !== id));
}

export function clearCartItems() {
  setCartItems([]);
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => getCartItems());

  useEffect(() => {
    const sync = () => setItems(getCartItems());

    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const summary = useMemo(() => {
    return {
      count: items.reduce((total, item) => total + item.quantity, 0),
      total: items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
    };
  }, [items]);

  return {
    items,
    summary,
    addItem: addCartItem,
    updateQuantity: updateCartItemQuantity,
    removeItem: removeCartItem,
    clear: clearCartItems,
  };
}

export { formatCurrency, parseProductPrice };
