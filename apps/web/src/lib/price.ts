export function parseProductPrice(value?: string | number | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const firstPart = value.split(/[-–—]/)[0] ?? "";
  const numericPart = firstPart.match(/\d+/g)?.join("") ?? "";

  return Number(numericPart) || 0;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatProductPrice(price?: string | null) {
  if (!price) {
    return "Liên hệ";
  }

  const parts = price
    .split(/[-–—]/)
    .map((part) => parseProductPrice(part))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (parts.length >= 2) {
    return `${formatCurrency(parts[0])} - ${formatCurrency(parts[1])}`;
  }

  if (parts.length === 1) {
    return formatCurrency(parts[0]);
  }

  return price;
}
