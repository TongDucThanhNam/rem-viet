export interface IProduct {
    _id: string;
    slug: string;
    imageUrls: string[];
    name: string;
    description: string;
    size: number[];
    price: string;
    soldQuantity: number;
    quantity: number;
    rating: number;
    reviewsCount: number;
    categoryId: string;
    __v: number; // Version
}