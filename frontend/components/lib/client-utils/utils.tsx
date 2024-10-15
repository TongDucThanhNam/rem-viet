export function priceVietNamDongformetter(price: string) {
  //if contains - (price1-price2)
  if (String(price).includes("-")) {
    let prices = price.split("-");

    return `${new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseInt(prices[0]))} - ${new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseInt(prices[1]))}`;
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseInt(price));
}
