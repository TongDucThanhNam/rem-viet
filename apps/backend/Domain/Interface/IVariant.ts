export interface IVariant {
    _id: string | null,
    imageUrls: string[],
    productId: string | null,
    key: number,
    values: { [key: string]: string | number }, // Object {variant1: value, variant2: value ... }
    variantPrice: number,
    __v: number
}